import "server-only";
import type { z } from "zod";
import type { AIFeature } from "@/generated/prisma/enums";

export interface AIRequest<T extends z.ZodType> {
  feature: AIFeature;
  /** Stable name for the JSON schema (also selects the mock handler). */
  schemaName: string;
  schema: T;
  system: string;
  /** Model-facing user content (already delimited / sanitized by the prompt module). */
  input: string;
  /** Structured context the mock provider reasons over; never sent to a remote model as-is. */
  context: unknown;
  model: string;
  maxOutputTokens?: number;
}

export interface AIResult<T> {
  data: T;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

export interface AIProvider {
  readonly name: "openai" | "mock";
  /** Returns raw parsed JSON; the caller validates it with the Zod schema. */
  generate<T extends z.ZodType>(request: AIRequest<T>): Promise<AIResult<unknown>>;
}

export class AIProviderError extends Error {
  constructor(
    public readonly code: "TIMEOUT" | "RATE_LIMIT" | "BAD_OUTPUT" | "UPSTREAM" | "CONFIG",
    message: string,
  ) {
    super(message);
    this.name = "AIProviderError";
  }
}
