import { CheckIcon, FootprintsIcon, TrainFrontIcon, CarTaxiFrontIcon } from "lucide-react";
import {
  CATEGORY_LABELS,
  type ItineraryItemView,
  TRANSPORT_LABELS,
  formatDuration,
  formatMinute,
} from "@/lib/itinerary";
import { cn } from "@/lib/utils";

const TRANSPORT_ICON = { WALK: FootprintsIcon, TAXI: CarTaxiFrontIcon, CAR: CarTaxiFrontIcon } as const;

/** Vertical timeline for one day: time · place · stay, with travel legs between stops. */
export function DayTimeline({ items, compact }: { items: ItineraryItemView[]; compact?: boolean }) {
  return (
    <ol className="relative">
      {items.map((item, index) => {
        const done = item.status === "DONE";
        const current = item.status === "IN_PROGRESS";
        const TravelIcon =
          (item.transportMode && TRANSPORT_ICON[item.transportMode as keyof typeof TRANSPORT_ICON]) || TrainFrontIcon;
        return (
          <li key={item.id}>
            {index > 0 && item.travelMinutesFromPrev ? (
              <div className="flex items-center gap-3 py-1 pl-[3.75rem] text-xs text-muted-foreground">
                <TravelIcon className="size-3.5" aria-hidden />
                {item.transportMode ? TRANSPORT_LABELS[item.transportMode] : "이동"} {item.travelMinutesFromPrev}분
              </div>
            ) : null}
            <div className="flex items-start gap-3">
              <time className={cn("w-12 shrink-0 pt-2.5 text-sm font-semibold tabular-nums", done && "text-muted-foreground")}>
                {formatMinute(item.startMinute)}
              </time>
              <div
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-3 rounded-xl border bg-card px-3.5",
                  compact ? "py-2.5" : "py-3",
                  current && "border-primary ring-1 ring-primary",
                  done && "bg-muted/50",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                    done && "border-success bg-success text-white",
                    current && "border-primary",
                  )}
                >
                  {done ? <CheckIcon className="size-3" strokeWidth={3} /> : current ? <span className="size-2 rounded-full bg-primary" /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate font-medium", done && "text-muted-foreground line-through decoration-1")}>
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORY_LABELS[item.category]}
                    {item.durationMinutes > 0 ? ` · ${formatDuration(item.durationMinutes)}` : ""}
                    {current ? <span className="ml-1.5 font-semibold text-primary">· 지금</span> : null}
                  </p>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
