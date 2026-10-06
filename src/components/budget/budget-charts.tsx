import { formatShortDate } from "@/lib/dates";
import { EXPENSE_CATEGORY_LABELS, type BudgetSummaryView } from "@/lib/budget";
import { formatMoney } from "@/lib/format";
import { josa } from "@/lib/korean";
import { cn } from "@/lib/utils";

/**
 * Budget figures. One hue (primary) because bars are labelled by name — identity never relies
 * on color. Over-budget states use the warning/destructive status colors with text labels.
 */
export function BudgetMeter({ summary }: { summary: BudgetSummaryView }) {
  const { total, spent, usedPct, remaining, currency, perPerson, travelerCount, isFinal } = summary;
  const pct = usedPct ?? 0;
  const over = total !== null && spent > total;
  return (
    <section aria-labelledby="budget-hero" className="rounded-xl border bg-card p-6">
      <p id="budget-hero" className="text-sm font-medium text-muted-foreground">
        {isFinal ? "총 지출" : "지금까지 사용한 금액"}
      </p>
      <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums">{formatMoney(spent, currency)}</p>
      {total !== null ? (
        <>
          <div
            className="mt-5 h-3 overflow-hidden rounded-full bg-primary/12"
            role="meter"
            aria-label="예산 사용률"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(Math.round(pct), 100)}
            aria-valuetext={`${pct}%`}
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width]",
                over ? "bg-destructive" : pct >= 85 ? "bg-warning" : "bg-primary",
              )}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <p className="mt-2 flex flex-wrap justify-between gap-2 text-sm">
            <span className="font-medium">
              예산 {formatMoney(total, currency)} 중 {pct}%{over ? " · 예산 초과" : ""}
            </span>
            <span className="text-muted-foreground">
              {remaining !== null && remaining >= 0 ? `남은 예산 ${formatMoney(remaining, currency)}` : `${formatMoney(-(remaining ?? 0), currency)} 초과`}
            </span>
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">예산을 정하면 사용률을 보여드려요.</p>
      )}
      {summary.planned > 0 && !isFinal ? (
        // The plan's own estimates against the budget: answers "can I afford this itinerary?"
        <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm">
          일정에 적힌 입장료·식비 예상은 <span className="font-medium">{formatMoney(summary.planned, currency)}</span>
          <span className="text-muted-foreground"> ({travelerCount > 1 ? `${travelerCount}명 합계, ` : ""}항공·숙소 제외)</span>
          {total !== null ? (
            summary.planned > total ? (
              <span className="text-destructive">{josa(formatMoney(summary.planned, currency), "으로/로")} 예산을 {formatMoney(summary.planned - total, currency)} 넘어요.</span>
            ) : (
              <>{josa(formatMoney(summary.planned, currency), "으로/로")} 예산의 {Math.round((summary.planned / total) * 100)}%예요.</>
            )
          ) : (
            `${josa(formatMoney(summary.planned, currency), "이/가") === "이" ? "이에요" : "예요"}. 예산을 정하면 비교해 드려요.`
          )}
        </p>
      ) : null}
      <dl className="mt-5 grid grid-cols-2 gap-4 border-t pt-4 text-sm">
        <div>
          <dt className="text-muted-foreground">1인당 평균</dt>
          <dd className="mt-0.5 text-lg font-semibold">{formatMoney(perPerson, currency)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">인원</dt>
          <dd className="mt-0.5 text-lg font-semibold">{travelerCount}명</dd>
        </div>
      </dl>
    </section>
  );
}

