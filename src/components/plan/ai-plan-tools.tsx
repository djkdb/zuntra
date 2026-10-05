"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRightIcon, Loader2Icon, RefreshCwIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, errorMessage } from "@/lib/api-client";
import { type DayView, formatDuration, formatMinute } from "@/lib/itinerary";
import { cn } from "@/lib/utils";
import type { Itinerary } from "@/server/services/itinerary-service";
import { itineraryKey } from "./use-itinerary";

type GenerateMode = "fill_empty" | "replace_all" | "day";

function useApplyDays(tripId: string) {
  const qc = useQueryClient();
  return (days: DayView[]) =>
    qc.setQueryData<Itinerary>(itineraryKey(tripId), (current) => {
      if (!current) return current;
      const byId = new Map(days.map((d) => [d.id, d]));
      return { ...current, days: current.days.map((d) => byId.get(d.id) ?? d) };
    });
}

export function GeneratePlanDialog({
  tripId,
  day,
  hasEmptyDays,
  totalItems,
  open,
  onOpenChange,
  initialMode,
}: {
  tripId: string;
  day: DayView;
  hasEmptyDays: boolean;
  /** Items across the whole trip, to say how many a full rebuild replaces. */
  totalItems: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: GenerateMode;
}) {
  const applyDays = useApplyDays(tripId);
  const [mode, setMode] = useState<GenerateMode>(initialMode ?? (hasEmptyDays ? "fill_empty" : "day"));
  const [request, setRequest] = useState("");
  const generate = useMutation({
    mutationFn: () =>
      apiFetch<{ days: DayView[]; summary: string; warnings: string[] }>(`/api/trips/${tripId}/plan/generate`, {
        method: "POST",
        body: { mode, dayId: mode === "day" ? day.id : undefined, request: request.trim() || undefined },
      }),
    onSuccess: (result) => {
      applyDays(result.days);
      toast.success(result.summary || "일정을 만들었어요.", {
        description: result.warnings.length ? result.warnings.slice(0, 3).join("\n") : undefined,
      });
      onOpenChange(false);
    },
  });

  const options: { value: GenerateMode; label: string; description: string; disabled?: boolean }[] = [
    {
      value: "fill_empty",
      label: "비어 있는 날 채우기",
      description: "이미 만든 일정은 그대로 두고 빈 날만 채워요.",
      disabled: !hasEmptyDays,
    },
    { value: "day", label: `${day.dayNumber}일차만 새로 만들기`, description: "이 날의 일정을 AI 일정으로 바꿔요." },
    { value: "replace_all", label: "전체 다시 만들기", description: "모든 날의 일정을 새로 만들어요. 기존 일정은 사라져요." },
  ];

  // What this run would replace. Hand-made plans should never vanish without saying so.
  const replaced = mode === "day" ? day.items.length : mode === "replace_all" ? totalItems : 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !generate.isPending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="size-5 text-primary" aria-hidden />
            AI 일정 만들기
          </DialogTitle>
          <DialogDescription>여행 정보와 취향, 이동시간을 고려해 실제로 다닐 수 있는 일정을 만들어요.</DialogDescription>
        </DialogHeader>

        {generate.isPending ? (
          <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="relative flex size-14 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              <SparklesIcon className="size-7 text-primary" aria-hidden />
            </span>
            <p className="text-lg font-semibold">여행 계획을 만들고 있어요...</p>
            <p className="text-sm text-muted-foreground">장소를 고르고 이동시간을 계산하는 중이에요.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <FormMessage message={generate.isError ? errorMessage(generate.error) : undefined} />
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">무엇을 만들까요?</legend>
              {options.map((o) => (
                <label
                  key={o.value}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-xl border p-3.5 has-[:checked]:border-primary has-[:checked]:bg-secondary",
                    o.disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <input
                    type="radio"
                    name="mode"
                    value={o.value}
                    checked={mode === o.value}
                    disabled={o.disabled}
                    onChange={() => setMode(o.value)}
                    className="mt-1 accent-[var(--primary)]"
                  />
                  <span>
                    <span className="block font-medium">{o.label}</span>
                    <span className="block text-xs text-muted-foreground">{o.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {replaced > 0 ? (
              <p role="note" className="rounded-lg border border-warning/50 bg-warning/10 px-3 py-2.5 text-sm">
                지금 있는 일정 {replaced}개가 AI 일정으로 바뀌어요. 직접 넣은 일정도 포함돼요.
              </p>
            ) : null}
            <Field label="AI에게 바라는 점" optional hint="예: 맛집과 카페를 좋아하고 너무 빡빡한 일정은 싫어.">
              {(p) => (
                <Textarea {...p} rows={3} maxLength={500} value={request} onChange={(e) => setRequest(e.target.value)} />
              )}
            </Field>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generate.isPending}>
            취소
          </Button>
          <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? <Loader2Icon className="animate-spin" data-icon="inline-start" aria-hidden /> : null}
            {replaced > 0 ? `${replaced}개 바꾸고 만들기` : "일정 만들기"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ProposedChange {
  itemId: string;
  title: string;
  action: "MOVE" | "SHORTEN" | "REMOVE";
  from: { startMinute: number; durationMinutes: number };
  to: { startMinute: number; durationMinutes: number } | null;
  reason: string;
}

const REASONS = ["일정이 늦어졌어요", "피곤해요", "비가 와요", "여기 1시간 더 있을래요"];

export function RescheduleDialog({
  tripId,
  day,
  open,
  onOpenChange,
}: {
  tripId: string;
  day: DayView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const applyDays = useApplyDays(tripId);
  const [reason, setReason] = useState("");
  const propose = useMutation({
    mutationFn: () =>
      apiFetch<{ summary: string; changes: ProposedChange[] }>(`/api/trips/${tripId}/plan/reschedule`, {
        method: "POST",
        body: { dayId: day.id, reason: reason.trim() || undefined },
      }),
  });
  const apply = useMutation({
    mutationFn: (changes: ProposedChange[]) =>
      apiFetch<{ days: DayView[] }>(`/api/trips/${tripId}/plan/reschedule/apply`, {
        method: "POST",
        body: {
          dayId: day.id,
          changes: changes.map((c) => ({
            itemId: c.itemId,
            action: c.action,
            startMinute: c.to?.startMinute ?? null,
            durationMinutes: c.to?.durationMinutes ?? null,
          })),
        },
      }),
    onSuccess: (result) => {
      applyDays(result.days);
      toast.success("AI 제안대로 일정을 조정했어요.");
      onOpenChange(false);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const busy = propose.isPending || apply.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCwIcon className="size-5 text-primary" aria-hidden />
            AI 일정 조정
          </DialogTitle>
          <DialogDescription>
            DAY {day.dayNumber} 일정을 현재 상황에 맞게 조정해요. 적용하기 전에 변경 내용을 확인할 수 있어요.
          </DialogDescription>
        </DialogHeader>

        {propose.data ? (
          <div className="space-y-4">
            <p className="rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground">{propose.data.summary}</p>
            {propose.data.changes.length > 0 ? (
              <ul className="divide-y rounded-xl border">
                {propose.data.changes.map((c) => (
                  <li key={c.itemId} className="px-4 py-3 text-sm">
                    <p className={cn("font-medium", c.action === "REMOVE" && "text-muted-foreground line-through")}>{c.title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-muted-foreground tabular-nums">
                      <span>
                        {formatMinute(c.from.startMinute)} · {formatDuration(c.from.durationMinutes)}
                      </span>
                      <ArrowRightIcon className="size-3.5" aria-label="에서" />
                      <span className={cn("font-medium", c.action === "REMOVE" ? "text-destructive" : "text-foreground")}>
                        {c.to ? `${formatMinute(c.to.startMinute)} · ${formatDuration(c.to.durationMinutes)}` : "삭제"}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{c.reason}</p>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : propose.isPending ? (
          <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-10">
            <Loader2Icon className="size-7 animate-spin text-primary" aria-hidden />
            <p className="font-medium">남은 일정을 다시 계산하고 있어요...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <FormMessage message={propose.isError ? errorMessage(propose.error) : undefined} />
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  aria-pressed={reason === r}
                  className="rounded-full border px-3.5 py-2 text-sm aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                >
                  {r}
                </button>
              ))}
            </div>
            <Field label="상황 설명" optional>
              {(p) => <Textarea {...p} rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />}
            </Field>
          </div>
        )}

        <DialogFooter>
          {propose.data ? (
            <>
              <Button variant="outline" onClick={() => propose.reset()} disabled={busy}>
                다시 제안받기
              </Button>
              {propose.data.changes.length > 0 ? (
                <Button onClick={() => apply.mutate(propose.data!.changes)} disabled={busy}>
                  {apply.isPending ? <Loader2Icon className="animate-spin" data-icon="inline-start" aria-hidden /> : null}
                  적용하기
                </Button>
              ) : (
                <Button onClick={() => onOpenChange(false)}>확인</Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                취소
              </Button>
              <Button onClick={() => propose.mutate()} disabled={busy}>
                제안 받기
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
