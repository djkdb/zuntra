import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/action-state";
import { formatDuration, formatMinute } from "@/lib/itinerary";
import { guessTimeZone } from "@/lib/timezone-guess";
import { groupTripsByPhase, pickFocusTrip } from "@/lib/trips";
import { createMemoryRateLimiter } from "@/server/rate-limit";

describe("safeRedirectPath", () => {
  it.each([
    ["/trips/abc", "/trips/abc"],
    ["https://evil.example", "/dashboard"],
    ["//evil.example", "/dashboard"],
    ["/\\evil.example", "/dashboard"],
    [undefined, "/dashboard"],
  ])("%s → %s", (input, expected) => {
    expect(safeRedirectPath(input, "/dashboard")).toBe(expected);
  });
});

describe("trip focus", () => {
  const now = new Date("2026-11-05T03:00:00Z");
  const trip = (id: string, startDate: string, endDate: string, status = "ACTIVE") => ({
    id,
    startDate,
    endDate,
    status,
    timezone: "Asia/Seoul",
  });

  it("prefers the ongoing trip, then the nearest upcoming one", () => {
    const trips = [trip("later", "2026-12-01", "2026-12-03"), trip("now", "2026-11-04", "2026-11-06"), trip("soon", "2026-11-20", "2026-11-22")];
    expect(pickFocusTrip(trips, now)?.id).toBe("now");
    expect(pickFocusTrip(trips.filter((t) => t.id !== "now"), now)?.id).toBe("soon");
    expect(pickFocusTrip([trip("past", "2026-01-01", "2026-01-02")], now)).toBeNull();
  });

  it("groups completed trips with past ones", () => {
    const groups = groupTripsByPhase([trip("done", "2026-11-04", "2026-11-06", "COMPLETED")], now);
    expect(groups.past.map((t) => t.id)).toEqual(["done"]);
  });
});

describe("rate limiter", () => {
  it("blocks after the limit and recovers after reset", async () => {
    const limiter = createMemoryRateLimiter({ limit: 2, windowMs: 60_000 });
    expect((await limiter.consume("k")).ok).toBe(true);
    expect((await limiter.consume("k")).ok).toBe(true);
    const blocked = await limiter.consume("k");
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    await limiter.reset("k");
    expect((await limiter.consume("k")).ok).toBe(true);
  });
});

describe("misc formatting", () => {
  it("formats minutes and durations", () => {
    expect(formatMinute(9 * 60 + 5)).toBe("09:05");
    expect(formatDuration(45)).toBe("45분");
    expect(formatDuration(120)).toBe("2시간");
    expect(formatDuration(90)).toBe("1시간 30분");
  });

  it("guesses destination time zones", () => {
    expect(guessTimeZone("도쿄")).toBe("Asia/Tokyo");
    expect(guessTimeZone("다낭 가족여행")).toBe("Asia/Ho_Chi_Minh");
    expect(guessTimeZone("어딘가")).toBeNull();
  });
});
