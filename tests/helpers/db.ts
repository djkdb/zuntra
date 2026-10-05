import { db } from "@/server/db";
import { createTrip } from "@/server/services/trip-service";
import type { CreateTripInput } from "@/lib/validation/trip";

const TABLES = [
  "AnalyticsEvent",
  "StoredObject",
  "AIUsageLog",
  "AIAction",
  "AIMessage",
  "AIConversation",
  "TravelReport",
  "WeatherSnapshot",
  "TripPhoto",
  "JournalEntry",
  "PackingItem",
  "Expense",
  "Budget",
  "ItineraryItem",
  "Place",
  "Day",
  "TripMember",
  "Trip",
  "TravelProfile",
  "Session",
  "Account",
  "VerificationToken",
  "User",
];

export async function resetDb() {
  await db.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} CASCADE`);
}

let counter = 0;
export async function createUser(overrides: { email?: string; name?: string } = {}) {
  counter += 1;
  return db.user.create({
    data: {
      email: overrides.email ?? `user${counter}-${Date.now()}@example.com`,
      name: overrides.name ?? `User ${counter}`,
      onboardedAt: new Date(),
    },
  });
}

export const baseTripInput: CreateTripInput = {
  title: "도쿄 4박 5일",
  destination: "도쿄",
  timezone: "Asia/Tokyo",
  startDate: "2026-11-03",
  endDate: "2026-11-07",
  travelerCount: 2,
  styles: ["FOOD"],
  pace: "RELAXED",
  budgetAmount: 1_500_000,
  currency: "KRW",
  preferredPlaces: ["시부야"],
  preferredFoods: ["라멘"],
  purpose: undefined,
  notes: undefined,
};

export async function createTestTrip(userId: string, overrides: Partial<CreateTripInput> = {}) {
  return createTrip(userId, { ...baseTripInput, ...overrides });
}

export { db };
