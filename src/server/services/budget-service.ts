import "server-only";
import type { ExpenseCategory, Prisma } from "@/generated/prisma/client";
import { EXPENSE_CATEGORIES, type BudgetSummaryView, type ExpenseView } from "@/lib/budget";
import { diffDaysIso, fromDbDate, todayInTimeZone, toDbDate } from "@/lib/dates";
import { convertCurrency, localCurrencyFor, referenceRate, roundForCurrency } from "@/lib/fx";
import { computeSettlement } from "@/lib/settlement";
import { guessTimeZone } from "@/lib/timezone-guess";
import { budgetSchema, expensePatchSchema, expenseSchema } from "@/lib/validation/budget";
import { analyzeSpending } from "@/server/ai/trip-analyzer";
import { track } from "@/server/analytics/track";
import { db } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { parseOrThrow } from "@/server/validate";
import { ensureParticipants, listParticipants } from "./member-service";
import { assertTripAccess } from "./trip-service";

const expenseInclude = {
  day: { select: { dayNumber: true } },
  shares: { select: { participantId: true } },
} satisfies Prisma.ExpenseInclude;

type ExpenseRow = Prisma.ExpenseGetPayload<{ include: typeof expenseInclude }>;

function toView(e: ExpenseRow): ExpenseView {
  return {
    id: e.id,
    title: e.title,
    category: e.category,
    amount: Number(e.amount),
    currency: e.currency,
    originalAmount: e.originalAmount === null ? null : Number(e.originalAmount),
    originalCurrency: e.originalCurrency,
    fxRate: e.fxRate === null ? null : Number(e.fxRate),
    note: e.note,
    spentAt: e.spentAt.toISOString(),
    date: fromDbDate(new Date(Date.UTC(e.spentAt.getUTCFullYear(), e.spentAt.getUTCMonth(), e.spentAt.getUTCDate()))),
    dayId: e.dayId,
    dayNumber: e.day?.dayNumber ?? null,
    paidById: e.paidById,
    splitWith: e.shares.map((s) => s.participantId),
  };
}

async function dayForDate(tripId: string, date: string) {
  return db.day.findFirst({ where: { tripId, date: toDbDate(date) }, select: { id: true } });
}

export async function getBudget(tripId: string, userId: string) {
  const role = await assertTripAccess(tripId, userId);
  const trip = await db.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: {
      budget: true,
      owner: { select: { travelProfile: { select: { budgetLevel: true } } } },
      days: { orderBy: { dayNumber: "asc" }, select: { id: true, dayNumber: true, date: true, items: { select: { estimatedCost: true } } } },
      expenses: { orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }], include: expenseInclude },
    },
  });
  const participants = await listParticipants(tripId);

  const expenses = trip.expenses.map(toView);
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const total = trip.budget ? Number(trip.budget.totalAmount) : null;
  const allocations = (trip.budget?.allocations ?? {}) as Partial<Record<ExpenseCategory, number>>;
  const byCategoryMap: Partial<Record<ExpenseCategory, number>> = {};
  for (const e of expenses) byCategoryMap[e.category] = (byCategoryMap[e.category] ?? 0) + e.amount;

  const startDate = fromDbDate(trip.startDate);
  const endDate = fromDbDate(trip.endDate);
  const today = todayInTimeZone(trip.timezone);
  const totalDays = diffDaysIso(startDate, endDate) + 1;
  const elapsed = Math.min(Math.max(diffDaysIso(startDate, today) + 1, 0), totalDays);
  const isFinal = trip.status === "COMPLETED" || today > endDate;

  const planned = trip.days.reduce((sum, d) => sum + d.items.reduce((s, i) => s + (i.estimatedCost === null ? 0 : Number(i.estimatedCost)), 0), 0);
  const summary: BudgetSummaryView = {
    planned,
    currency: trip.currency,
    travelerCount: trip.travelerCount,
    total,
    allocations,
    spent,
    remaining: total !== null ? total - spent : null,
    usedPct: total ? Math.round((spent / total) * 1000) / 10 : null,
    // Average per head; with cost-sharing names set up, over those people rather than the headcount.
    perPerson: Math.round(spent / Math.max(participants.length >= 2 ? participants.filter((p) => !p.left).length : trip.travelerCount, 1)),
    byCategory: EXPENSE_CATEGORIES.map((category) => ({
      category,
      amount: byCategoryMap[category] ?? 0,
      allocation: allocations[category] ?? null,
    })),
    byDay: trip.days.map((d) => ({
      dayNumber: d.dayNumber,
      date: fromDbDate(d.date),
      amount: expenses.filter((e) => e.dayId === d.id).reduce((s, e) => s + e.amount, 0),
    })),
    insights: analyzeSpending({
      currency: trip.currency,
      total,
      spent,
      byCategory: byCategoryMap,
      allocations,
      budgetLevel: trip.owner.travelProfile?.budgetLevel ?? "STANDARD",
      elapsedRatio: elapsed / totalDays,
      isFinal,
    }),
    isFinal,
  };

  return {
    canEdit: role !== "VIEWER",
    trip: { startDate, endDate, timezone: trip.timezone, today, localCurrency: localCurrencyFor(guessTimeZone(trip.destination) ?? trip.timezone) },
    summary,
    expenses,
    participants: participants.map((p) => ({ id: p.id, name: p.name, isMe: p.userId === userId, left: p.left })),
    settlement: participants.length >= 2 ? computeSettlement(participants, expenses, trip.currency) : null,
  };
}

