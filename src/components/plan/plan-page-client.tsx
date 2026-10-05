"use client";

import { RefreshCwIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { DayView } from "@/lib/itinerary";
import type { Itinerary } from "@/server/services/itinerary-service";
import { GeneratePlanDialog, RescheduleDialog } from "./ai-plan-tools";
import { PlanEditor } from "./plan-editor";
import { useItinerary } from "./use-itinerary";

type Open = { kind: "generate"; day: DayView; mode?: "day" } | { kind: "reschedule"; day: DayView } | null;

/** The plan editor plus its AI tools (generate / reschedule). */
export function PlanPageClient({ tripId, initialData, initialDayNumber }: { tripId: string; initialData: Itinerary; initialDayNumber?: number }) {
  const [open, setOpen] = useState<Open>(null);
  const { data } = useItinerary(tripId, initialData);
  const hasEmptyDays = (data ?? initialData).days.some((d) => d.items.length === 0);

  return (
    <>
      <PlanEditor
        tripId={tripId}
        initialData={initialData}
        initialDayNumber={initialDayNumber}
        renderDayTools={({ day }) => (
          <>
            {day.items.length > 0 ? (
              <Button variant="outline" onClick={() => setOpen({ kind: "reschedule", day })}>
                <RefreshCwIcon data-icon="inline-start" aria-hidden />
                <span className="truncate">AI로 일정 다시 맞추기</span>
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
          totalItems={(data ?? initialData).days.reduce((n, d) => n + d.items.length, 0)}
          initialMode={open.mode}
          open
          onOpenChange={(o) => !o && setOpen(null)}
        />
      ) : null}
      {open?.kind === "reschedule" ? (
        <RescheduleDialog tripId={tripId} day={open.day} open onOpenChange={(o) => !o && setOpen(null)} />
      ) : null}
    </>
  );
}
