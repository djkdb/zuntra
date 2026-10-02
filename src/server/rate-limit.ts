import "server-only";

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimiter {
  consume(key: string): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
}

/**
 * Fixed-window limiter kept in process memory.
 * Good enough for a single instance and for development. On Vercel each lambda keeps its own
 * window, so swap this for a shared store (e.g. Upstash Redis) behind the same interface
 * before relying on it for abuse protection at scale.
 */
export function createMemoryRateLimiter(options: { limit: number; windowMs: number }): RateLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return {
    async consume(key) {
      const now = Date.now();
      // Opportunistic cleanup so the map cannot grow without bound.
      if (hits.size > 10_000) {
        for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      }
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + options.windowMs });
        return { ok: true, remaining: options.limit - 1, retryAfterMs: 0 };
      }
      entry.count += 1;
      const ok = entry.count <= options.limit;
      return {
        ok,
        remaining: Math.max(options.limit - entry.count, 0),
        retryAfterMs: ok ? 0 : entry.resetAt - now,
      };
    },
    async reset(key) {
      hits.delete(key);
    },
  };
}

const envLimit = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

export const loginLimiter = createMemoryRateLimiter({
  limit: envLimit("RATE_LIMIT_LOGIN_PER_15MIN", 10),
  windowMs: 15 * 60_000,
});
export const signupLimiter = createMemoryRateLimiter({
  limit: envLimit("RATE_LIMIT_SIGNUP_PER_HOUR", 5),
  windowMs: 60 * 60_000,
});
export const apiWriteLimiter = createMemoryRateLimiter({ limit: 120, windowMs: 60_000 });

export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}
