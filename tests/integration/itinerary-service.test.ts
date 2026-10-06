import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  addItem,
  deleteItem,
  getItinerary,
  moveItem,
  reflowItineraryDay,
  updateItem,
} from "@/server/services/itinerary-service";
import { expectAppError } from "../helpers/assert";
import { createTestTrip, createUser, db, resetDb } from "../helpers/db";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

async function setup() {
  const user = await createUser();
  const { id: tripId } = await createTestTrip(user.id);
  const days = await db.day.findMany({ where: { tripId }, orderBy: { dayNumber: "asc" } });
  return { user, tripId, day1: days[0]!.id, day2: days[1]!.id };
}

const stop = (dayId: string, title: string, startMinute: number, extra: Record<string, unknown> = {}) => ({
  dayId,
  title,
  category: "SIGHTSEEING",
  startMinute,
  durationMinutes: 60,
  ...extra,
});

describe("addItem", () => {
  it("inserts stops in time order and creates places for addresses", async () => {
    const { user, tripId, day1 } = await setup();
    await addItem(tripId, user.id, stop(day1, "점심", 12 * 60));
    await addItem(tripId, user.id, stop(day1, "아침 산책", 9 * 60));
    const { days } = await addItem(tripId, user.id, stop(day1, "시부야", 15 * 60, { address: "Shibuya, Tokyo", latitude: 35.658, longitude: 139.7016 }));

    expect(days[0]!.items.map((i) => [i.position, i.title])).toEqual([
      [0, "아침 산책"],
      [1, "점심"],
      [2, "시부야"],
    ]);
    expect(days[0]!.items[2]!.address).toBe("Shibuya, Tokyo");
    expect(await db.place.count({ where: { tripId } })).toBe(1);
  });

  it("estimates travel time between stops with coordinates", async () => {
    const { user, tripId, day1 } = await setup();
    await addItem(tripId, user.id, stop(day1, "시부야", 600, { latitude: 35.658, longitude: 139.7016 }));
    const { days } = await addItem(tripId, user.id, stop(day1, "아사쿠사", 780, { latitude: 35.7148, longitude: 139.7967 }));
    const second = days[0]!.items[1]!;
    expect(second.transportMode).toBe("TRANSIT");
    expect(second.travelMinutesFromPrev).toBeGreaterThan(20);
  });

  it("validates input", async () => {
    const { user, tripId, day1 } = await setup();
    const error = await expectAppError(addItem(tripId, user.id, stop(day1, "", 1500)), "VALIDATION");
    expect(Object.keys(error.fields!)).toEqual(expect.arrayContaining(["title", "startMinute"]));
  });
});

describe("item access control", () => {
  it("cannot touch items or days of another trip through its own trip id", async () => {
    const a = await setup();
    const b = await setup();
    const { days } = await addItem(a.tripId, a.user.id, stop(a.day1, "A의 일정", 600));
    const itemOfA = days[0]!.items[0]!.id;

    // B uses their own trip id with A's item/day ids.
    await expectAppError(updateItem(b.tripId, b.user.id, itemOfA, { title: "hacked" }), "NOT_FOUND");
    await expectAppError(deleteItem(b.tripId, b.user.id, itemOfA), "NOT_FOUND");
    await expectAppError(moveItem(b.tripId, b.user.id, { itemId: itemOfA, toDayId: b.day1, toIndex: 0 }), "NOT_FOUND");
    await expectAppError(addItem(b.tripId, b.user.id, stop(a.day1, "침입", 600)), "NOT_FOUND");
    // And A's trip id directly.
    await expectAppError(getItinerary(a.tripId, b.user.id), "NOT_FOUND");

    expect((await db.itineraryItem.findUniqueOrThrow({ where: { id: itemOfA } })).title).toBe("A의 일정");
  });

  it("blocks viewers from editing", async () => {
    const { user, tripId, day1 } = await setup();
    const viewer = await createUser();
    await db.tripMember.create({ data: { tripId, userId: viewer.id, role: "VIEWER" } });
    await addItem(tripId, user.id, stop(day1, "x", 600));
    expect((await getItinerary(tripId, viewer.id)).days[0]!.items).toHaveLength(1);
    await expectAppError(addItem(tripId, viewer.id, stop(day1, "y", 700)), "FORBIDDEN");
  });
});

