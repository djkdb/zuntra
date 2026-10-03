import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearAICacheForTesting, setAIProviderForTesting } from "@/server/ai/guard";
import { validatePlan } from "@/server/ai/plan-validation";
import type { AIProvider } from "@/server/ai/provider";
import { generatePlan } from "@/server/ai/trip-planner";
import { applyReschedule, proposeReschedule } from "@/server/ai/trip-rescheduler";
import { addItem, getItinerary } from "@/server/services/itinerary-service";
import { analyzeDay } from "@/lib/schedule";
import { expectAppError } from "../helpers/assert";
import { createTestTrip, createUser, db, resetDb } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
  clearAICacheForTesting();
  setAIProviderForTesting(undefined);
});
afterEach(() => setAIProviderForTesting(undefined));
afterAll(() => db.$disconnect());

describe("generatePlan (mock provider)", () => {
  it("fills every empty day with a feasible, validated plan", async () => {
    const user = await createUser();
    const { id } = await createTestTrip(user.id, { preferredFoods: ["라멘"], styles: ["FOOD", "PHOTO"], pace: "RELAXED" });

    const result = await generatePlan(id, user.id, { mode: "fill_empty", request: "맛집과 카페를 좋아하고 너무 빡빡한 일정은 싫어." });

    expect(result.days).toHaveLength(5);
    for (const day of result.days) {
      expect(day.items.length).toBeGreaterThan(0);
      expect(day.items.length).toBeLessThanOrEqual(6);
      expect(analyzeDay(day.items)).toEqual([]); // no overlaps, nothing past midnight
      expect(day.items.every((i) => i.source === "AI")).toBe(true);
    }
    const all = result.days.flatMap((d) => d.items.map((i) => i.title));
    expect(new Set(all).size).toBe(all.length); // no duplicate places across days
    expect(all.some((t) => t.includes("라멘"))).toBe(true); // preference reflected
    expect(result.days[4]!.items.at(-1)!.category).toBe("AIRPORT"); // last day ends with departure
    expect(await db.aIUsageLog.count({ where: { feature: "PLANNER", success: true } })).toBe(1);
    expect(await db.analyticsEvent.count({ where: { name: "generate_plan" } })).toBe(1);
  });

  it("keeps days that already have items when filling empty days", async () => {
    const user = await createUser();
    const { id } = await createTestTrip(user.id);
    const day1 = await db.day.findFirstOrThrow({ where: { tripId: id, dayNumber: 1 } });
    await addItem(id, user.id, { dayId: day1.id, title: "내 일정", category: "OTHER", startMinute: 600, durationMinutes: 60 });

    const result = await generatePlan(id, user.id, { mode: "fill_empty" });
    expect(result.days.map((d) => d.dayNumber)).toEqual([2, 3, 4, 5]);
    const itinerary = await getItinerary(id, user.id);
    expect(itinerary.days[0]!.items.map((i) => i.title)).toEqual(["내 일정"]);
  });

  it("rejects AI output that fails schema validation", async () => {
    const broken: AIProvider = {
      name: "mock",
      async generate() {
        return { data: { days: [{ dayNumber: 1, items: "not-an-array" }] }, model: "broken", usage: { inputTokens: 1, outputTokens: 1 } };
      },
    };
    setAIProviderForTesting(broken);
    const user = await createUser();
    const { id } = await createTestTrip(user.id);
    await expectAppError(generatePlan(id, user.id, { mode: "fill_empty" }), "AI_FAILED");
    expect(await db.itineraryItem.count()).toBe(0);
    const log = await db.aIUsageLog.findFirstOrThrow();
    expect(log.success).toBe(false);
    expect(log.errorCode).toBe("BAD_OUTPUT");
  });

  it("reports provider outages as AI_FAILED without writing", async () => {
    setAIProviderForTesting({
      name: "mock",
      async generate() {
        throw new Error("upstream down");
      },
    });
    const user = await createUser();
    const { id } = await createTestTrip(user.id);
    await expectAppError(generatePlan(id, user.id, { mode: "replace_all" }), "AI_FAILED");
  });

  it("is limited to trip editors", async () => {
    const [owner, other] = await Promise.all([createUser(), createUser()]);
    const { id } = await createTestTrip(owner.id);
    await expectAppError(generatePlan(id, other.id, { mode: "fill_empty" }), "NOT_FOUND");
  });
});

