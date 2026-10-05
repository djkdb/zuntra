"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClockIcon, LocateIcon, MapPinIcon, MapPinOffIcon, NavigationIcon, SearchIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DaySwitcher } from "@/components/plan/day-switcher";
import { itineraryKey, useItinerary } from "@/components/plan/use-itinerary";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { formatShortDate, todayInTimeZone } from "@/lib/dates";
import { type LatLng, estimateTravelMinutes, suggestMode } from "@/lib/geo";
import { CATEGORY_LABELS, type DayView, type ItineraryItemView, TRANSPORT_LABELS, formatDuration, formatMinute } from "@/lib/itinerary";
import { cn } from "@/lib/utils";
import type { Itinerary } from "@/server/services/itinerary-service";
import type { MapMarker } from "./leaflet-map";

// Leaflet needs `window`; load it only in the browser and keep it out of the main bundle.
const LeafletMap = dynamic(() => import("./leaflet-map").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

const hasCoords = (i: ItineraryItemView) => i.latitude != null && i.longitude != null;
const pos = (i: ItineraryItemView): LatLng => ({ lat: i.latitude!, lng: i.longitude! });

function kindOf(i: ItineraryItemView): MapMarker["kind"] {
  if (i.status === "DONE") return "done";
  if (i.category === "LODGING") return "lodging";
  if (i.category === "AIRPORT") return "airport";
  if (i.category === "FOOD" || i.category === "CAFE") return "food";
  return "stop";
}

export function MapPageClient({ tripId, initialData }: { tripId: string; initialData: Itinerary }) {
  const qc = useQueryClient();
  const { data = initialData } = useItinerary(tripId, initialData);
  const today = todayInTimeZone(data.trip.timezone);
  const [dayFilter, setDayFilter] = useState<string | "all">(() => data.days.find((d) => d.date === today)?.id ?? data.days[0]?.id ?? "all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [me, setMe] = useState<LatLng | null>(null);

  const visibleDays: DayView[] = dayFilter === "all" ? data.days : data.days.filter((d) => d.id === dayFilter);
  const markers = useMemo<MapMarker[]>(
    () =>
      visibleDays.flatMap((d) =>
        d.items.filter(hasCoords).map((i) => ({
          id: i.id,
          position: pos(i),
          // Same numbering as the list: the stop's order within its day.
          label: dayFilter === "all" ? String(d.dayNumber) : String(d.items.indexOf(i) + 1),
          title: `${formatMinute(i.startMinute)} ${i.title}`,
          kind: kindOf(i),
          selected: i.id === selectedId,
        })),
      ),
    [visibleDays, dayFilter, selectedId],
  );
  const route = useMemo(() => (dayFilter === "all" ? [] : (visibleDays[0]?.items.filter(hasCoords).map(pos) ?? [])), [visibleDays, dayFilter]);
  const center = data.trip.center ?? markers[0]?.position ?? { lat: 37.5665, lng: 126.978 };

  const selectedDay = data.days.find((d) => d.items.some((i) => i.id === selectedId));
  const selected = selectedDay?.items.find((i) => i.id === selectedId);
  const nextStop = selected && selectedDay ? selectedDay.items[selectedDay.items.indexOf(selected) + 1] : undefined;
  const nextTravel =
    selected && nextStop
      ? nextStop.travelMinutesFromPrev ??
        (hasCoords(selected) && hasCoords(nextStop) ? estimateTravelMinutes(pos(selected), pos(nextStop), suggestMode(pos(selected), pos(nextStop))) : null)
      : null;

  const geocode = useMutation({
    mutationFn: (itemId: string) => apiFetch<{ days: DayView[] }>(`/api/trips/${tripId}/items/${itemId}/geocode`, { method: "POST", body: {} }),
    onSuccess: (r) => {
      qc.setQueryData<Itinerary>(itineraryKey(tripId), (c) => c && { ...c, days: c.days.map((d) => r.days.find((x) => x.id === d.id) ?? d) });
      toast.success("위치를 찾았어요.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const locate = () =>
    navigator.geolocation?.getCurrentPosition(
      (p) => setMe({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => toast.error("현재 위치를 확인할 수 없어요. 위치 권한을 확인해 주세요."),
      { timeout: 8000 },
    );

  const listItems = visibleDays.flatMap((d) => d.items.map((i) => ({ day: d, item: i })));
  const missing = listItems.filter(({ item }) => !hasCoords(item));

  return (
    <div className="space-y-4">
      <DaySwitcher
        label="날짜 필터"
        days={data.days}
        selected={dayFilter}
        today={today}
        allLabel="전체"
        onSelect={(id) => {
          setDayFilter(id);
          setSelectedId(null);
        }}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative h-[52dvh] min-h-80 overflow-hidden rounded-xl border lg:h-[calc(100dvh-16rem)]">
          <LeafletMap markers={markers} route={route} center={center} me={me} onSelect={setSelectedId} />
          <Button
            variant="outline"
            size="icon"
            onClick={locate}
            aria-label="현재 위치 표시"
            className="absolute right-3 bottom-3 z-[500] bg-background shadow-md"
          >
            <LocateIcon />
          </Button>
          {markers.length === 0 ? (
            <div className="absolute inset-x-4 top-4 z-[500] rounded-xl bg-background/95 px-4 py-3 text-sm shadow-md">
              표시할 장소가 없어요. 일정에 주소를 입력하거나 ‘위치 찾기’를 눌러 보세요.
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          {selected && selectedDay ? (
            <section aria-live="polite" className="rounded-lg border bg-card p-4">
              <p className="text-xs font-medium text-primary">
                DAY {selectedDay.dayNumber} · {formatShortDate(selectedDay.date)}
              </p>
              <h2 className="mt-1 text-lg font-semibold">{selected.title}</h2>
              <p className="text-sm text-muted-foreground">{CATEGORY_LABELS[selected.category]}</p>
              <dl className="mt-3 space-y-1.5 text-sm">
                {selected.address ? (
                  <div className="flex gap-2">
                    <dt>
                      <MapPinIcon className="mt-0.5 size-4 text-muted-foreground" aria-label="주소" />
                    </dt>
                    <dd>{selected.address}</dd>
                  </div>
                ) : null}
                <div className="flex gap-2">
                  <dt>
                    <ClockIcon className="mt-0.5 size-4 text-muted-foreground" aria-label="일정 시간" />
                  </dt>
                  <dd>
                    {formatMinute(selected.startMinute)} · 예상 체류 {formatDuration(selected.durationMinutes)}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt>
                    <NavigationIcon className="mt-0.5 size-4 text-muted-foreground" aria-label="다음 장소까지" />
                  </dt>
                  <dd>
                    {nextStop
                      ? `다음 장소(${nextStop.title})까지 ${nextStop.transportMode ? TRANSPORT_LABELS[nextStop.transportMode] : "이동"} ${nextTravel ?? 15}분`
                      : "이 날의 마지막 장소예요."}
                  </dd>
                </div>
              </dl>
            </section>
          ) : (
            <p className="rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground">지도에서 장소를 누르면 자세한 정보를 보여드려요.</p>
          )}

          <ol className="divide-y rounded-lg border bg-card">
            {listItems.length === 0 ? <li className="px-4 py-5 text-sm text-muted-foreground">이 날에는 일정이 없어요.</li> : null}
            {listItems.map(({ day, item }) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => hasCoords(item) && setSelectedId(item.id)}
                  className={cn("flex w-full items-center gap-3 px-4 py-3 text-left", item.id === selectedId && "bg-secondary")}
                >
                  <span className="flex w-20 shrink-0 items-center gap-2 text-xs font-semibold text-muted-foreground tabular-nums">
                    <span className="flex size-5 items-center justify-center rounded-full bg-secondary text-[11px] text-secondary-foreground">
                      {dayFilter === "all" ? day.dayNumber : day.items.indexOf(item) + 1}
                    </span>
                    {formatMinute(item.startMinute)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.title}</span>
                  {!hasCoords(item) ? <MapPinOffIcon className="size-4 text-muted-foreground" aria-label="위치 정보 없음" /> : null}
                </button>
              </li>
            ))}
          </ol>

          {missing.length > 0 && data.trip.role !== "VIEWER" ? (
            <section className="rounded-lg bg-muted/60 p-4 text-sm">
              <p className="font-medium">위치 정보가 없는 일정 {missing.length}개</p>
              <ul className="mt-2 space-y-2">
                {missing.slice(0, 5).map(({ item }) => (
                  <li key={item.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{item.title}</span>
                    <Button size="sm" variant="outline" onClick={() => geocode.mutate(item.id)} disabled={geocode.isPending}>
                      <SearchIcon data-icon="inline-start" aria-hidden />
                      위치 찾기
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
