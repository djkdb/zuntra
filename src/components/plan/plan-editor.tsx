"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  AlertTriangleIcon,
  CalendarPlusIcon,
  CarTaxiFrontIcon,
  FootprintsIcon,
  PlusIcon,
  TrainFrontIcon,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api-client";
import { withJosa } from "@/lib/korean";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";
import { formatShortDate, todayInTimeZone } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { type DayView, type ItineraryItemView, TRANSPORT_LABELS, formatMinute } from "@/lib/itinerary";
import { analyzeDay, endOf, formatDelay, reflowDay } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import type { Itinerary } from "@/server/services/itinerary-service";
import { type ItemDraft, ItemDialog } from "./item-dialog";
import { DayMiniMap } from "./day-mini-map";
import { DaySwitcher } from "./day-switcher";
import { DayTitleEditor } from "./day-title-editor";
import { ItemRow } from "./item-row";
import { useItinerary, useItineraryMutations } from "./use-itinerary";

type DialogState = { mode: "create" } | { mode: "edit"; item: ItineraryItemView } | null;

interface PlanEditorProps {
  tripId: string;
  initialData: Itinerary;
  /** Extra controls rendered next to "일정 추가" (AI tools). */
  renderDayTools?: (ctx: { day: DayView; editable: boolean }) => React.ReactNode;
  renderEmptyDayAction?: (ctx: { day: DayView }) => React.ReactNode;
  /** From `/plan?day=3` links. */
  initialDayNumber?: number;
}

