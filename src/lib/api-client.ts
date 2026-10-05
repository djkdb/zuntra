/** Browser-side JSON client for the /api routes. Throws ApiError with server field errors. */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method ?? "GET",
      headers: init.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: "same-origin",
      signal: init.signal,
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError("NETWORK", "네트워크에 연결할 수 없어요. 연결 상태를 확인해 주세요.", 0);
  }
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => null)) as
    | { data?: T; error?: { code: string; message: string; fields?: Record<string, string> } }
    | null;
  if (!response.ok || !body || body.error) {
    const err = body?.error;
    throw new ApiError(err?.code ?? "INTERNAL", err?.message ?? "정보를 가져오지 못했어요.", response.status, err?.fields);
  }
  return body.data as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.";
}
