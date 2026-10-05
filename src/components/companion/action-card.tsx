"use client";

import { ArrowRightIcon, CheckCircle2Icon, Loader2Icon, XCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AIActionView } from "@/lib/ai-actions";
import { formatMoney } from "@/lib/format";
import { formatDuration, formatMinute } from "@/lib/itinerary";
import { cn } from "@/lib/utils";

function describe(action: AIActionView, currency: string): React.ReactNode {
  const p = action.payload as Record<string, never>;
  switch (action.type) {
    case "ADD_PLACE":
      return (
        <>
          <b className="font-semibold">{p.title}</b> · {formatMinute(p.startMinute)} 추가 ({formatDuration(p.durationMinutes)})
        </>
      );
    case "REMOVE_PLACE":
      return (
        <>
          <b className="font-semibold">‘{p.title}’</b> 일정 빼기
        </>
      );
    case "RESCHEDULE":
      return (
        <span className="inline-flex flex-wrap items-center gap-1">
          <b className="font-semibold">‘{p.title}’</b> {formatMinute(p.fromStartMinute)} · {formatDuration(p.fromDurationMinutes)}
          <ArrowRightIcon className="size-3.5" aria-label="에서" />
          {formatMinute(p.startMinute)} · {formatDuration(p.durationMinutes)}, 이후 일정 자동 조정
        </span>
      );
    case "REPLACE_PLACE":
    case "SUGGEST_ALTERNATIVE":
      return (
        <span className="inline-flex flex-wrap items-center gap-1">
          {p.fromTitle ? (
            <>
              <span className="line-through opacity-70">{p.fromTitle}</span>
              <ArrowRightIcon className="size-3.5" aria-label="대신" />
            </>
          ) : null}
          <b className="font-semibold">{p.title}</b>
          {!p.fromTitle && typeof p.startMinute === "number" ? ` · ${formatMinute(p.startMinute)}` : null}
        </span>
      );
    case "UPDATE_BUDGET":
      return (
        <>
          총 예산 {p.previous !== null ? `${formatMoney(p.previous, currency)} → ` : ""}
          <b className="font-semibold">{formatMoney(p.amount, currency)}</b>
        </>
      );
    case "CREATE_NOTE":
      return <>Day {p.dayNumber} 메모: “{p.note}”</>;
    case "CREATE_JOURNAL":
      return <>여행 기록: “{String(p.content).slice(0, 80)}”</>;
  }
}

export function ActionCard({
  action,
  currency,
  canEdit,
  pending,
  onDecide,
}: {
  action: AIActionView;
  currency: string;
  canEdit: boolean;
  pending: boolean;
  onDecide: (decision: "approve" | "reject") => void;
}) {
  const done = action.status !== "PROPOSED";
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3.5 text-sm",
        action.status === "EXECUTED" && "border-success/40 bg-success/5",
        done && action.status !== "EXECUTED" && "opacity-70",
      )}
    >
      <p className="leading-relaxed">{describe(action, currency)}</p>
      {action.status === "PROPOSED" && canEdit ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onDecide("approve")} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" aria-hidden /> : null}
            {action.label}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDecide("reject")} disabled={pending}>
            괜찮아요
          </Button>
        </div>
      ) : (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground" role="status">
          {action.status === "EXECUTED" ? (
            <>
              <CheckCircle2Icon className="size-3.5 text-success" aria-hidden /> 적용했어요
            </>
          ) : action.status === "REJECTED" ? (
            <>
              <XCircleIcon className="size-3.5" aria-hidden /> 적용하지 않았어요
            </>
          ) : action.status === "EXPIRED" ? (
            "만료된 제안이에요"
          ) : action.status === "FAILED" ? (
            <span className="text-destructive">적용하지 못했어요{action.error ? ` · ${action.error}` : ""}</span>
          ) : action.status === "APPROVED" ? (
            "적용 중…"
          ) : (
            "보기 전용 여행이에요"
          )}
        </p>
      )}
    </div>
  );
}
