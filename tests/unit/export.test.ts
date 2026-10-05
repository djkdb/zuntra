import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { itineraryToIcs, itineraryToCsv } = await import("@/server/export/trip-export");

const itinerary = {
  trip: { id: "t1", title: "도쿄, 3일", timezone: "Asia/Tokyo" },
  days: [
    {
      id: "d1",
      dayNumber: 1,
      date: "2026-11-03",
      title: null,
      items: [
        { id: "i1", title: "센소지; 아사쿠사", category: "SIGHTSEEING", startMinute: 600, durationMinutes: 90, travelMinutesFromPrev: null, transportMode: null, estimatedCost: null, note: "=HYPERLINK(\"x\")", status: "PLANNED", address: "2-3-1 Asakusa" },
      ],
    },
  ],
} as never;

describe("trip export", () => {
  it("writes events in UTC from the destination's local time", () => {
    const ics = itineraryToIcs(itinerary);
    expect(ics).toContain("DTSTART:20261103T010000Z"); // 10:00 in Tokyo
    expect(ics).toContain("DTEND:20261103T023000Z");
    expect(ics).toContain("SUMMARY:센소지\; 아사쿠사");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  });
  it("escapes CSV and neutralises formulas", () => {
    const csv = itineraryToCsv(itinerary);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("\"'=HYPERLINK(\"\"x\"\")\"");
  });
});
