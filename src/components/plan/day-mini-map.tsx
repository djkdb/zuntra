"use client";

import { MapPinOffIcon } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import type { MapMarker } from "@/components/map/leaflet-map";
import { Skeleton } from "@/components/ui/skeleton";
import type { DayView } from "@/lib/itinerary";

const LeafletMap = dynamic(() => import("@/components/map/leaflet-map").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

const WIDE = "(min-width: 1280px)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/**
 * The selected day's route next to the list on wide screens. Leaflet is only loaded when the
 * viewport is wide enough to show it, so phones never pay for it.
 */
export function DayMiniMap({
  tripId,
  day,
  center,
  selectedId,
  onSelect,
}: {
  tripId: string;
  day: DayView;
  center: { lat: number; lng: number } | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const wide = useSyncExternalStore(subscribe, () => window.matchMedia(WIDE).matches, () => false);
  const located = useMemo(() => day.items.filter((i) => i.latitude != null && i.longitude != null), [day.items]);
  const markers = useMemo<MapMarker[]>(
    () =>
      located.map((i) => ({
        id: i.id,
        position: { lat: i.latitude!, lng: i.longitude! },
        label: String(day.items.indexOf(i) + 1),
        title: i.title,
        kind: i.status === "DONE" ? "done" : i.category === "LODGING" ? "lodging" : i.category === "FOOD" || i.category === "CAFE" ? "food" : "stop",
        selected: i.id === selectedId,
      })),
    [located, day.items, selectedId],
  );
  const route = useMemo(() => located.map((i) => ({ lat: i.latitude!, lng: i.longitude! })), [located]);
  if (!wide) return null;

  const missing = day.items.length - located.length;
  return (
    <aside aria-label="이 날의 동선" className="sticky top-6 hidden overflow-hidden rounded-lg border bg-card xl:block">
      <div className="h-[min(30rem,calc(100dvh-14rem))]">
        {markers.length > 0 ? (
          <LeafletMap markers={markers} route={route} center={center ?? markers[0]!.position} me={null} onSelect={onSelect} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <MapPinOffIcon className="size-5" aria-hidden />
            위치가 있는 일정이 없어요.
          </div>
        )}
      </div>
      <p className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
        <span>{missing > 0 ? `위치 없는 일정 ${missing}개` : `${located.length}곳 표시`}</span>
        <Link href={`/trips/${tripId}/map`} className="font-medium text-foreground hover:underline">
          큰 지도로 보기
        </Link>
      </p>
    </aside>
  );
}
