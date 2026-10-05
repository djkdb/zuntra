import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { clearAICacheForTesting } from "@/server/ai/guard";
import { analyzeSpending } from "@/server/ai/trip-analyzer";
import { addExpense, deleteExpense, getBudget, setBudget, updateExpense } from "@/server/services/budget-service";
import { addPackingItem, deletePackingItem, generatePacking, getPacking, updatePackingItem } from "@/server/services/packing-service";
import { getTripWeather } from "@/server/services/weather-service";
import { addItem } from "@/server/services/itinerary-service";
import { expectAppError } from "../helpers/assert";
import { createTestTrip, createUser, db, resetDb } from "../helpers/db";

beforeEach(async () => {
  await resetDb();
  clearAICacheForTesting();
});
afterAll(() => db.$disconnect());

describe("budget", () => {
  it("records expenses, links them to days and summarises them", async () => {
    const user = await createUser();
    const { id } = await createTestTrip(user.id, { budgetAmount: 1_000_000, travelerCount: 2 });
    await addExpense(id, user.id, { title: "라멘", category: "FOOD", amount: "12,000", date: "2026-11-03" });
    await addExpense(id, user.id, { title: "스카이트리", category: "SIGHTSEEING", amount: 30000, date: "2026-11-04" });
    const data = await addExpense(id, user.id, { title: "호텔", category: "LODGING", amount: 200000, date: "2026-11-03" });

    expect(data.summary.spent).toBe(242_000);
    expect(data.summary.usedPct).toBe(24.2);
    expect(data.summary.perPerson).toBe(121_000);
    expect(data.summary.byDay.slice(0, 2).map((d) => d.amount)).toEqual([212_000, 30_000]);
    expect(data.expenses.find((e) => e.title === "라멘")!.dayNumber).toBe(1);
    expect(data.summary.insights[0]!.text).toContain("242,000");
    expect(await db.analyticsEvent.count({ where: { name: "add_expense" } })).toBe(3);
  });

  it("validates, updates and deletes only within the trip", async () => {
    const [a, b] = await Promise.all([createUser(), createUser()]);
    const { id } = await createTestTrip(a.id);
    const { id: other } = await createTestTrip(b.id);
    await expectAppError(addExpense(id, a.id, { title: "커피", category: "FOOD", amount: 5000, date: "1999-01-01" }), "VALIDATION");
    await expectAppError(addExpense(id, a.id, { title: "커피", category: "FOOD", amount: 0.001, date: "2026-11-03" }), "VALIDATION");
    await expectAppError(addExpense(id, a.id, { title: "커피", category: "FOOD", amount: true, date: "2026-11-03" }), "VALIDATION");
    await expectAppError(addExpense(id, a.id, { title: "", category: "FOOD", amount: -1, date: "x" }), "VALIDATION");
    const data = await addExpense(id, a.id, { title: "커피", category: "FOOD", amount: 5000, date: "2026-11-03" });
    const expenseId = data.expenses[0]!.id;

    await expectAppError(updateExpense(other, b.id, expenseId, { amount: 1 }), "NOT_FOUND");
    await expectAppError(deleteExpense(other, b.id, expenseId), "NOT_FOUND");
    await expectAppError(getBudget(id, b.id), "NOT_FOUND");

    const updated = await updateExpense(id, a.id, expenseId, { amount: 6000, date: "2026-11-05" });
    expect(updated.expenses[0]).toMatchObject({ amount: 6000, dayNumber: 3 });
    expect((await deleteExpense(id, a.id, expenseId)).expenses).toEqual([]);
  });

  it("rejects allocations above the total and flags overspent categories", async () => {
    const user = await createUser();
    const { id } = await createTestTrip(user.id);
    await expectAppError(setBudget(id, user.id, { totalAmount: 100, allocations: { FOOD: 80, LODGING: 50 } }), "VALIDATION");
    await setBudget(id, user.id, { totalAmount: 1_000_000, allocations: { FOOD: 100_000 } });
    const data = await addExpense(id, user.id, { title: "오마카세", category: "FOOD", amount: 180_000, date: "2026-11-03" });
    expect(data.summary.byCategory.find((c) => c.category === "FOOD")).toMatchObject({ amount: 180_000, allocation: 100_000 });
    expect(data.summary.insights.map((i) => i.text)).toContain("식비 지출이 예상보다 높아요.");
  });

  it("analyzer warns when spending outpaces the trip", () => {
    const insights = analyzeSpending({
      currency: "KRW",
      total: 1_000_000,
      spent: 700_000,
      byCategory: { FOOD: 400_000, LODGING: 300_000 },
      allocations: {},
      budgetLevel: "STANDARD",
      elapsedRatio: 0.4,
      isFinal: false,
    });
    const text = insights.map((i) => i.text).join(" ");
    expect(text).toContain("예산의 70%를 사용했어요.");
    expect(text).toContain("여행 기간의 40%가 지났는데");
    expect(text).toContain("식비 지출이 예상보다 높아요.");
  });
});

