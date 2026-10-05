"use client";

import { CheckIcon, CircleIcon, LocateIcon, MapPinIcon, NavigationIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useItinerary, useItineraryMutations } from "@/components/plan/use-itinerary";
import { WeatherIcon } from "@/components/weather/weather-icon";
import { Button } from "@/components/ui/button";
import { formatShortDate, nowMinuteInTimeZone } from "@/lib/dates";
import { type LatLng, estimateTravelMinutes, haversineKm, suggestMode } from "@/lib/geo";
import { CATEGORY_LABELS, TRANSPORT_LABELS, formatDuration, formatMinute } from "@/lib/itinerary";
import { cn } from "@/lib/utils";
import type { Itinerary } from "@/server/services/itinerary-service";

export interface TodayWeather {
  condition: string;
  label: string;
  tempMax: number;
  tempMin: number;
  precipitation: number | null;
}

/**
 * The in-trip home: what's done, where I am, what's next and how to get there.
 * Reads the same itinerary cache as the plan editor, so check-offs and AI changes stay in sync.
 */
export function TodayView({
  tripId,
  itinerary,
  dayId,
  initialNowMinute,
  weather,
  showAsk = true,
}: {
  tripId: string;
  itinerary: Itinerary;
  dayId: string;
  initialNowMinute: number;
  weather: TodayWeather | null;
  /** Off beside the chat itself, where the button would only point back to the same page. */
  showAsk?: boolean;
}) {
  const { data } = useItinerary(tripId, itinerary);
  const { updateItem } = useItineraryMutations(tripId);
  const [nowMinute, setNowMinute] = useState(initialNowMinute);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);

  const timezone = (data ?? itinerary).trip.timezone;
  useEffect(() => {
    const id = setInterval(() => setNowMinute(nowMinuteInTimeZone(timezone)), 60_000);
    return () => clearInterval(id);
  }, [timezone]);

  const day = (data ?? itinerary).days.find((d) => d.id === dayId);
  if (!day) return null;
  const editable = (data ?? itinerary).trip.role !== "VIEWER";

  const current =
    day.items.find((i) => i.status === "IN_PROGRESS") ??
    day.items.find((i) => i.status !== "DONE" && i.startMinute <= nowMinute && nowMinute < i.startMinute + i.durationMinutes);
  const next = day.items.find((i) => i.status !== "DONE" && i.id !== current?.id && i.startMinute >= (current?.startMinute ?? nowMinute - 30));
  const doneCount = day.items.filter((i) => i.status === "DONE").length;

  const nextLoc = next?.latitude != null && next.longitude != null ? { lat: next.latitude, lng: next.longitude } : null;
  const fromLoc = location ?? (current?.latitude != null ? { lat: current.latitude, lng: current.longitude! } : null);
  const mode = fromLoc && nextLoc ? suggestMode(fromLoc, nextLoc) : null;
  const travel = fromLoc && nextLoc && mode ? estimateTravelMinutes(fromLoc, nextLoc, mode) : next?.travelMinutesFromPrev ?? null;
  const nearest =
    location &&
    day.items
      .filter((i) => i.latitude != null)
      .map((i) => ({ i, km: haversineKm(location, { lat: i.latitude!, lng: i.longitude! }) }))
      .sort((a, b) => a.km - b.km)[0];

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 6000, maximumAge: 120_000 },
    );
  };

  return (
    <section aria-labelledby="today-title" className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-start justify-between gap-3 border-b px-5 pt-5 pb-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            DAY {day.dayNumber} · {formatShortDate(day.date)} · 현지 {formatMinute(nowMinute)}
          </p>
          <h2 id="today-title" className="mt-1 text-2xl font-bold tracking-tight">
            오늘 일정
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {day.items.length > 0 ? `${day.items.length}개 중 ${doneCount}개 완료` : "오늘 일정이 비어 있어요"}
          </p>
        </div>
        {weather ? (
          <div className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-secondary-foreground">
            <WeatherIcon condition={weather.condition} className="size-6" />
            <div className="text-right">
              <p className="text-lg leading-none font-semibold">{Math.round(weather.tempMax)}°C</p>
              <p className="text-[11px]">
                {weather.label}
                {weather.precipitation !== null && weather.precipitation >= 30 ? ` · 비 ${weather.precipitation}%` : ""}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {next || current ? (
        <div className="space-y-2 bg-secondary/40 px-5 py-4">
          <p className="flex items-center gap-1.5 text-sm">
            <MapPinIcon className="size-4 text-primary" aria-hidden />
            <span className="text-muted-foreground">현재 위치</span>
            <span className="font-medium">
              {nearest ? `${nearest.i.title} 근처` : current ? current.title : "확인하지 않음"}
            </span>
            {!location ? (
              <button type="button" onClick={locate} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary" disabled={locating}>
                <LocateIcon className="size-3.5" aria-hidden />
                {locating ? "확인 중…" : "위치 확인"}
              </button>
            ) : null}
          </p>
          {next ? (
            <div>
              <p className="text-xs text-muted-foreground">다음 일정</p>
              <p className="text-lg font-semibold">
                {formatMinute(next.startMinute)} {next.title}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                {travel !== null ? (
                  <span className="inline-flex items-center gap-1">
                    <NavigationIcon className="size-3.5" aria-hidden />
                    {mode ? TRANSPORT_LABELS[mode] : next.transportMode ? TRANSPORT_LABELS[next.transportMode] : "이동"} {travel}분
                  </span>
                ) : null}
                {next.durationMinutes > 0 ? <span>예상 체류시간 {formatDuration(next.durationMinutes)}</span> : null}
              </p>
            </div>
          ) : (
            <p className="text-sm font-medium">오늘의 마지막 일정이에요.</p>
          )}
        </div>
      ) : null}

      <ol className="space-y-1 px-3 py-3">
        {day.items.map((item) => {
          const done = item.status === "DONE";
          const isCurrent = item.id === current?.id;
          return (
            <li key={item.id}>
              <div className={cn("flex items-center gap-3 rounded-xl px-2 py-2", isCurrent && "bg-primary/8 ring-1 ring-primary/40")}>
                <time className="w-12 text-sm font-semibold tabular-nums text-muted-foreground">{formatMinute(item.startMinute)}</time>
                <button
                  type="button"
                  disabled={!editable}
                  aria-pressed={done}
                  aria-label={done ? `${item.title} 완료 취소` : `${item.title} 완료로 표시`}
                  onClick={() => updateItem.mutate({ itemId: item.id, patch: { status: done ? "PLANNED" : "DONE" } })}
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                    done ? "border-success bg-success text-white" : isCurrent ? "border-primary" : "border-border",
                  )}
                >
                  {done ? <CheckIcon className="size-3.5" strokeWidth={3} /> : isCurrent ? <CircleIcon className="size-2 fill-primary text-primary" /> : null}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate font-medium", done && "text-muted-foreground line-through decoration-1")}>
                    {isCurrent ? "📍 " : ""}
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {CATEGORY_LABELS[item.category]}
                    {item.durationMinutes ? ` · ${formatDuration(item.durationMinutes)}` : ""}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {showAsk ? (
      <div className="border-t px-5 py-4">
          <Button asChild className="w-full">
            <Link href={`/trips/${tripId}/companion`}>
              <SparklesIcon data-icon="inline-start" aria-hidden />
              지금 AI에게 물어보기
            </Link>
          </Button>
        </div>
      ) : null}
    </section>
  );
}
