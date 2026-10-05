import "server-only";
import { getCurrentUser } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { apiWriteLimiter } from "@/server/rate-limit";

export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    const body: ApiErrorBody = { error: { code: error.code, message: error.message, fields: error.fields } };
    const headers = error.retryAfterSeconds ? { "Retry-After": String(error.retryAfterSeconds) } : undefined;
    return Response.json(body, { status: error.status, headers });
  }
  // Unknown errors: log server-side without request payloads, return a generic message.
  // Messages from the DB driver can echo user input, so only the error class and code are logged.
  const code = typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code) : "";
  console.error(`[api] unexpected ${error instanceof Error ? error.name : typeof error}${code ? ` (${code})` : ""}`);
  const body: ApiErrorBody = { error: { code: "INTERNAL", message: "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요." } };
  return Response.json(body, { status: 500 });
}

/** Runs a JSON API handler and maps thrown AppErrors to HTTP responses. */
export async function handleApi(fn: () => Promise<unknown>, status = 200): Promise<Response> {
  try {
    const data = await fn();
    if (status === 204) return new Response(null, { status });
    return Response.json({ data }, { status });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function requireApiUser() {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHORIZED", "로그인이 필요해요.");
  return user;
}

/**
 * Guards cookie-authenticated writes: JSON only (forces a CORS preflight for cross-site callers),
 * same-origin when the browser sends an Origin header, and a per-user rate limit.
 */
export async function guardWrite(request: Request, userId: string) {
  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (!host || new URL(origin).host !== host) throw new AppError("FORBIDDEN", "허용되지 않은 요청이에요.");
  }
  const limit = await apiWriteLimiter.consume(`user:${userId}`);
  if (!limit.ok) {
    const seconds = Math.max(1, Math.ceil(limit.retryAfterMs / 1000));
    throw new AppError("RATE_LIMITED", "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.", undefined, seconds);
  }
}

export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new AppError("VALIDATION", "Content-Type은 application/json이어야 해요.");
  }
  try {
    return await request.json();
  } catch {
    throw new AppError("VALIDATION", "요청 본문이 올바른 JSON이 아니에요.");
  }
}
