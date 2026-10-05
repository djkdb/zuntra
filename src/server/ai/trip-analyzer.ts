import "server-only";
import type { BudgetLevel, ExpenseCategory } from "@/generated/prisma/enums";
import { EXPECTED_SHARE, EXPENSE_CATEGORY_LABELS, type Insight } from "@/lib/budget";
import { formatMoney } from "@/lib/format";
import { withJosa } from "@/lib/korean";

/**
 * Spending analysis. Deterministic on purpose: it runs on every budget view, so it must be
 * free, instant and consistent. (The companion can still discuss money with the model.)
 */
export function analyzeSpending(input: {
  currency: string;
  total: number | null;
  spent: number;
  byCategory: Partial<Record<ExpenseCategory, number>>;
  allocations: Partial<Record<ExpenseCategory, number>>;
  budgetLevel: BudgetLevel;
  elapsedRatio: number; // 0..1 share of trip days that have passed
  isFinal: boolean;
}): Insight[] {
  const { currency, total, spent } = input;
  const money = (n: number) => formatMoney(n, currency);
  const insights: Insight[] = [];
  if (spent === 0) {
    return [{ tone: "info", text: "아직 기록된 지출이 없어요. 지출을 기록하면 자동으로 분석해 드려요." }];
  }

  insights.push({ tone: "info", text: `${input.isFinal ? "이번 여행에서 총" : "현재까지"} ${withJosa(money(spent), "을/를")} 사용했어요.`, restatesTotals: true });

  if (total && total > 0) {
    const pct = Math.round((spent / total) * 100);
    if (pct > 100) insights.push({ tone: "warning", text: `예산을 ${money(spent - total)} 초과했어요 (예산의 ${pct}%).` });
    else insights.push({ tone: pct >= 85 ? "warning" : "info", text: `예산의 ${pct}%를 사용했어요.`, restatesTotals: pct < 85 });

    if (!input.isFinal && input.elapsedRatio > 0.05 && input.elapsedRatio < 1) {
      // Lodging is usually paid up front, so judge the pace on day-to-day spending only.
      const lodging = input.byCategory.LODGING ?? 0;
      const lodgingBudget = input.allocations.LODGING ?? total * EXPECTED_SHARE[input.budgetLevel].LODGING;
      const dailyBudget = Math.max(total - Math.max(lodging, lodgingBudget), 1);
      const pace = (spent - lodging) / dailyBudget / input.elapsedRatio;
      if (pace > 1.2) {
        insights.push({
          tone: "warning",
          text: `여행 기간의 ${Math.round(input.elapsedRatio * 100)}%가 지났는데 예산의 ${pct}%를 썼어요. 남은 일정은 조금 아껴 보세요.`,
        });
      } else if (pace < 0.8) {
        insights.push({ tone: "good", text: "예산보다 여유 있게 쓰고 있어요." });
      }
    }

    // Category over its allocation, or well above the typical share.
    for (const [cat, amount] of Object.entries(input.byCategory) as [ExpenseCategory, number][]) {
      const allocation = input.allocations[cat];
      const expected = allocation ?? total * EXPECTED_SHARE[input.budgetLevel][cat];
      const prepaid = cat === "LODGING" || cat === "TRANSPORT";
      const expectedSoFar =
        input.isFinal || allocation !== undefined || prepaid ? expected : expected * Math.max(input.elapsedRatio, 0.3);
      if (amount > expectedSoFar * 1.25 && amount > total * 0.05) {
        insights.push({ tone: "warning", text: `${EXPENSE_CATEGORY_LABELS[cat]} 지출이 예상보다 높아요.` });
      }
    }
  }

  // "Comfortably within budget" next to "category X is high" reads as a contradiction.
  if (insights.some((i) => i.tone === "warning")) {
    const calm = insights.findIndex((i) => i.tone === "good");
    if (calm >= 0) insights.splice(calm, 1);
  }

  const top = (Object.entries(input.byCategory) as [ExpenseCategory, number][]).sort((a, b) => b[1] - a[1])[0];
  if (top && spent > 0) {
    insights.push({ tone: "info", text: `가장 많이 쓴 항목은 ${EXPENSE_CATEGORY_LABELS[top[0]]}(${Math.round((top[1] / spent) * 100)}%)예요.` });
  }
  return insights.slice(0, 5);
}
