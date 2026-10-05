"use client";

import { formatShortDate } from "@/lib/dates";
import type { DayView } from "@/lib/itinerary";
import { cn } from "@/lib/utils";

/**
 * The one way to pick a day (plan and map): DAY n · date · how many stops. `allLabel` adds a
 * leading "all days" option.
 */
export function DaySwitcher({
  days,
  selected,
  onSelect,
  today,
  allLabel,
  label = "날짜 선택",
}: {
  days: DayView[];
  selected: string;
  onSelect: (id: string) => void;
  today?: string;
  allLabel?: string;
  label?: string;
}) {
  const option = (id: string, title: string, detail: string | null) => {
    const active = id === selected;
    return (
      <li key={id}>
        <button
          type="button"
          onClick={() => onSelect(id)}
          aria-pressed={active}
          className={cn(
            "flex h-11 flex-col items-start justify-center rounded-lg border px-3 text-left transition-colors",
            active ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted",
          )}
        >
          <span className="text-xs font-semibold">{title}</span>
          {detail ? <span className={cn("text-xs", active ? "text-background/75" : "text-muted-foreground")}>{detail}</span> : null}
        </button>
      </li>
    );
  };
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-2">
        {allLabel ? option("all", allLabel, `${days.length}일`) : null}
        {days.map((d) =>
          option(
            d.id,
            `DAY ${d.dayNumber}${d.date === today ? " · 오늘" : ""}`,
            `${formatShortDate(d.date)} · ${d.items.length > 0 ? `${d.items.length}곳` : "비어 있음"}`,
          ),
        )}
      </ul>
    </nav>
  );
}
