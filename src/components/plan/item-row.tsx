"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRightLeftIcon,
  CheckIcon,
  CircleDashedIcon,
  GripVerticalIcon,
  MapPinIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatMoney } from "@/lib/format";
import { CATEGORY_LABELS, type ItineraryItemView, formatDuration, formatMinute } from "@/lib/itinerary";
import { cn } from "@/lib/utils";

interface ItemRowProps {
  item: ItineraryItemView;
  currency: string;
  conflictMinutes?: number;
  editable: boolean;
  otherDays: { id: string; label: string }[];
  onEdit: () => void;
  onToggleDone: () => void;
  onDelete: () => void;
  onMoveToDay: (dayId: string) => void;
}

export function ItemRow({
  item,
  currency,
  conflictMinutes,
  editable,
  otherDays,
  onEdit,
  onToggleDone,
  onDelete,
  onMoveToDay,
}: ItemRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !editable,
  });
  const done = item.status === "DONE";

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative flex items-stretch gap-2", isDragging && "z-10 opacity-90")}
    >
      <time className={cn("w-12 shrink-0 pt-3.5 text-sm font-semibold tabular-nums", done && "text-muted-foreground")}>
        {formatMinute(item.startMinute)}
      </time>
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1 rounded-xl border bg-card py-2 pr-1 pl-1 transition-shadow",
          isDragging && "shadow-lg ring-2 ring-primary",
          conflictMinutes && "border-warning ring-1 ring-warning",
          done && "bg-muted/50",
        )}
      >
        {editable ? (
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`${item.title} 순서 이동`}
            className="flex size-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground hover:bg-muted active:cursor-grabbing"
          >
            <GripVerticalIcon className="size-4" aria-hidden />
          </button>
        ) : (
          <span className="w-2" />
        )}
        <button type="button" onClick={editable ? onEdit : undefined} className="min-w-0 flex-1 py-1 text-left" disabled={!editable}>
          <span className={cn("flex items-center gap-1.5 font-medium", done && "text-muted-foreground line-through decoration-1")}>
            <span className="truncate">{item.title}</span>
            {item.source === "AI" ? <SparklesIcon className="size-3.5 shrink-0 text-primary" aria-label="AI 추천" /> : null}
          </span>
          <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
            <span>{CATEGORY_LABELS[item.category]}</span>
            {item.durationMinutes > 0 ? <span>{formatDuration(item.durationMinutes)}</span> : null}
            {item.estimatedCost ? <span>{formatMoney(item.estimatedCost, currency)}</span> : null}
            {item.address ? (
              <span className="inline-flex max-w-full items-center gap-0.5 truncate">
                <MapPinIcon className="size-3" aria-hidden />
                {item.address}
              </span>
            ) : null}
          </span>
          {item.note ? <span className="mt-1 block truncate text-xs text-foreground/70">{item.note}</span> : null}
          {conflictMinutes ? (
            <span className="mt-1 block text-xs font-medium text-[oklch(0.5_0.12_60)] dark:text-warning">
              이전 일정과 {conflictMinutes}분 겹쳐요
            </span>
          ) : null}
        </button>
        {editable ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleDone}
              aria-label={done ? `${item.title} 완료 취소` : `${item.title} 완료로 표시`}
              aria-pressed={done}
            >
              {done ? <CheckIcon className="text-success" /> : <CircleDashedIcon />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`${item.title} 더보기`}>
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={onEdit}>
                  <PencilIcon aria-hidden />
                  수정
                </DropdownMenuItem>
                {otherDays.length > 0 ? (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <ArrowRightLeftIcon aria-hidden />
                      다른 날로 이동
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {otherDays.map((d) => (
                        <DropdownMenuItem key={d.id} onSelect={() => onMoveToDay(d.id)}>
                          {d.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                  <Trash2Icon aria-hidden />
                  삭제
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : null}
      </div>
    </div>
  );
}
