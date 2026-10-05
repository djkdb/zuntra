import "server-only";
import { withJosa } from "@/lib/korean";

export type AppErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "AI_FAILED"
  | "INTERNAL";

const STATUS: Record<AppErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  AI_FAILED: 502,
  INTERNAL: 500,
};

/** Expected, user-facing failure. Messages are safe to show to the user. */
export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly fields?: Record<string, string>,
    /** Sent as Retry-After for RATE_LIMITED responses. */
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "AppError";
  }

  get status() {
    return STATUS[this.code];
  }
}

export const notFound = (what = "요청한 항목") => new AppError("NOT_FOUND", `${withJosa(what, "을/를")} 찾을 수 없어요.`);