/** Checks payer/sharer ids belong to the trip; returns the create/replace data for shares. */
async function splitData(tripId: string, input: { paidById?: string | null; splitWith?: string[] }) {
  const ids = [...new Set([...(input.paidById ? [input.paidById] : []), ...(input.splitWith ?? [])])];
  if (ids.length > 0) {
    const found = await db.tripParticipant.count({ where: { tripId, id: { in: ids } } });
    if (found !== ids.length) throw new AppError("VALIDATION", "함께하는 사람 목록이 바뀌었어요. 새로고침 후 다시 골라 주세요.");
  }
  if (input.splitWith === undefined) return { splitWith: undefined };
  if (input.splitWith.length > 0) return { splitWith: [...new Set(input.splitWith)] };
  // "Everyone" means the people on the trip right now. It is stored as that list, so someone who
  // joins later is not charged for earlier costs, and someone who left is not charged for new ones.
  const active = await db.tripParticipant.findMany({ where: { tripId, leftAt: null }, select: { id: true } });
  return { splitWith: active.map((p) => p.id) };
}

async function myParticipantId(tripId: string, userId: string) {
  await ensureParticipants(tripId);
  const mine = await db.tripParticipant.findUnique({ where: { tripId_userId: { tripId, userId } }, select: { id: true } });
  return mine?.id ?? null;
}

export type BudgetData = Awaited<ReturnType<typeof getBudget>>;

/** Largest amount the money columns hold (Decimal(12,2)). */
const MAX_AMOUNT = 9_999_999_999.99;

/** Amount in the trip currency (+ what was paid) for an expense entered in any currency. */
function inTripCurrency(amount: number, currency: string | undefined, fxRate: number | undefined, tripCurrency: string) {
  if (!currency || currency === tripCurrency) {
    // Round the way the currency is written: ₩0.4 is not an expense.
    const rounded = roundForCurrency(amount, tripCurrency);
    if (rounded <= 0) throw new AppError("VALIDATION", "금액을 확인해 주세요.", { amount: "금액은 0보다 커야 해요." });
    if (rounded > MAX_AMOUNT) throw new AppError("VALIDATION", "금액을 확인해 주세요.", { amount: "금액이 너무 커요." });
    return { amount: rounded, originalAmount: null, originalCurrency: null, fxRate: null };
  }
  const rate = fxRate ?? referenceRate(currency, tripCurrency);
  const converted = convertCurrency(amount, currency, tripCurrency, rate);
  if (converted <= 0) throw new AppError("VALIDATION", "금액을 확인해 주세요.", { amount: "환산한 금액이 0이에요. 금액이나 환율을 확인해 주세요." });
  if (converted > MAX_AMOUNT) throw new AppError("VALIDATION", "금액을 확인해 주세요.", { amount: "환산한 금액이 너무 커요. 금액이나 환율을 확인해 주세요." });
  return { amount: converted, originalAmount: amount, originalCurrency: currency, fxRate: rate };
}

/**
 * A PATCH touching amount, currency or rate. Unmentioned parts keep their stored values, so
 * "amount: 2000" on a ¥1,000 expense means ¥2,000 at the same rate, not ₩2,000.
 */
function convertedPatch(
  input: { amount?: number; currency?: string; fxRate?: number },
  existing: { amount: Prisma.Decimal; currency: string; originalAmount: Prisma.Decimal | null; originalCurrency: string | null; fxRate: Prisma.Decimal | null },
) {
  if (input.amount === undefined && input.currency === undefined && input.fxRate === undefined) return {};
  const currency = input.currency ?? existing.originalCurrency ?? existing.currency;
  const sameCurrency = currency === (existing.originalCurrency ?? existing.currency);
  const amount = input.amount ?? Number(existing.originalAmount ?? existing.amount);
  const rate = input.fxRate ?? (sameCurrency && existing.fxRate !== null ? Number(existing.fxRate) : undefined);
  return inTripCurrency(amount, currency, rate, existing.currency);
}

/** Expenses may fall a week before/after the trip (deposits, late refunds) but not in 1999. */
const EXPENSE_DATE_SLACK_DAYS = 7;

