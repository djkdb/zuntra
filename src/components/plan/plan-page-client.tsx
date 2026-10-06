"use client";

import { PlaneIcon, RefreshCwIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { DayView } from "@/lib/itinerary";
import type { Itinerary } from "@/server/services/itinerary-service";
import { GeneratePlanDialog, RescheduleDialog } from "./ai-plan-tools";
import { FlightDialog } from "./flight-dialog";
import { PlanEditor } from "./plan-editor";
import { useItinerary } from "./use-itinerary";

type Open =
  | { kind: "generate"; day: DayView; mode?: "day" }
  | { kind: "reschedule"; day: DayView }
  | { kind: "flight"; day: DayView; direction: "arrival" | "departure" }
  | null;

/** The plan editor plus its AI tools (generate / reschedule). */
export function PlanPageClient({ tripId, initialData, initialDayNumber }: { tripId: string; initialData: Itinerary; initialDayNumber?: number }) {
  const [open, setOpen] = useState<Open>(null);
  const { data } = useItinerary(tripId, initialData);
  const days = (data ?? initialData).days;
  // Days holding only bookings (a flight) still count as empty for the AI.
  const hasEmptyDays = days.some((d) => d.items.every((i) => i.isFixed));
  // Flights go on the first and last day, until one is entered there.
  const flightFor = (day: DayView) => {
    const booked = day.items.some((i) => i.isFixed && i.category === "AIRPORT");
    if (booked || days.length < 2) return null;
    return day.id === days[0]?.id ? "arrival" : day.id === days.at(-1)?.id ? "departure" : null;
  };

  return (
    <>
      <PlanEditor
        tripId={tripId}
        initialData={initialData}
        initialDayNumber={initialDayNumber}
        renderDayTools={({ day }) => (
          <>
            {flightFor(day) ? (
              <Button variant="outline" className="col-span-2 sm:col-auto" onClick={() => setOpen({ kind: "flight", day, direction: flightFor(day)! })}>
                <PlaneIcon data-icon="inline-start" aria-hidden />
                {flightFor(day) === "arrival" ? "도착 항공편 넣기" : "귀국 항공편 넣기"}
              </Button>
            ) : null}
            {day.items.length > 0 ? (
              <Button variant="outline" onClick={() => setOpen({ kind: "reschedule", day })}>
                <RefreshCwIcon data-icon="inline-start" aria-hidden />
                <span className="truncate">AI 일정 조정</span>
              </Button>
            ) : null}
            <Button
              variant="outline"
              className={day.items.length === 0 ? "col-span-2" : undefined}
              onClick={() => setOpen({ kind: "generate", day })}
            >
              <SparklesIcon data-icon="inline-start" aria-hidden />
              AI 일정 만들기
            </Button>
          </>
        )}
        renderEmptyDayAction={({ day }) => (
          <Button onClick={() => setOpen({ kind: "generate", day, mode: "day" })}>
            <SparklesIcon data-icon="inline-start" aria-hidden />
            AI로 이 날 일정 만들기
          </Button>
        )}
      />
      {open?.kind === "generate" ? (
        <GeneratePlanDialog
          tripId={tripId}
          day={open.day}
          hasEmptyDays={hasEmptyDays}
          totalItems={days.reduce((n, d) => n + d.items.filter((i) => !i.isFixed).length, 0)}
          initialMode={open.mode}
          open
          onOpenChange={(o) => !o && setOpen(null)}
        />
      ) : null}
      {open?.kind === "flight" ? (
        <FlightDialog tripId={tripId} day={open.day} direction={open.direction} open onOpenChange={(o) => !o && setOpen(null)} />
      ) : null}
      {open?.kind === "reschedule" ? (
        <RescheduleDialog tripId={tripId} day={open.day} open onOpenChange={(o) => !o && setOpen(null)} />
      ) : null}
    </>
  );
}
