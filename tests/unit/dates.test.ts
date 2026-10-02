import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  diffDaysIso,
  eachDateIso,
  formatDDay,
  formatTripLength,
  getTripPhase,
  isValidIsoDate,
  isValidTimeZone,
  todayInTimeZone,
} from "@/lib/dates";

describe("ISO date helpers", () => {
  it("validates real calendar dates only", () => {
    expect(isValidIsoDate("2026-02-28")).toBe(true);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2026-2-3")).toBe(false);
    expect(isValidIsoDate("not a date")).toBe(false);
  });

  it("walks across month and year boundaries", () => {
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
    expect(diffDaysIso("2026-10-30", "2026-11-02")).toBe(3);
    expect(eachDateIso("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(eachDateIso("2026-11-02", "2026-11-01")).toEqual([]);
  });

  it("formats trip length in Korean nights/days", () => {
    expect(formatTripLength("2026-11-03", "2026-11-07")).toBe("4박 5일");
    expect(formatTripLength("2026-11-03", "2026-11-03")).toBe("당일치기");
  });

  it("computes D-day labels", () => {
    expect(formatDDay("2026-11-03", "2026-10-22")).toBe("D-12");
    expect(formatDDay("2026-11-03", "2026-11-03")).toBe("D-DAY");
    expect(formatDDay("2026-11-03", "2026-11-05")).toBe("D+2");
  });
});

describe("time zones", () => {
  it("returns the local calendar date of the destination", () => {
    // 2026-10-02 20:30 UTC is already Oct 3 in Tokyo but still Oct 2 in Los Angeles.
    const now = new Date("2026-10-02T20:30:00Z");
    expect(todayInTimeZone("Asia/Tokyo", now)).toBe("2026-10-03");
    expect(todayInTimeZone("America/Los_Angeles", now)).toBe("2026-10-02");
  });

  it("rejects unknown zones", () => {
    expect(isValidTimeZone("Asia/Seoul")).toBe(true);
    expect(isValidTimeZone("Mars/Base")).toBe(false);
  });
});

describe("getTripPhase", () => {
  const trip = { startDate: "2026-11-03", endDate: "2026-11-07", status: "ACTIVE" };
  it.each([
    ["2026-11-02", "upcoming"],
    ["2026-11-03", "ongoing"],
    ["2026-11-07", "ongoing"],
    ["2026-11-08", "past"],
  ])("on %s is %s", (today, phase) => {
    expect(getTripPhase(trip, today)).toBe(phase);
  });
  it("is completed once the user ends the trip", () => {
    expect(getTripPhase({ ...trip, status: "COMPLETED" }, "2026-11-05")).toBe("completed");
  });
});
