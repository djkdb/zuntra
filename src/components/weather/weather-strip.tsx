import { DropletsIcon } from "lucide-react";
import { formatShortDate } from "@/lib/dates";
import { type DayWeatherView, isRainy } from "@/lib/weather";
import { cn } from "@/lib/utils";
import { WeatherIcon } from "./weather-icon";

/** Per-day forecast for the trip: condition, high/low and chance of rain. */
export function WeatherStrip({ days, stale }: { days: DayWeatherView[]; stale?: boolean }) {
  const anyAvailable = days.some((d) => d.available);
  return (
    <section aria-labelledby="weather-title" className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 id="weather-title" className="text-xl font-semibold">
          여행 날씨
        </h2>
        <p className="text-xs text-muted-foreground">
          {stale ? "최신 예보를 가져오지 못해 마지막 예보를 보여줘요" : anyAvailable ? "현지 기준 예보" : "출발 16일 전부터 예보를 보여드려요"}
        </p>
      </div>
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {days.map((d) => (
          <li
            key={d.dayId}
            className={cn(
              "flex w-[5.5rem] shrink-0 flex-col items-center gap-1 rounded-2xl border bg-card px-2 py-3 text-center",
              d.available && isRainy(d) && "border-primary/40 bg-secondary/60",
            )}
          >
            <span className="text-xs font-semibold">DAY {d.dayNumber}</span>
            <span className="text-[11px] text-muted-foreground">{formatShortDate(d.date).replace(/ \(.\)/, "")}</span>
            {d.available ? (
              <>
                <WeatherIcon condition={d.condition} className="my-1 size-7" />
                <span className="text-xs">{d.label}</span>
                <span className="text-sm font-semibold tabular-nums">
                  {Math.round(d.tempMax!)}° <span className="font-normal text-muted-foreground">/ {Math.round(d.tempMin!)}°</span>
                </span>
                <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                  <DropletsIcon className="size-3" aria-hidden />
                  <span className="sr-only">강수확률</span>
                  {d.precipitation ?? 0}%
                </span>
              </>
            ) : (
              <span className="my-auto py-3 text-xs text-muted-foreground">예보 전</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
