import type { BudgetLevel, ExpenseCategory } from "@/generated/prisma/enums";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  LODGING: "숙박",
  TRANSPORT: "교통",
  FOOD: "식비",
  SIGHTSEEING: "관광",
  SHOPPING: "쇼핑",
  OTHER: "기타",
};

export const EXPENSE_CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];

/** Typical share of a travel budget per category, used when no allocation is set. */
export const EXPECTED_SHARE: Record<BudgetLevel, Record<ExpenseCategory, number>> = {
  BUDGET: { LODGING: 0.35, TRANSPORT: 0.2, FOOD: 0.25, SIGHTSEEING: 0.1, SHOPPING: 0.05, OTHER: 0.05 },
  STANDARD: { LODGING: 0.35, TRANSPORT: 0.15, FOOD: 0.25, SIGHTSEEING: 0.1, SHOPPING: 0.1, OTHER: 0.05 },
  LUXURY: { LODGING: 0.4, TRANSPORT: 0.12, FOOD: 0.25, SIGHTSEEING: 0.08, SHOPPING: 0.12, OTHER: 0.03 },
};

export interface ExpenseView {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  /** Set when paid in another currency; `amount` is the converted figure. */
  originalAmount: number | null;
  originalCurrency: string | null;
  fxRate: number | null;
  note: string | null;
  spentAt: string;
  date: string;
  dayId: string | null;
  dayNumber: number | null;
  /** Participant who paid (null = not recorded, left out of the split). */
  paidById: string | null;
  /** Participants sharing it; empty = everyone. */
  splitWith: string[];
}

export interface Insight {
  tone: "info" | "good" | "warning";
  text: string;
  /** Restates the totals card (amount spent, % of budget); the budget page leaves these out. */
  restatesTotals?: boolean;
}

export interface BudgetSummaryView {
  currency: string;
  travelerCount: number;
  total: number | null;
  allocations: Partial<Record<ExpenseCategory, number>>;
  spent: number;
  remaining: number | null;
  usedPct: number | null;
  perPerson: number;
  byCategory: { category: ExpenseCategory; amount: number; allocation: number | null }[];
  byDay: { dayNumber: number; date: string; amount: number }[];
  insights: Insight[];
  isFinal: boolean;
  /** Sum of the itinerary's estimated costs: "will this plan fit the budget?" */
  planned: number;
}
