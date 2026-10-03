import { expect } from "vitest";
import { AppError } from "@/server/errors";

export async function expectAppError(promise: Promise<unknown>, code: AppError["code"]) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
  return error as AppError;
}
