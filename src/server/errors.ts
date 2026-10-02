import "server-only";

export type AppErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL";

const STATUS: Record<AppErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

/** Expected, user-facing failure. Messages are safe to show to the user. */
export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }

  get status() {
    return STATUS[this.code];
  }
}

export const notFound = (what = "요청한 항목") => new AppError("NOT_FOUND", `${what}을(를) 찾을 수 없어요.`);
