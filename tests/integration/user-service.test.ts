import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { verifyPassword } from "@/server/auth/password";
import { AppError } from "@/server/errors";
import { deleteAccount, registerUser, saveTravelProfile } from "@/server/services/user-service";
import { createTestTrip, db, resetDb } from "../helpers/db";

beforeEach(resetDb);
afterAll(() => db.$disconnect());

const profile = {
  name: "민지",
  styles: ["FOOD" as const, "PHOTO" as const],
  pace: "RELAXED" as const,
  budgetLevel: "STANDARD" as const,
  favoriteFoods: ["라멘"],
  companionType: "FRIENDS" as const,
};

describe("registerUser", () => {
  it("stores a bcrypt hash, never the password", async () => {
    const user = await registerUser({ name: "민지", email: "minji@example.com", password: "travel123" });
    const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.passwordHash).not.toContain("travel123");
    expect(await verifyPassword("travel123", row.passwordHash)).toBe(true);
    expect(await verifyPassword("wrong-pass1", row.passwordHash)).toBe(false);
    expect(row.onboardedAt).toBeNull();
  });

  it("rejects a duplicate email with a conflict", async () => {
    await registerUser({ name: "a", email: "dup@example.com", password: "travel123" });
    const error = await registerUser({ name: "b", email: "dup@example.com", password: "travel123" }).catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect(error.code).toBe("CONFLICT");
  });
});

describe("saveTravelProfile", () => {
  it("completes onboarding once and updates the profile afterwards", async () => {
    const user = await registerUser({ name: "a", email: "p@example.com", password: "travel123" });
    await saveTravelProfile(user.id, profile);
    const first = await db.user.findUniqueOrThrow({ where: { id: user.id }, include: { travelProfile: true } });
    expect(first.name).toBe("민지");
    expect(first.onboardedAt).not.toBeNull();
    expect(first.travelProfile?.styles).toEqual(["FOOD", "PHOTO"]);

    await saveTravelProfile(user.id, { ...profile, pace: "PACKED" });
    const second = await db.user.findUniqueOrThrow({ where: { id: user.id }, include: { travelProfile: true } });
    expect(second.onboardedAt).toEqual(first.onboardedAt);
    expect(second.travelProfile?.pace).toBe("PACKED");
    expect(await db.analyticsEvent.count({ where: { name: "complete_onboarding" } })).toBe(1);
  });
});

describe("deleteAccount", () => {
  it("removes the user, their trips and profile but keeps anonymized analytics", async () => {
    const user = await registerUser({ name: "a", email: "del@example.com", password: "travel123" });
    await saveTravelProfile(user.id, profile);
    await createTestTrip(user.id);

    await deleteAccount(user.id);

    expect(await db.user.count()).toBe(0);
    expect(await db.trip.count()).toBe(0);
    expect(await db.travelProfile.count()).toBe(0);
    const events = await db.analyticsEvent.findMany();
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.userId === null)).toBe(true);
  });
});