async function assertExpenseDate(tripId: string, date: string) {
  const trip = await db.trip.findUniqueOrThrow({ where: { id: tripId }, select: { startDate: true, endDate: true } });
  const before = diffDaysIso(date, fromDbDate(trip.startDate));
  const after = diffDaysIso(fromDbDate(trip.endDate), date);
  if (before > EXPENSE_DATE_SLACK_DAYS || after > EXPENSE_DATE_SLACK_DAYS) {
    throw new AppError("VALIDATION", "날짜를 확인해 주세요.", {
      date: `여행 기간 앞뒤 ${EXPENSE_DATE_SLACK_DAYS}일 안의 날짜로 입력해 주세요.`,
    });
  }
}

/** Noon of the expense date in UTC keeps the calendar date stable in any server time zone. */
function spentAtFor(date: string) {
  return new Date(`${date}T12:00:00.000Z`);
}

export async function addExpense(tripId: string, userId: string, raw: unknown) {
  await assertTripAccess(tripId, userId, "EDITOR");
  const input = parseOrThrow(expenseSchema, raw);
  await assertExpenseDate(tripId, input.date);
  const trip = await db.trip.findUniqueOrThrow({ where: { id: tripId }, select: { currency: true } });
  if (input.itineraryItemId) {
    const item = await db.itineraryItem.findFirst({ where: { id: input.itineraryItemId, day: { tripId } } });
    if (!item) throw notFound("일정");
  }
  const day = await dayForDate(tripId, input.date);
  const paidById = input.paidById !== undefined ? input.paidById : await myParticipantId(tripId, userId);
  const { splitWith } = paidById ? await splitData(tripId, { ...input, splitWith: input.splitWith ?? [] }) : { splitWith: undefined };
  await db.expense.create({
    data: {
      tripId,
      createdById: userId,
      paidById,
      shares: splitWith?.length ? { create: splitWith.map((participantId) => ({ participantId })) } : undefined,
      dayId: day?.id ?? null,
      itineraryItemId: input.itineraryItemId ?? null,
      title: input.title,
      category: input.category,
      ...inTripCurrency(input.amount, input.currency, input.fxRate, trip.currency),
      currency: trip.currency,
      note: input.note,
      spentAt: spentAtFor(input.date),
    },
  });
  await track("add_expense", { userId, tripId, properties: { category: input.category } });
  return getBudget(tripId, userId);
}

export async function updateExpense(tripId: string, userId: string, expenseId: string, raw: unknown) {
  await assertTripAccess(tripId, userId, "EDITOR");
  const input = parseOrThrow(expensePatchSchema, raw);
  const existing = await db.expense.findFirst({ where: { id: expenseId, tripId } });
  if (!existing) throw notFound("지출");
  if (input.date) await assertExpenseDate(tripId, input.date);
  const day = input.date ? await dayForDate(tripId, input.date) : undefined;
  const { splitWith } = await splitData(tripId, input);
  await db.expense.update({
    where: { id: expenseId },
    data: {
      paidById: input.paidById,
      shares: splitWith ? { deleteMany: {}, create: splitWith.map((participantId) => ({ participantId })) } : undefined,
      title: input.title,
      category: input.category,
      ...convertedPatch(input, existing),
      note: input.note,
      spentAt: input.date ? spentAtFor(input.date) : undefined,
      dayId: input.date ? (day?.id ?? null) : undefined,
    },
  });
  return getBudget(tripId, userId);
}

export async function deleteExpense(tripId: string, userId: string, expenseId: string) {
  await assertTripAccess(tripId, userId, "EDITOR");
  const { count } = await db.expense.deleteMany({ where: { id: expenseId, tripId } });
  if (count === 0) throw notFound("지출");
  return getBudget(tripId, userId);
}

export async function setBudget(tripId: string, userId: string, raw: unknown) {
  await assertTripAccess(tripId, userId, "EDITOR");
  const input = parseOrThrow(budgetSchema, raw);
  const allocated = Object.values(input.allocations ?? {}).reduce((s, n) => s + (n ?? 0), 0);
  if (allocated > input.totalAmount) {
    throw new AppError("VALIDATION", "카테고리별 예산의 합이 총 예산보다 커요.", { allocations: "총 예산 이내로 나눠 주세요." });
  }
  const trip = await db.trip.findUniqueOrThrow({ where: { id: tripId }, select: { currency: true } });
  const allocations = (input.allocations ?? {}) as Prisma.InputJsonValue;
  await db.budget.upsert({
    where: { tripId },
    create: { tripId, totalAmount: input.totalAmount, currency: trip.currency, allocations },
    update: { totalAmount: input.totalAmount, allocations },
  });
  return getBudget(tripId, userId);
}
