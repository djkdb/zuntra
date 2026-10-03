import "server-only";
import type { z } from "zod";
import { fieldErrors } from "@/lib/validation/common";
import { AppError } from "@/server/errors";

export function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION", "입력값을 확인해 주세요.", fieldErrors(parsed.error));
  }
  return parsed.data;
}
