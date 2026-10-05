"use client";

import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { Field, FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { PlaceCategory, TransportMode } from "@/generated/prisma/enums";
import { ApiError } from "@/lib/api-client";
import { CATEGORY_LABELS, type ItineraryItemView, TRANSPORT_LABELS, formatMinute } from "@/lib/itinerary";
import { minuteFromTime } from "@/lib/schedule";

const DURATIONS = [0, 15, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360];

export interface ItemDraft {
  title: string;
  category: PlaceCategory;
  startMinute: number;
  durationMinutes: number;
  transportMode: TransportMode | null;
  travelMinutesFromPrev: number | null;
  estimatedCost: number | null;
  address: string | null;
  note: string | null;
}

interface ItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  dayLabel: string;
  currency: string;
  initial?: Partial<ItineraryItemView>;
  /** Resolves on success; rejects with ApiError to show field errors. */
  onSubmit: (draft: ItemDraft) => Promise<unknown>;
}

export function ItemDialog({ open, onOpenChange, mode, dayLabel, currency, initial, onSubmit }: ItemDialogProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const startMinute = minuteFromTime(String(fd.get("startTime") ?? ""));
    if (startMinute === null) {
      setErrors({ startMinute: "시작 시간을 입력해 주세요." });
      return;
    }
    const num = (key: string) => {
      const v = String(fd.get(key) ?? "").replace(/[,\s]/g, "");
      return v === "" ? null : Number(v);
    };
    const text = (key: string) => {
      const v = String(fd.get(key) ?? "").trim();
      return v === "" ? null : v;
    };
    setPending(true);
    setErrors({});
    setMessage(undefined);
    try {
      await onSubmit({
        title: String(fd.get("title") ?? ""),
        category: fd.get("category") as PlaceCategory,
        startMinute,
        durationMinutes: Number(fd.get("durationMinutes") ?? 60),
        transportMode: (text("transportMode") as TransportMode | null) ?? null,
        travelMinutesFromPrev: num("travelMinutesFromPrev"),
        estimatedCost: num("estimatedCost"),
        address: text("address"),
        note: text("note"),
      });
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fields ?? {});
        setMessage(error.message);
      } else {
        setMessage("저장하지 못했어요. 다시 시도해 주세요.");
      }
    } finally {
      setPending(false);
    }
  };

  const duration = initial?.durationMinutes ?? 60;
  const durationOptions = DURATIONS.includes(duration) ? DURATIONS : [...DURATIONS, duration].sort((a, b) => a - b);

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "일정 추가" : "일정 수정"}</DialogTitle>
          <DialogDescription>{dayLabel}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <FormMessage message={message} />
          <Field label="장소 또는 할 일" error={errors.title}>
            {(p) => <Input {...p} name="title" defaultValue={initial?.title ?? ""} maxLength={80} placeholder="예: 전망대, 점심 식당" required autoFocus />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="카테고리" error={errors.category}>
              {(p) => (
                <NativeSelect {...p} name="category" defaultValue={initial?.category ?? "SIGHTSEEING"}>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label="시작 시간" error={errors.startMinute}>
              {(p) => (
                <Input
                  {...p}
                  type="time"
                  name="startTime"
                  step={300}
                  defaultValue={initial?.startMinute !== undefined ? formatMinute(initial.startMinute) : "10:00"}
                  required
                />
              )}
            </Field>
          </div>
          <Field label="예상 체류시간" error={errors.durationMinutes}>
            {(p) => (
              <NativeSelect {...p} name="durationMinutes" defaultValue={String(duration)}>
                {durationOptions.map((m) => (
                  <option key={m} value={m}>
                    {m === 0 ? "체류 없음" : m < 60 ? `${m}분` : `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ""}`}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="이동수단" optional error={errors.transportMode}>
              {(p) => (
                <NativeSelect {...p} name="transportMode" defaultValue={initial?.transportMode ?? ""}>
                  <option value="">자동</option>
                  {Object.entries(TRANSPORT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
            <Field label="이전 장소에서 이동(분)" optional error={errors.travelMinutesFromPrev}>
              {(p) => (
                <Input
                  {...p}
                  name="travelMinutesFromPrev"
                  inputMode="numeric"
                  placeholder="자동"
                  defaultValue={initial?.travelMinutesFromPrev ?? ""}
                />
              )}
            </Field>
          </div>
          <Field label={`예상 비용 (${currency})`} optional error={errors.estimatedCost}>
            {(p) => <Input {...p} name="estimatedCost" inputMode="decimal" defaultValue={initial?.estimatedCost ?? ""} />}
          </Field>
          <Field label="주소" optional error={errors.address} hint="입력하면 지도와 이동시간 계산에 사용돼요.">
            {(p) => <Input {...p} name="address" maxLength={200} defaultValue={initial?.address ?? ""} />}
          </Field>
          <Field label="메모" optional error={errors.note}>
            {(p) => <Textarea {...p} name="note" rows={3} maxLength={500} defaultValue={initial?.note ?? ""} />}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              취소
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" aria-hidden /> : null}
              {mode === "create" ? "추가하기" : "저장하기"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