export function PlanEditor({ tripId, initialData, renderDayTools, renderEmptyDayAction, initialDayNumber }: PlanEditorProps) {
  const query = useItinerary(tripId, initialData);
  const m = useItineraryMutations(tripId);
  const data = query.data;

  const today = data ? todayInTimeZone(data.trip.timezone) : "";
  const [selectedDayId, setSelectedDayId] = useState<string>(() => {
    const days = initialData.days;
    const linked = initialDayNumber ? days.find((d) => d.dayNumber === initialDayNumber) : undefined;
    return (linked ?? days.find((d) => d.date === todayInTimeZone(initialData.trip.timezone)) ?? days[0])?.id ?? "";
  });

  // Stable id keeps dnd-kit's aria attributes identical between server and client renders.
  const dndId = useId();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [dismissedIssues, setDismissedIssues] = useState<string | null>(null);
  const [mapSelectedId, setMapSelectedId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const day = data?.days.find((d) => d.id === selectedDayId) ?? data?.days[0];
  const issues = useMemo(() => (day ? analyzeDay(day.items) : []), [day]);
  const conflicts = useMemo(() => new Map(issues.filter((i) => i.type === "OVERLAP").map((i) => [i.itemId, i.minutes])), [issues]);
  const preview = useMemo(() => (day ? reflowDay(day.items) : null), [day]);
  const issueSignature = day ? `${day.id}:${issues.map((i) => `${i.itemId}${i.minutes}`).join(",")}` : "";

  if (query.isError && !data) {
    return <ErrorState onRetry={() => query.refetch()} />;
  }
  if (!data || !day) return null;

  const editable = data.trip.role !== "VIEWER";
  const dayLabel = `DAY ${day.dayNumber} · ${formatShortDate(day.date)}`;
  const totalCost = day.items.reduce((sum, i) => sum + (i.estimatedCost ?? 0), 0);
  const lastEnd = day.items.length ? Math.max(...day.items.map(endOf)) : null;
  const otherDays = data.days
    .filter((d) => d.id !== day.id)
    .map((d) => ({ id: d.id, label: `DAY ${d.dayNumber} · ${formatShortDate(d.date)}` }));

  const titleOf = (id: string | number) => day.items.find((i) => i.id === id)?.title ?? "일정";
  const positionOf = (id: string | number) => day.items.findIndex((i) => i.id === id) + 1;

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const toIndex = day.items.findIndex((i) => i.id === over.id);
    m.moveItem.mutate({ itemId: String(active.id), toDayId: day.id, toIndex });
  };

  const submitDraft = async (draft: ItemDraft) => {
    if (dialog?.mode === "edit") {
      const base = dialog.item;
      // Send only what changed, plus the version the dialog was opened on.
      const changes = changedFields(draft, base);
      if (Object.keys(changes).length === 0) return;
      try {
        await m.updateItem.mutateAsync({ itemId: base.id, patch: { ...changes, expectedUpdatedAt: base.updatedAt } });
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 409)) throw error;
        // Someone saved first. Different fields merge on their own; the same field is the
        // user's call, so show the latest version and let the next save be deliberate.
        const fresh = await query.refetch();
        const latest = fresh.data?.days.flatMap((d) => d.items).find((i) => i.id === base.id);
        if (!latest) throw new ApiError("NOT_FOUND", "이 일정은 다른 곳에서 삭제됐어요.", 404);
        const before: Record<string, unknown> = { ...base };
        const after: Record<string, unknown> = { ...latest };
        const clashes = Object.keys(changes).filter((k) => (after[k] ?? null) !== (before[k] ?? null));
        if (clashes.length === 0) {
          await m.updateItem.mutateAsync({ itemId: base.id, patch: { ...changes, expectedUpdatedAt: latest.updatedAt } });
          toast.success("다른 곳에서 바뀐 내용과 합쳐서 저장했어요.");
          return;
        }
        setDialog({ mode: "edit", item: latest });
        const names = clashes.map((k) => FIELD_LABELS[k] ?? k).join(", ");
        throw new ApiError("CONFLICT", `${withJosa(names, "을/를")} 다른 곳에서 먼저 바꿨어요. 확인하고 다시 저장하면 지금 입력한 내용으로 바뀌어요.`, 409);
      }
      toast.success("일정을 수정했어요.");
    } else {
      await m.addItem.mutateAsync({ dayId: day.id, ...draft });
      toast.success("일정을 추가했어요.");
    }
  };

  // Delete at once and offer an undo instead of asking first: a slip costs one tap to fix.
  const deleteWithUndo = (item: ItineraryItemView) =>
    m.deleteItem.mutate(item.id, {
      onSuccess: () =>
        toast(`‘${item.title}’ 일정을 지웠어요.`, {
          duration: 6000,
          action: {
            label: "되돌리기",
            onClick: () =>
              m.addItem.mutate(
                {
                  dayId: day.id,
                  title: item.title,
                  category: item.category,
                  startMinute: item.startMinute,
                  durationMinutes: item.durationMinutes,
                  travelMinutesFromPrev: item.travelMinutesFromPrev,
                  transportMode: item.transportMode,
                  estimatedCost: item.estimatedCost,
                  note: item.note,
                  address: item.address ?? null,
                  latitude: item.latitude ?? null,
                  longitude: item.longitude ?? null,
                },
                { onSuccess: () => toast.success("일정을 되살렸어요.") },
              ),
          },
        }),
    });

  const showAlert = editable && issues.length > 0 && dismissedIssues !== issueSignature;

  return (
    <div className="space-y-6">
      <DaySwitcher days={data.days} selected={day.id} onSelect={setSelectedDayId} today={today} />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,26rem)]">
      <section aria-labelledby="day-title" className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 id="day-title" className="text-lg font-semibold">
                {dayLabel}
              </h2>
              <DayTitleEditor
                key={day.id}
                title={day.title}
                editable={editable}
                onSave={(title) => m.updateDay.mutate({ dayId: day.id, title }, { onSuccess: () => toast.success("이 날의 제목을 바꿨어요.") })}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {day.items.length > 0
                ? `${day.items.length}개 일정${lastEnd !== null ? ` · ${formatMinute(Math.min(lastEnd, 1439))} 종료` : ""}${
                    totalCost > 0 ? ` · 예상 ${formatMoney(totalCost, data.trip.currency)}` : ""
                  }`
                : "아직 일정이 없어요"}
            </p>
          </div>
          {editable ? (
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap [&>button]:min-w-0">
              {renderDayTools?.({ day, editable })}
              <Button className="hidden sm:inline-flex" onClick={() => setDialog({ mode: "create" })}>
                <PlusIcon data-icon="inline-start" aria-hidden />
                일정 추가
              </Button>
            </div>
          ) : null}
        </div>

        {showAlert && preview ? (
          <div role="alert" className="rounded-lg border border-warning/50 bg-warning/10 p-4">
            <p className="flex items-start gap-2 font-medium">
              <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-[oklch(0.55_0.13_65)]" aria-hidden />
              {preview.maxDelay > 0
                ? `현재 일정이 ${formatDelay(preview.maxDelay)} 밀렸어요.`
                : "자정을 넘기는 일정이 있어요."}
            </p>
            <p className="mt-1 pl-6 text-sm text-muted-foreground">
              {preview.maxDelay > 0
                ? `이후 일정 ${preview.changes.length}개를 이동시간에 맞춰 자동으로 조정할까요?`
                : "일정을 줄이거나 다른 날로 옮겨 주세요."}
              {preview.overflow.length > 0 && preview.maxDelay > 0 ? " 조정하면 일부 일정이 자정을 넘겨요." : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 pl-6">
              {preview.maxDelay > 0 ? (
                <Button
                  size="sm"
                  onClick={() =>
                    m.reflowDay.mutate(
                      { dayId: day.id },
                      { onSuccess: (r) => toast.success(`일정 ${r.changes.length}개의 시간을 조정했어요.`) },
                    )
                  }
                  disabled={m.reflowDay.isPending}
                >
                  자동 조정
                </Button>
              ) : null}
              <Button size="sm" variant="outline" onClick={() => setDismissedIssues(issueSignature)}>
                직접 수정
              </Button>
            </div>
          </div>
        ) : null}

        {day.items.length === 0 ? (
          <EmptyState
            icon={CalendarPlusIcon}
            title="이 날의 일정을 채워보세요"
            description="가고 싶은 곳을 추가하거나 AI에게 하루 일정을 부탁할 수 있어요."
            action={
              editable ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {renderEmptyDayAction?.({ day })}
                  <Button variant="outline" onClick={() => setDialog({ mode: "create" })}>
                    <PlusIcon data-icon="inline-start" aria-hidden />
                    직접 추가
                  </Button>
                </div>
              ) : null
            }
          />
        ) : (
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
            accessibility={{
              screenReaderInstructions: {
                draggable: "스페이스바를 눌러 일정을 들고, 위아래 화살표로 옮긴 뒤 스페이스바로 내려놓아요. Esc를 누르면 취소돼요.",
              },
              announcements: {
                onDragStart: ({ active }) => `‘${titleOf(active.id)}’ 일정을 들었어요.`,
                onDragOver: ({ active, over }) => (over ? `${positionOf(over.id)}번째 자리 위에 있어요.` : `‘${titleOf(active.id)}’ 일정을 옮기는 중이에요.`),
                onDragEnd: ({ active, over }) => (over ? `‘${titleOf(active.id)}’ 일정을 ${positionOf(over.id)}번째로 옮겼어요.` : "옮기지 않았어요."),
                onDragCancel: ({ active }) => `‘${titleOf(active.id)}’ 일정 옮기기를 취소했어요.`,
              },
            }}
          >
            <SortableContext items={day.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
              <ol className="space-y-0" aria-label={`${dayLabel} 일정`}>
                {day.items.map((item, index) => (
                  <li
                    key={item.id}
                    id={`plan-item-${item.id}`}
                    className={cn("scroll-mt-24 rounded-lg", item.id === mapSelectedId && "ring-2 ring-ring/60")}
                  >
                    {index > 0 ? <TravelLeg item={item} /> : null}
                    <ItemRow
                      item={item}
                      currency={data.trip.currency}
                      conflictMinutes={conflicts.get(item.id)}
                      editable={editable}
                      otherDays={otherDays}
                      onEdit={() => setDialog({ mode: "edit", item })}
                      onToggleDone={() =>
                        m.updateItem.mutate({ itemId: item.id, patch: { status: item.status === "DONE" ? "PLANNED" : "DONE" } })
                      }
                      onDelete={() => deleteWithUndo(item)}
                      onMoveToDay={(toDayId) =>
                        m.moveItem.mutate(
                          { itemId: item.id, toDayId, toIndex: 999 },
                          { onSuccess: () => toast.success("다른 날로 옮겼어요.") },
                        )
                      }
                    />
                  </li>
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}

        {editable && day.items.length > 0 ? (
          <button
            type="button"
            onClick={() => setDialog({ mode: "create" })}
            className="ml-14 flex h-10 w-[calc(100%-3.5rem)] items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            <PlusIcon className="size-4" aria-hidden />
            일정 추가
          </button>
        ) : null}
      </section>
      <DayMiniMap
        tripId={tripId}
        day={day}
        center={data.trip.center}
        selectedId={mapSelectedId}
        onSelect={(id) => {
          setMapSelectedId(id);
          document.getElementById(`plan-item-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }}
      />
      </div>

      {dialog ? (
        <ItemDialog
          key={dialog.mode === "edit" ? dialog.item.id : "create"}
          open
          onOpenChange={(open) => !open && setDialog(null)}
          mode={dialog.mode}
          dayLabel={dayLabel}
          currency={data.trip.currency}
          initial={
            dialog.mode === "edit"
              ? dialog.item
              : { startMinute: lastEnd !== null ? Math.min(Math.ceil((lastEnd + 15) / 15) * 15, 1380) : 600 }
          }
          onSubmit={submitDraft}
        />
      ) : null}

    </div>
  );
}

const FIELD_LABELS: Record<string, string> = {
  title: "이름",
  category: "분류",
  startMinute: "시작 시간",
  durationMinutes: "체류시간",
  transportMode: "이동 수단",
  travelMinutesFromPrev: "이동시간",
  estimatedCost: "예상 비용",
  address: "주소",
  note: "메모",
};

function changedFields(draft: ItemDraft, item: ItineraryItemView): Partial<ItemDraft> {
  const before: Record<string, unknown> = { ...item };
  return Object.fromEntries(Object.entries(draft).filter(([k, v]) => (before[k] ?? null) !== v)) as Partial<ItemDraft>;
}

function TravelLeg({ item }: { item: ItineraryItemView }) {
  const Icon = item.transportMode === "WALK" ? FootprintsIcon : item.transportMode === "TAXI" || item.transportMode === "CAR" ? CarTaxiFrontIcon : TrainFrontIcon;
  return (
    <div className="flex items-center gap-2 py-1.5 pl-[4.25rem] text-xs text-muted-foreground">
      <span className="h-4 w-px bg-border" aria-hidden />
      <Icon className="size-3.5" aria-hidden />
      {item.travelMinutesFromPrev !== null
        ? `${item.transportMode ? TRANSPORT_LABELS[item.transportMode] : "이동"} ${item.travelMinutesFromPrev}분`
        : "이동 약 15분"}
    </div>
  );
}