describe("editing", () => {
  it("re-sorts a day when a time changes and marks completion", async () => {
    const { user, tripId, day1 } = await setup();
    await addItem(tripId, user.id, stop(day1, "A", 600));
    const { days } = await addItem(tripId, user.id, stop(day1, "B", 720));
    const a = days[0]!.items[0]!.id;

    const moved = await updateItem(tripId, user.id, a, { startMinute: 800 });
    expect(moved.days[0]!.items.map((i) => i.title)).toEqual(["B", "A"]);

    const done = await updateItem(tripId, user.id, a, { status: "DONE" });
    expect(done.days[0]!.items.find((i) => i.id === a)!.status).toBe("DONE");
    expect(await db.analyticsEvent.count({ where: { name: "complete_itinerary" } })).toBe(1);
  });

  it("moves within a day (slot time) and across days, renumbering both", async () => {
    const { user, tripId, day1, day2 } = await setup();
    await addItem(tripId, user.id, stop(day1, "A", 540));
    await addItem(tripId, user.id, stop(day1, "B", 660));
    const { days } = await addItem(tripId, user.id, stop(day1, "C", 840));
    const c = days[0]!.items[2]!.id;

    const within = await moveItem(tripId, user.id, { itemId: c, toDayId: day1, toIndex: 1 });
    expect(within.days[0]!.items.map((i) => [i.title, i.startMinute, i.position])).toEqual([
      ["A", 540, 0],
      ["C", 660, 1],
      ["B", 660, 2],
    ]);

    const across = await moveItem(tripId, user.id, { itemId: c, toDayId: day2, toIndex: 0 });
    const [target, source] = across.days;
    expect(target!.id).toBe(day2);
    expect(target!.items.map((i) => i.title)).toEqual(["C"]);
    expect(source!.items.map((i) => [i.title, i.position])).toEqual([
      ["A", 0],
      ["B", 1],
    ]);
  });

  it("auto-adjusts later stops after a delay", async () => {
    const { user, tripId, day1 } = await setup();
    const first = await addItem(tripId, user.id, stop(day1, "시부야", 14 * 60, { durationMinutes: 120 }));
    await addItem(tripId, user.id, stop(day1, "카페", 16 * 60 + 20, { travelMinutesFromPrev: 15 }));
    await addItem(tripId, user.id, stop(day1, "저녁", 19 * 60, { travelMinutesFromPrev: 10 }));
    // Stay 1 hour longer at Shibuya.
    await updateItem(tripId, user.id, first.days[0]!.items[0]!.id, { durationMinutes: 180 });

    const result = await reflowItineraryDay(tripId, user.id, day1, {});
    expect(result.maxDelay).toBe(55);
    expect(result.days[0]!.items.map((i) => i.startMinute)).toEqual([840, 1035, 1140]);
  });

  it("deletes and removes orphaned places", async () => {
    const { user, tripId, day1 } = await setup();
    const { days } = await addItem(tripId, user.id, stop(day1, "A", 600, { address: "somewhere" }));
    await deleteItem(tripId, user.id, days[0]!.items[0]!.id);
    expect(await db.itineraryItem.count()).toBe(0);
    expect(await db.place.count()).toBe(0);
  });
});

describe("concurrent edits", () => {
  it("keeps both edits to different fields and rejects a stale overwrite", async () => {
    const { user, tripId, day1 } = await setup();
    const { days } = await addItem(tripId, user.id, stop(day1, "이치란 본점", 720));
    const opened = days[0]!.items[0]!;

    // Two editors opened the same version; A changes the note, B the cost.
    await updateItem(tripId, user.id, opened.id, { note: "줄 길면 2호점", expectedUpdatedAt: opened.updatedAt });
    const error = await expectAppError(
      updateItem(tripId, user.id, opened.id, { estimatedCost: 55000, expectedUpdatedAt: opened.updatedAt }),
      "CONFLICT",
    );
    expect(error.status).toBe(409);

    // Without a version (e.g. the done checkbox) a single-field patch still applies.
    await updateItem(tripId, user.id, opened.id, { estimatedCost: 55000 });
    const item = (await getItinerary(tripId, user.id)).days[0]!.items[0]!;
    expect(item.note).toBe("줄 길면 2호점");
    expect(item.estimatedCost).toBe(55000);
  });

  it("rejects junk that used to be coerced into numbers", async () => {
    const { user, tripId, day1 } = await setup();
    await expectAppError(addItem(tripId, user.id, stop(day1, "x", 600, { durationMinutes: true })), "VALIDATION");
    const { days } = await addItem(tripId, user.id, stop(day1, "y", 600));
    await expectAppError(updateItem(tripId, user.id, days[0]!.items[0]!.id, { startMinute: "" }), "VALIDATION");
  });
});

describe("per-day city", () => {
  it("sets a city for a day and the days after, keeping titles", async () => {
    const { getItinerary, updateDay } = await import("@/server/services/itinerary-service");
    const user = await createUser();
    const { id } = await createTestTrip(user.id);
    const days = (await getItinerary(id, user.id)).days;
    await updateDay(id, user.id, days[0]!.id, { title: "도착" });
    const result = await updateDay(id, user.id, days[2]!.id, { city: "교토", applyToFollowing: true });
    expect(result.days.map((d) => d.city)).toEqual(["교토", "교토", "교토"]);
    const after = (await getItinerary(id, user.id)).days;
    expect(after.map((d) => d.city ?? null)).toEqual([null, null, "교토", "교토", "교토"]);
    expect(after[0]!.title).toBe("도착");
    const row = await db.day.findUniqueOrThrow({ where: { id: days[2]!.id } });
    expect(row.cityLat).not.toBeNull(); // geocoded (mock catalog)
    await updateDay(id, user.id, days[4]!.id, { city: null });
    expect((await getItinerary(id, user.id)).days[4]!.city ?? null).toBeNull();
  });
});
