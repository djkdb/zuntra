import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { fromDbDate } from "@/lib/dates";
import { AppError } from "@/server/errors";
import { deleteTrip, getTrip, listTrips, updateTrip } from "@/server/services/trip-service";
import { createTestTrip, createUser, db, resetDb } from "../helpers/db";

async function expectAppError(promise: Promise<unknown>, code: AppError["code"]) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
  return error as AppError;
}

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("createTrip", () => {
  it("creates the trip with owner membership, one Day per date and a budget", async () => {
    const user = await createUser();
    const { id } = await createTestTrip(user.id);

    const trip = await getTrip(id, user.id);
    expect(trip.role).toBe("OWNER");
    expect(trip.days.map((d) => [d.dayNumber, d.date])).toEqual([
      [1, "2026-11-03"],
      [2, "2026-11-04"],
      [3, "2026-11-05"],
      [4, "2026-11-06"],
      [5, "2026-11-07"],
    ]);
    expect(trip.budgetAmount).toBe(1_500_000);
    expect(await db.analyticsEvent.count({ where: { name: "create_trip", userId: user.id } })).toBe(1);
  });

  it("rejects invalid input with field errors and writes nothing", async () => {
    const user = await createUser();
    const error = await expectAppError(createTestTrip(user.id, { endDate: "2026-10-01" }), "VALIDATION");
    expect(error.fields?.endDate).toBeDefined();
    expect(await db.trip.count()).toBe(0);
  });
});

describe("access control (IDOR)", () => {
  it("lists only trips the user belongs to", async () => {
    const [alice, bob] = await Promise.all([createUser(), createUser()]);
    await createTestTrip(alice.id, { title: "Alice trip" });
    await createTestTrip(bob.id, { title: "Bob trip" });

    expect((await listTrips(alice.id)).map((t) => t.title)).toEqual(["Alice trip"]);
    expect((await listTrips(bob.id)).map((t) => t.title)).toEqual(["Bob trip"]);
  });

  it("reports someone else's trip as not found for read, update and delete", async () => {
    const [alice, mallory] = await Promise.all([createUser(), createUser()]);
    const { id } = await createTestTrip(alice.id);

    await expectAppError(getTrip(id, mallory.id), "NOT_FOUND");
    await expectAppError(updateTrip(id, mallory.id, { title: "pwned" }), "NOT_FOUND");
    await expectAppError(deleteTrip(id, mallory.id), "NOT_FOUND");
    expect((await db.trip.findUniqueOrThrow({ where: { id } })).title).toBe("도쿄 4박 5일");
  });

  it("enforces member roles: viewers cannot edit, editors cannot delete", async () => {
    const [owner, viewer, editor] = await Promise.all([createUser(), createUser(), createUser()]);
    const { id } = await createTestTrip(owner.id);
    await db.tripMember.createMany({
      data: [
        { tripId: id, userId: viewer.id, role: "VIEWER" },
        { tripId: id, userId: editor.id, role: "EDITOR" },
      ],
    });

    expect((await getTrip(id, viewer.id)).role).toBe("VIEWER");
    await expectAppError(updateTrip(id, viewer.id, { title: "x" }), "FORBIDDEN");
    await updateTrip(id, editor.id, { title: "편집자가 바꾼 이름" });
    await expectAppError(deleteTrip(id, editor.id), "FORBIDDEN");
    expect((await getTrip(id, owner.id)).title).toBe("편집자가 바꾼 이름");
  });
});

describe("updateTrip", () => {
  it("extends and shifts dates while keeping existing Day rows", async () => {
    const user = await createUser();
    const { id } = await createTestTrip(user.id);
    const before = await db.day.findMany({ where: { tripId: id }, orderBy: { date: "asc" } });

    await updateTrip(id, user.id, { startDate: "2026-11-05", endDate: "2026-11-09" });

    const after = await db.day.findMany({ where: { tripId: id }, orderBy: { date: "asc" } });
    expect(after.map((d) => [d.dayNumber, fromDbDate(d.date)])).toEqual([
      [1, "2026-11-05"],
      [2, "2026-11-06"],
      [3, "2026-11-07"],
      [4, "2026-11-08"],
      [5, "2026-11-09"],
    ]);
    // Nov 5–7 kept their ids (and so would keep their itinerary items).
    const keptIds = before.filter((d) => fromDbDate(d.date) >= "2026-11-05").map((d) => d.id);
    expect(after.slice(0, 3).map((d) => d.id)).toEqual(keptIds);
  });

  it("refuses to drop a day that still has itinerary items", async () => {
    const user = await createUser();
    const { id } = await createTestTrip(user.id);
    const lastDay = await db.day.findFirstOrThrow({ where: { tripId: id, dayNumber: 5 } });
    await db.itineraryItem.create({
      data: { dayId: lastDay.id, title: "하네다 공항", position: 0, startMinute: 600 },
    });

    const error = await expectAppError(updateTrip(id, user.id, { endDate: "2026-11-06" }), "CONFLICT");
    expect(error.message).toContain("11월 7일");
    expect(await db.day.count({ where: { tripId: id } })).toBe(5);
  });

  it("validates the merged date range against stored values", async () => {
    const user = await createUser();
    const { id } = await createTestTrip(user.id);
    await expectAppError(updateTrip(id, user.id, { startDate: "2026-11-10" }), "VALIDATION");
  });

  it("clears the budget with null and keeps it when omitted", async () => {
    const user = await createUser();
    const { id } = await createTestTrip(user.id);

    await updateTrip(id, user.id, { currency: "JPY" });
    const budget = await db.budget.findUniqueOrThrow({ where: { tripId: id } });
    expect(budget.currency).toBe("JPY");

    await updateTrip(id, user.id, { budgetAmount: null });
    expect(await db.budget.count({ where: { tripId: id } })).toBe(0);
    expect((await getTrip(id, user.id)).budgetAmount).toBeNull();
  });
});

describe("deleteTrip", () => {
  it("cascades to days, items, members and budget", async () => {
    const user = await createUser();
    const { id } = await createTestTrip(user.id);
    const day = await db.day.findFirstOrThrow({ where: { tripId: id } });
    await db.itineraryItem.create({ data: { dayId: day.id, title: "x", position: 0, startMinute: 0 } });

    await deleteTrip(id, user.id);

    expect(await db.trip.count()).toBe(0);
    expect(await db.day.count()).toBe(0);
    expect(await db.itineraryItem.count()).toBe(0);
    expect(await db.tripMember.count()).toBe(0);
    expect(await db.budget.count()).toBe(0);
  });
});