describe("packing", () => {
  it("generates a weather- and style-aware list without duplicates", async () => {
    const user = await createUser();
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10);
    const { id } = await createTestTrip(user.id, { styles: ["PHOTO"], notes: "축구 경기 보러 가요", startDate: today, endDate: end });
    await getTripWeather(id, user.id); // mock weather includes a rainy day
    await addPackingItem(id, user.id, { name: "여권", group: "필수 서류" });

    const result = await generatePacking(id, user.id);
    const names = result.items.map((i) => i.name);
    expect(names.filter((n) => n === "여권")).toHaveLength(1);
    expect(names).toEqual(expect.arrayContaining(["우산", "보조배터리", "카메라·여분 배터리", "축구 관련 준비물"]));
    expect(result.items.find((i) => i.name === "우산")!.reason).toContain("비 예보");

    const again = await generatePacking(id, user.id);
    expect(again.added).toBe(0);
  });

  it("saves checked state and guards item ids", async () => {
    const [a, b] = await Promise.all([createUser(), createUser()]);
    const { id } = await createTestTrip(a.id);
    const { id: other } = await createTestTrip(b.id);
    const { items } = await addPackingItem(id, a.id, { name: "충전기" });
    const itemId = items[0]!.id;
    expect((await updatePackingItem(id, a.id, itemId, { isPacked: true })).items[0]!.isPacked).toBe(true);
    await expectAppError(updatePackingItem(other, b.id, itemId, { isPacked: false }), "NOT_FOUND");
    await expectAppError(deletePackingItem(other, b.id, itemId), "NOT_FOUND");
    expect((await getPacking(id, a.id)).items[0]!.isPacked).toBe(true);
  });
});

describe("weather", () => {
  it("caches forecasts and turns rain into plan suggestions", async () => {
    const user = await createUser();
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10);
    const { id } = await createTestTrip(user.id, { destination: "도쿄", startDate: today, endDate: end });
    const day3 = await db.day.findFirstOrThrow({ where: { tripId: id, dayNumber: 3 } });
    await addItem(id, user.id, { dayId: day3.id, title: "오다이바 해변공원", category: "NATURE", startMinute: 900, durationMinutes: 60 });

    const weather = await getTripWeather(id, user.id);
    expect(weather.days).toHaveLength(5);
    expect(weather.days.every((d) => d.available)).toBe(true);
    expect(weather.suggestions.map((s) => s.message)).toContain("3일차 오후에 비 소식이 있어요.");
    expect(weather.suggestions[0]!.outdoorTitles).toEqual(["오다이바 해변공원"]);

    const fetchedAt = (await db.weatherSnapshot.findFirstOrThrow({ where: { tripId: id } })).fetchedAt;
    await getTripWeather(id, user.id);
    expect((await db.weatherSnapshot.findFirstOrThrow({ where: { tripId: id } })).fetchedAt).toEqual(fetchedAt);
  });
});

describe("expenses in another currency", () => {
  it("converts to the trip currency and keeps what was paid", async () => {
    const user = await createUser();
    const { id } = await createTestTrip(user.id);
    const data = await addExpense(id, user.id, { title: "타코야키", category: "FOOD", amount: 800, currency: "JPY", fxRate: 9.1, date: "2026-11-03" });
    const e = data.expenses[0]!;
    expect(e.amount).toBe(7280);
    expect(e.currency).toBe("KRW");
    expect(e.originalAmount).toBe(800);
    expect(e.originalCurrency).toBe("JPY");
    expect(data.summary.spent).toBe(7280);
    // Without a rate the reference rate is used; the trip-currency path is unchanged.
    const again = await addExpense(id, user.id, { title: "라멘", category: "FOOD", amount: "1,200", currency: "JPY", date: "2026-11-03" });
    expect(again.expenses.find((x) => x.title === "라멘")!.amount).toBeGreaterThan(0);
  });
});
