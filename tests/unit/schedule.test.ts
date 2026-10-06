import { describe, expect, it } from "vitest";
import { estimateTravelMinutes, haversineKm, suggestMode } from "@/lib/geo";
import { analyzeDay, formatDelay, minuteFromTime, moveWithinDay, reflowDay } from "@/lib/schedule";

const item = (id: string, start: string, duration: number, travel: number | null = 10, status = "PLANNED") => ({
  id,
  startMinute: minuteFromTime(start)!,
  durationMinutes: duration,
  travelMinutesFromPrev: travel,
  status,
});

describe("analyzeDay", () => {
  it("finds overlaps including travel time", () => {
    const day = [item("a", "09:00", 120), item("b", "11:00", 60, 20), item("c", "12:30", 60, 10)];
    expect(analyzeDay(day)).toEqual([{ type: "OVERLAP", itemId: "b", minutes: 20 }]);
  });

  it("flags stops that run past midnight", () => {
    expect(analyzeDay([item("a", "23:30", 60)])).toEqual([{ type: "PAST_MIDNIGHT", itemId: "a", minutes: 30 }]);
  });
});

describe("reflowDay", () => {
  it("pushes later stops after a delay — the '1시간 더 있을래' case", () => {
    // 14:00 sightseeing extended to 3h20m; the rest of the day must slide.
    const day = [item("a", "14:00", 200), item("b", "16:00", 60, 20), item("c", "18:00", 90, 10)];
    const { changes, maxDelay } = reflowDay(day);
    expect(changes).toEqual([
      { id: "b", from: 960, to: 1060 },
      { id: "c", from: 1080, to: 1130 },
    ]);
    expect(maxDelay).toBe(100);
    expect(formatDelay(maxDelay)).toBe("1시간 40분");
  });

  it("keeps gaps and never pulls stops earlier", () => {
    const day = [item("a", "09:00", 60), item("b", "15:00", 60)];
    expect(reflowDay(day).changes).toEqual([]);
  });

  it("does not move finished stops", () => {
    const day = [item("a", "09:00", 180), item("b", "10:00", 60, 10, "DONE")];
    expect(reflowDay(day).changes).toEqual([]);
  });
});

describe("moveWithinDay", () => {
  it("gives the dragged stop the time slot it lands on", () => {
    const day = [item("a", "09:00", 60), item("b", "11:00", 60), item("c", "14:00", 60)];
    const moved = moveWithinDay(day, "c", 1);
    expect(moved.map((i) => [i.id, i.startMinute])).toEqual([
      ["a", 540],
      ["c", 660],
      ["b", 660],
    ]);
  });
});

describe("geo", () => {
  const shibuya = { lat: 35.658, lng: 139.7016 };
  const harajuku = { lat: 35.6702, lng: 139.7027 };
  const asakusa = { lat: 35.7148, lng: 139.7967 };
  it("estimates distances and travel times", () => {
    expect(haversineKm(shibuya, harajuku)).toBeCloseTo(1.36, 1);
    expect(suggestMode(shibuya, harajuku)).toBe("TRANSIT");
    expect(estimateTravelMinutes(shibuya, asakusa, "TRANSIT")).toBeGreaterThan(25);
    expect(estimateTravelMinutes(shibuya, harajuku, "WALK")).toBeGreaterThan(20);
  });
});

describe("fixed bookings", () => {
  it("reflow pushes stops but never moves a booking, reporting the clash instead", async () => {
    const { reflowDay } = await import("@/lib/schedule");
    const r = reflowDay([
      { id: "a", startMinute: 600, durationMinutes: 120, travelMinutesFromPrev: null },
      { id: "flight", startMinute: 690, durationMinutes: 60, travelMinutesFromPrev: 30, isFixed: true },
      { id: "b", startMinute: 700, durationMinutes: 60, travelMinutesFromPrev: 10 },
    ]);
    expect(r.items.find((i) => i.id === "flight")!.startMinute).toBe(690);
    // The stop before the flight ends in time for it; the one after moves past it.
    expect(r.changes).toEqual([
      { id: "a", from: 600, to: 600, durationTo: 60 },
      { id: "b", from: 700, to: 760 },
    ]);
    expect(r.blocked).toEqual([]);
  });
});

describe("reflow around bookings", () => {
  it("moves a stop that would run into a booking to after it", async () => {
    const { reflowDay } = await import("@/lib/schedule");
    const r = reflowDay([
      { id: "asakusa", startMinute: 540, durationMinutes: 120, travelMinutesFromPrev: null },
      { id: "ueno", startMinute: 600, durationMinutes: 60, travelMinutesFromPrev: 15 },
      { id: "sushi", startMinute: 660, durationMinutes: 60, travelMinutesFromPrev: 15, isFixed: true },
      { id: "akiba", startMinute: 690, durationMinutes: 60, travelMinutesFromPrev: 15 },
    ]);
    const at = Object.fromEntries(r.items.map((i) => [i.id, i.startMinute]));
    // 우에노 can't start before 11:15 and still make 스시 at 11:00 → after it.
    expect(at).toEqual({ asakusa: 540, ueno: 735, sushi: 660, akiba: 810 });
    // 아사쿠사 is cut to finish before 스시 (15 min to get there).
    expect(r.items.find((i) => i.id === "asakusa")!.durationMinutes).toBe(105);
    expect(r.blocked).toEqual([]);
  });
});

describe("overrunning into a booking", () => {
  it("shortens the stop before a booking instead of moving it", async () => {
    const { reflowDay } = await import("@/lib/schedule");
    const r = reflowDay([
      { id: "usj", startMinute: 510, durationMinutes: 360, travelMinutesFromPrev: null, isFixed: true },
      { id: "shopping", startMinute: 990, durationMinutes: 180, travelMinutesFromPrev: 30 },
      { id: "sushi", startMinute: 1140, durationMinutes: 90, travelMinutesFromPrev: 20, isFixed: true },
    ]);
    expect(r.changes).toEqual([{ id: "shopping", from: 990, to: 990, durationTo: 130 }]);
    expect(r.blocked).toEqual([]);
  });
});