export function CategoryBars({ summary }: { summary: BudgetSummaryView }) {
  // Categories with nothing spent and no allocation are noise ("기타 ₩0").
  const rows = [...summary.byCategory].filter((r) => r.amount > 0 || r.allocation !== null).sort((a, b) => b.amount - a.amount);
  const max = Math.max(...rows.map((r) => Math.max(r.amount, r.allocation ?? 0)), 1);
  const hasAllocation = rows.some((r) => r.allocation !== null);
  return (
    <section aria-labelledby="category-title" className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 id="category-title" className="text-lg font-semibold">
          카테고리별 지출
        </h2>
        {hasAllocation ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-3 w-0.5 bg-foreground/60" aria-hidden /> 카테고리 예산
          </span>
        ) : null}
      </div>
      <ul className="space-y-3.5">
        {rows.map((r) => {
          const over = r.allocation !== null && r.amount > r.allocation;
          return (
            <li key={r.category} className="group grid grid-cols-[3rem_1fr_6.5rem] items-center gap-3 text-sm">
              <span className="text-muted-foreground">{EXPENSE_CATEGORY_LABELS[r.category]}</span>
              <span className="relative h-5">
                <span className="absolute inset-y-[5px] left-0 right-0 rounded-full bg-muted" aria-hidden />
                <span
                  className={cn("absolute inset-y-[5px] left-0 rounded-r-[4px]", over ? "bg-destructive" : "bg-primary")}
                  style={{ width: `${(r.amount / max) * 100}%`, minWidth: r.amount > 0 ? 4 : 0 }}
                  aria-hidden
                />
                {r.allocation !== null ? (
                  <span
                    className="absolute inset-y-0 w-0.5 rounded bg-foreground/60"
                    style={{ left: `calc(${(r.allocation / max) * 100}% - 1px)` }}
                    aria-hidden
                  />
                ) : null}
                <span
                  role="tooltip"
                  className="pointer-events-none absolute -top-8 left-0 z-10 hidden rounded-md bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md ring-1 ring-border group-hover:block"
                >
                  {EXPENSE_CATEGORY_LABELS[r.category]} {formatMoney(r.amount, summary.currency)}
                  {r.allocation !== null ? ` / 예산 ${formatMoney(r.allocation, summary.currency)}` : ""}
                  {summary.spent > 0 ? ` · ${Math.round((r.amount / summary.spent) * 100)}%` : ""}
                </span>
              </span>
              <span className="text-right font-medium tabular-nums">
                {formatMoney(r.amount, summary.currency)}
                {over ? <span className="ml-1 text-xs text-destructive">초과</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function DailyColumns({ summary }: { summary: BudgetSummaryView }) {
  const max = Math.max(...summary.byDay.map((d) => d.amount), 1);
  const peak = summary.byDay.reduce((p, d) => (d.amount > p.amount ? d : p), summary.byDay[0] ?? { amount: 0, dayNumber: 0, date: "" });
  if (summary.byDay.length === 0) return null;
  return (
    <section aria-labelledby="daily-title" className="space-y-4">
      <h2 id="daily-title" className="text-lg font-semibold">
        날짜별 지출
      </h2>
      <div className="relative">
        <div className="flex h-40 items-end gap-1.5 border-b border-border pb-px" aria-hidden>
          {summary.byDay.map((d) => (
            <div key={d.dayNumber} className="group relative flex h-full flex-1 flex-col items-center justify-end">
              {d.dayNumber === peak.dayNumber && d.amount > 0 ? (
                <span className="mb-1 text-[11px] font-medium whitespace-nowrap tabular-nums">{formatMoney(d.amount, summary.currency)}</span>
              ) : null}
              <div
                className="w-full max-w-6 rounded-t-[4px] bg-primary/85 transition-colors group-hover:bg-primary"
                style={{ height: `${(d.amount / max) * 85}%`, minHeight: d.amount > 0 ? 3 : 0 }}
              />
              <span className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-md bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md ring-1 ring-border group-hover:block">
                DAY {d.dayNumber} · {formatMoney(d.amount, summary.currency)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5" aria-hidden>
          {summary.byDay.map((d) => (
            <span key={d.dayNumber} className="flex-1 text-center text-[11px] text-muted-foreground">
              D{d.dayNumber}
            </span>
          ))}
        </div>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">표로 보기</summary>
        <table className="mt-2 w-full text-left">
          <thead>
            <tr className="text-muted-foreground">
              <th className="py-1 font-medium">날짜</th>
              <th className="py-1 text-right font-medium">지출</th>
            </tr>
          </thead>
          <tbody>
            {summary.byDay.map((d) => (
              <tr key={d.dayNumber} className="border-t">
                <td className="py-1.5">
                  DAY {d.dayNumber} · {formatShortDate(d.date)}
                </td>
                <td className="py-1.5 text-right tabular-nums">{formatMoney(d.amount, summary.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
