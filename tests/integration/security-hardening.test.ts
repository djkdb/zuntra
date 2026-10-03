import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { reserveBudgetForTesting } from "@/server/ai/guard";
import { clientIpFrom } from "@/server/rate-limit";
import { createJournalEntry, deleteJournalEntry, uploadPhoto } from "@/server/services/journal-service";
import { expectAppError } from "../helpers/assert";
import { createTestTrip, createUser, db, resetDb } from "../helpers/db";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

describe("AI daily budget", () => {
  it("cannot be overspent by parallel requests", async () => {
    const user = await createUser();
    // Budget is 0.5 USD/day; five parallel 0.2 USD reservations → only two fit.
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => reserveBudgetForTesting(user.id, "COMPANION", "gpt-5-mini", 0.2)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(await db.aIUsageLog.count({ where: { userId: user.id, errorCode: "PENDING" } })).toBe(2);
  });
});

describe("client IP detection", () => {
  it("prefers platform headers and ignores client-supplied left-most hops", () => {
    expect(clientIpFrom(new Headers({ "x-real-ip": "1.1.1.1", "x-forwarded-for": "6.6.6.6" }))).toBe("1.1.1.1");
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "6.6.6.6, 2.2.2.2" }))).toBe("2.2.2.2");
    expect(clientIpFrom(new Headers())).toBeNull();
  });
});

describe("shared trips", () => {
  it("editors cannot delete other members' journal entries or use their photos", async () => {
    const [owner, editor] = await Promise.all([createUser(), createUser()]);
    const { id } = await createTestTrip(owner.id);
    await db.tripMember.create({ data: { tripId: id, userId: editor.id, role: "EDITOR" } });
    const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
    const ownersPhoto = await uploadPhoto(id, owner.id, { bytes: PNG });
    const data = await createJournalEntry(id, owner.id, { content: "주인의 기록", date: "2026-11-03" });

    await expectAppError(deleteJournalEntry(id, editor.id, data.entries[0]!.id), "NOT_FOUND");
    await expectAppError(createJournalEntry(id, editor.id, { content: "x", date: "2026-11-03", photoIds: [ownersPhoto.id] }), "VALIDATION");
    // The owner can moderate.
    const mine = await createJournalEntry(id, editor.id, { content: "편집자의 기록", date: "2026-11-03" });
    const editorsEntry = mine.entries.find((e) => e.content === "편집자의 기록")!;
    await deleteJournalEntry(id, owner.id, editorsEntry.id);
    expect(await db.journalEntry.count()).toBe(1);
  });
});