describe("validatePlan", () => {
  const item = (title: string, startTime: string, extra: Record<string, unknown> = {}) => ({
    title,
    category: "SIGHTSEEING" as const,
    startTime,
    durationMinutes: 120,
    transportMode: null,
    travelMinutesFromPrev: 10,
    estimatedCost: null,
    address: null,
    latitude: null,
    longitude: null,
    isIndoor: null,
    note: null,
    ...extra,
  });

  it("repairs overlaps, drops unknown days, far-away coordinates, duplicates and late stops", () => {
    const { days, warnings } = validatePlan(
      {
        summary: "",
        days: [
          {
            dayNumber: 1,
            title: "t",
            items: [
              item("B", "10:30"),
              item("A", "09:00"),
              item("A", "15:00"),
              item("Far", "13:00", { latitude: 48.85, longitude: 2.35 }),
              item("Late", "22:50"),
            ],
          },
          { dayNumber: 9, title: "x", items: [item("X", "10:00")] },
        ],
      },
      { dayNumbers: [1], pace: "MODERATE", center: { lat: 35.68, lng: 139.76 } },
    );
    expect(days).toHaveLength(1);
    const [a, b, far] = days[0]!.items;
    expect(days[0]!.items.map((i) => i.title)).toEqual(["A", "B", "Far"]);
    expect(b!.startMinute).toBe(a!.startMinute + 120 + 10); // pushed after A + travel
    expect(far!.latitude).toBeNull();
    expect(warnings.join(" ")).toContain("늦은 시간");
  });
});

describe("AI reschedule", () => {
  it("proposes a preview, then applies only after confirmation", async () => {
    const user = await createUser();
    const { id } = await createTestTrip(user.id);
    const day = await db.day.findFirstOrThrow({ where: { tripId: id, dayNumber: 2 } });
    const add = (title: string, startMinute: number, durationMinutes: number, category = "SIGHTSEEING") =>
      addItem(id, user.id, { dayId: day.id, title, category, startMinute, durationMinutes, travelMinutesFromPrev: 15 });
    await add("미술관", 600, 300);
    await add("쇼핑", 900, 120, "SHOPPING");
    await add("카페", 1080, 60, "CAFE");
    await add("저녁", 1200, 120, "FOOD");
    await add("야경", 1320, 90);

    const proposal = await proposeReschedule(id, user.id, { dayId: day.id, reason: "피곤해요" });
    expect(proposal.changes.length).toBeGreaterThan(0);
    expect(proposal.changes.some((c) => c.action === "REMOVE")).toBe(true);
    // Nothing changed yet.
    expect(await db.itineraryItem.count({ where: { dayId: day.id } })).toBe(5);

    const { days } = await applyReschedule(id, user.id, {
      dayId: day.id,
      changes: proposal.changes.map((c) => ({
        itemId: c.itemId,
        action: c.action,
        startMinute: c.to?.startMinute ?? null,
        durationMinutes: c.to?.durationMinutes ?? null,
      })),
    });
    expect(analyzeDay(days[0]!.items).filter((i) => i.type === "OVERLAP")).toEqual([]);
    expect(days[0]!.items.length).toBeLessThan(5);
  });

  it("refuses to apply changes to items of another day or trip", async () => {
    const a = await createUser();
    const { id } = await createTestTrip(a.id);
    const [d1, d2] = await db.day.findMany({ where: { tripId: id }, orderBy: { dayNumber: "asc" }, take: 2 });
    const { days } = await addItem(id, a.id, { dayId: d2!.id, title: "x", category: "OTHER", startMinute: 600, durationMinutes: 60 });
    await expectAppError(
      applyReschedule(id, a.id, { dayId: d1!.id, changes: [{ itemId: days[0]!.items[0]!.id, action: "REMOVE" }] }),
      "NOT_FOUND",
    );
  });
});
