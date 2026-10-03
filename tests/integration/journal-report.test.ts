import { rm } from "node:fs/promises";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { clearAICacheForTesting } from "@/server/ai/guard";
import { completeTrip, generateReport, getReport, reopenTrip } from "@/server/ai/travel-reporter";
import { addExpense } from "@/server/services/budget-service";
import { addItem, updateItem } from "@/server/services/itinerary-service";
import { createJournalEntry, deleteJournalEntry, getJournal, readPhoto, uploadPhoto } from "@/server/services/journal-service";
import { expectAppError } from "../helpers/assert";
import { createTestTrip, createUser, db, resetDb } from "../helpers/db";

// Minimal valid image headers (content doesn't need to decode for storage tests).
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3]);
const WEBP = new Uint8Array([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBP"), 1, 2, 3]);

beforeEach(async () => {
  await resetDb();
  clearAICacheForTesting();
});
afterAll(async () => {
  await rm(".storage-test", { recursive: true, force: true });
  await db.$disconnect();
});

describe("journal & photos", () => {
  it("creates entries linked to day, place and photos", async () => {
    const user = await createUser();
    const { id } = await createTestTrip(user.id);
    const day = await db.day.findFirstOrThrow({ where: { tripId: id, dayNumber: 1 } });
    const { days } = await addItem(id, user.id, { dayId: day.id, title: "이치란 라멘", category: "FOOD", startMinute: 720, durationMinutes: 60 });
    const photo = await uploadPhoto(id, user.id, { bytes: WEBP, width: 800, height: 600 });

    const data = await createJournalEntry(id, user.id, {
      content: "오늘 시부야에서 먹은 라멘 진짜 맛있었다.",
      mood: "HAPPY",
      rating: 5,
      date: "2026-11-03",
      itemId: days[0]!.items[0]!.id,
      photoIds: [photo.id],
    });
    const entry = data.entries[0]!;
    expect(entry).toMatchObject({ dayNumber: 1, rating: 5, mood: "HAPPY", place: { name: "이치란 라멘" } });
    expect(entry.photos.map((p) => p.url)).toEqual([`/api/photos/${photo.id}`]);
    expect(await db.analyticsEvent.count({ where: { name: "create_journal" } })).toBe(1);

    const stored = await readPhoto(photo.id, user.id);
    expect(stored.contentType).toBe("image/webp");
  });

  it("rejects non-images and oversized files by content, not by name", async () => {
    const user = await createUser();
    const { id } = await createTestTrip(user.id);
    await expectAppError(uploadPhoto(id, user.id, { bytes: new TextEncoder().encode("<script>alert(1)</script> fake png") }), "VALIDATION");
    await expectAppError(uploadPhoto(id, user.id, { bytes: new Uint8Array(9 * 1024 * 1024).fill(0xff) }), "VALIDATION");
    expect(await db.tripPhoto.count()).toBe(0);
  });

  it("never serves or attaches photos across trips", async () => {
    const [a, b] = await Promise.all([createUser(), createUser()]);
    const { id: tripA } = await createTestTrip(a.id);
    const { id: tripB } = await createTestTrip(b.id);
    const photoA = await uploadPhoto(tripA, a.id, { bytes: PNG });

    await expectAppError(readPhoto(photoA.id, b.id), "NOT_FOUND");
    await expectAppError(
      createJournalEntry(tripB, b.id, { content: "훔친 사진", date: "2026-11-03", photoIds: [photoA.id] }),
      "VALIDATION",
    );
    await expectAppError(getJournal(tripA, b.id), "NOT_FOUND");
  });

  it("deletes an entry together with its photos", async () => {
    const user = await createUser();
    const { id } = await createTestTrip(user.id);
    const photo = await uploadPhoto(id, user.id, { bytes: PNG });
    const data = await createJournalEntry(id, user.id, { content: "메모", date: "2026-11-04", photoIds: [photo.id] });
    await deleteJournalEntry(id, user.id, data.entries[0]!.id);
    expect(await db.tripPhoto.count()).toBe(0);
    await expectAppError(readPhoto(photo.id, user.id), "NOT_FOUND");
  });
});

describe("trip completion & travel report", () => {
  it("summarises places, spending, highlights and an AI retrospective", async () => {
    const user = await createUser();
    const { id } = await createTestTrip(user.id, { budgetAmount: 1_000_000, travelerCount: 2 });
    const d1 = await db.day.findFirstOrThrow({ where: { tripId: id, dayNumber: 1 } });
    const add = (title: string, category: string, startMinute: number) =>
      addItem(id, user.id, { dayId: d1.id, title, category, startMinute, durationMinutes: 90 });
    await add("센소지", "CULTURE", 540);
    await add("라멘", "FOOD", 720);
    await add("블루보틀", "CAFE", 900);
    const { days } = await add("스시", "FOOD", 1100);
    for (const item of days[0]!.items) await updateItem(id, user.id, item.id, { status: "DONE" });
    await addExpense(id, user.id, { title: "라멘", category: "FOOD", amount: 30000, date: "2026-11-03" });
    await addExpense(id, user.id, { title: "호텔", category: "LODGING", amount: 400000, date: "2026-11-03" });
    const sushi = days[0]!.items.find((i) => i.title === "스시")!;
    await createJournalEntry(id, user.id, { content: "인생 스시", rating: 5, mood: "AMAZING", date: "2026-11-03", itemId: sushi.id });

    await expectAppError(generateReport(id, user.id), "CONFLICT"); // not completed yet
    const report = await completeTrip(id, user.id);

    expect(report.stats).toMatchObject({ days: 5, places: 4, totalSpent: 430_000, perPerson: 215_000, budget: 1_000_000, journalEntries: 1 });
    expect(report.highlights.favoriteFood).toBe("스시");
    expect(report.highlights.topCategory).toMatchObject({ category: "FOOD", count: 2 });
    expect(report.ai.retrospective).toContain("카페와 맛집을 중심으로");
    expect((await db.trip.findUniqueOrThrow({ where: { id } })).status).toBe("COMPLETED");
    expect(await getReport(id, user.id)).toMatchObject({ version: 1 });
    expect(await db.analyticsEvent.count({ where: { name: "complete_trip" } })).toBe(1);

    // Completing again does not double count; reopening works.
    await completeTrip(id, user.id);
    expect(await db.analyticsEvent.count({ where: { name: "complete_trip" } })).toBe(1);
    await reopenTrip(id, user.id);
    expect((await db.trip.findUniqueOrThrow({ where: { id } })).status).toBe("ACTIVE");
  });

  it("keeps reports private to trip members", async () => {
    const [a, b] = await Promise.all([createUser(), createUser()]);
    const { id } = await createTestTrip(a.id);
    await completeTrip(id, a.id);
    await expectAppError(getReport(id, b.id), "NOT_FOUND");
    await expectAppError(completeTrip(id, b.id), "NOT_FOUND");
  });
});
