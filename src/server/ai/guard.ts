import "server-only";
import { createHash } from "node:crypto";
import type { z } from "zod";
import type { AIFeature } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { AppError } from "@/server/errors";
import { createMemoryRateLimiter, type RateLimiter } from "@/server/rate-limit";
import { mockHandlers } from "./mock";
import { type AIProvider, AIProviderError, type AIRequest } from "./provider";
import { estimateCostUsd } from "./pricing";
import { createMockProvider } from "./providers/mock";
import { createOpenAIProvider } from "./providers/openai";

let provider: AIProvider | undefined;

export function getAIProvider(): AIProvider {
  if (provider) return provider;
  const { OPENAI_API_KEY, AI_PROVIDER } = env();
  provider =
    AI_PROVIDER !== "mock" && OPENAI_API_KEY ? createOpenAIProvider(OPENAI_API_KEY) : createMockProvider(mockHandlers);
  return provider;
}

/** For tests: swap the provider (e.g. one that returns invalid output). */
export function setAIProviderForTesting(next: AIProvider | undefined) {
  provider = next;
}

export function modelFor(feature: AIFeature): string {
  const e = env();
  if (getAIProvider().name === "mock") return "mock";
  if (feature === "PLANNER" || feature === "RESCHEDULER") return e.AI_MODEL_PLANNER ?? e.AI_MODEL_DEFAULT;
  if (feature === "COMPANION") return e.AI_MODEL_COMPANION ?? e.AI_MODEL_DEFAULT;
  return e.AI_MODEL_DEFAULT;
}

const LIMITS: Record<AIFeature, number> = {
  PLANNER: 12,
  RESCHEDULER: 40,
  COMPANION: 60,
  ANALYZER: 40,
  PACKING: 12,
  REPORTER: 6,
};
const limiters = new Map<AIFeature, RateLimiter>();
function limiterFor(feature: AIFeature) {
  let l = limiters.get(feature);
  if (!l) {
    l = createMemoryRateLimiter({ limit: LIMITS[feature], windowMs: 60 * 60_000 });
    limiters.set(feature, l);
  }
  return l;
}

// Small response cache (identical prompt → identical answer) and in-flight de-duplication.
const CACHE_TTL_MS = 10 * 60_000;
const cache = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

function cacheGet(key: string) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}
function cacheSet(key: string, value: unknown) {
  if (cache.size > 300) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), value });
}

export interface RunAIOptions<T extends z.ZodType> extends Omit<AIRequest<T>, "model"> {
  userId: string;
  tripId?: string;
  /** Skip the response cache (e.g. "regenerate"). */
  fresh?: boolean;
  /** Skip the per-user rate limit (internal follow-up calls). */
  skipRateLimit?: boolean;
}

async function spentTodayUsd(userId: string): Promise<number> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const agg = await db.aIUsageLog.aggregate({ where: { userId, createdAt: { gte: since } }, _sum: { costUsd: true } });
  return Number(agg._sum.costUsd ?? 0);
}

/**
 * The only way features call a model: rate limit → budget check → cache/dedupe → provider →
 * Zod validation (one repair retry) → usage log. Raw model text never reaches callers.
 */
export async function runAI<T extends z.ZodType>(options: RunAIOptions<T>): Promise<z.output<T>> {
  const ai = getAIProvider();
  const model = modelFor(options.feature);

  if (!options.skipRateLimit) {
    const limit = await limiterFor(options.feature).consume(`${options.userId}`);
    if (!limit.ok) throw new AppError("RATE_LIMITED", "AI 요청이 너무 많아요. 잠시 후 다시 시도해 주세요.");
  }
  if (ai.name === "openai" && (await spentTodayUsd(options.userId)) >= env().AI_DAILY_BUDGET_USD) {
    throw new AppError("RATE_LIMITED", "오늘 사용할 수 있는 AI 요청을 모두 사용했어요. 내일 다시 시도해 주세요.");
  }

  const key = createHash("sha256")
    .update([options.feature, model, options.schemaName, options.system, options.input].join("\u0000"))
    .digest("hex");

  if (!options.fresh) {
    const cached = cacheGet(key);
    if (cached !== undefined) {
      await logUsage(options, model, 0, 0, 0, true, null, true);
      return cached as z.output<T>;
    }
  }
  const pending = inflight.get(key);
  if (pending) return pending as Promise<z.output<T>>;

  const run = (async () => {
    const started = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    try {
      let result = await ai.generate({ ...options, model });
      inputTokens += result.usage.inputTokens;
      outputTokens += result.usage.outputTokens;
      let parsed = options.schema.safeParse(result.data);
      if (!parsed.success && ai.name === "openai") {
        // One repair attempt with the validation errors.
        const issues = parsed.error.issues.slice(0, 8).map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
        result = await ai.generate({
          ...options,
          model,
          input: `${options.input}\n\n<validation_errors>\nYour previous JSON failed validation:\n${issues}\nReturn corrected JSON only.\n</validation_errors>`,
        });
        inputTokens += result.usage.inputTokens;
        outputTokens += result.usage.outputTokens;
        parsed = options.schema.safeParse(result.data);
      }
      if (!parsed.success) throw new AIProviderError("BAD_OUTPUT", "AI output failed schema validation");
      cacheSet(key, parsed.data);
      await logUsage(options, result.model, inputTokens, outputTokens, Date.now() - started, true, null, false);
      return parsed.data;
    } catch (error) {
      const code = error instanceof AIProviderError ? error.code : "UNKNOWN";
      await logUsage(options, model, inputTokens, outputTokens, Date.now() - started, false, code, false);
      if (error instanceof AppError) throw error;
      // Never log prompts or user content — only the error class.
      console.error(`[ai] ${options.feature} failed: ${code}`);
      throw new AppError(
        "AI_FAILED",
        code === "BAD_OUTPUT"
          ? "AI 응답을 확인하지 못했어요. 다시 시도해 주세요."
          : "AI가 지금 응답하지 못하고 있어요. 잠시 후 다시 시도해 주세요.",
      );
    }
  })();

  inflight.set(key, run);
  try {
    return (await run) as z.output<T>;
  } finally {
    inflight.delete(key);
  }
}

async function logUsage(
  options: { feature: AIFeature; userId: string; tripId?: string },
  model: string,
  inputTokens: number,
  outputTokens: number,
  latencyMs: number,
  success: boolean,
  errorCode: string | null,
  cached: boolean,
) {
  try {
    await db.aIUsageLog.create({
      data: {
        feature: options.feature,
        userId: options.userId,
        tripId: options.tripId ?? null,
        model,
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        costUsd: cached ? 0 : estimateCostUsd(model, inputTokens, outputTokens),
        latencyMs,
        success,
        errorCode,
        cached,
      },
    });
  } catch {
    // Usage logging must never break the feature.
  }
}

export function clearAICacheForTesting() {
  cache.clear();
  inflight.clear();
  limiters.clear();
}
