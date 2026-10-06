"use client";

import { Loader2Icon, PlaneLandingIcon, PlaneTakeoffIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import type { DayView } from "@/lib/itinerary";
import { useItineraryMutations } from "./use-itinerary";

/**
 * Enter a booked flight. Arrival becomes "landing → immigration" from the landing time, departure
 * becomes "check-in" for the two hours before take-off; both are fixed so nothing is planned on top.
 */
export function FlightDialog({
  tripId,
  day,
  direction,
  open,
  onOpenChange,
}: {
  tripId: string;
  day: DayView;
  direction: "arrival" | "departure";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { addFlight } = useItineraryMutations(tripId);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const arrival = direction === "arrival";

  return (
    <Dialog open={open} onOpenChange={(o) => !addFlight.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {arrival ? <PlaneLandingIcon className="size-5 text-primary" aria-hidden /> : <PlaneTakeoffIcon className="size-5 text-primary" aria-hidden />}
            {arrival ? "도착 항공편" : "귀국 항공편"}
          </DialogTitle>
          <DialogDescription>
            DAY {day.dayNumber} · 현지 시간으로 적어 주세요. {arrival ? "착륙 후 입국 심사 시간까지" : "출발 2시간 전부터 공항 일정으로"} 고정해 두고, AI는
            그 시간을 피해서 일정을 짜요.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setErrors({});
            try {
              await addFlight.mutateAsync({
                direction,
                dayId: day.id,
                flightNumber: fd.get("flightNumber"),
                airport: fd.get("airport"),
                time: fd.get("time"),
                otherEnd: fd.get("otherEnd"),
              });
              toast.success(arrival ? "도착 항공편을 넣었어요." : "귀국 항공편을 넣었어요.");
              onOpenChange(false);
            } catch (error) {
              if (error instanceof ApiError && error.fields) setErrors(error.fields);
            }
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="편명" error={errors.flightNumber}>
              {(p) => <Input {...p} name="flightNumber" maxLength={12} placeholder="예: KE723" autoCapitalize="characters" required autoFocus />}
            </Field>
            <Field label={arrival ? "도착 시간(현지)" : "출발 시간(현지)"} error={errors.time}>
              {(p) => <Input {...p} type="time" name="time" step={300} required />}
            </Field>
          </div>
          <Field label={arrival ? "도착 공항" : "출발 공항"} optional error={errors.airport}>
            {(p) => <Input {...p} name="airport" maxLength={40} placeholder="예: 간사이공항" />}
          </Field>
          <Field label={arrival ? "출발지" : "도착지"} optional error={errors.otherEnd} hint="메모에 함께 적어 둬요.">
            {(p) => <Input {...p} name="otherEnd" maxLength={60} placeholder={arrival ? "예: 인천 09:05" : "예: 인천"} />}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={addFlight.isPending}>
              취소
            </Button>
            <Button type="submit" disabled={addFlight.isPending}>
              {addFlight.isPending ? <Loader2Icon className="animate-spin" data-icon="inline-start" aria-hidden /> : null}
              넣기
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
