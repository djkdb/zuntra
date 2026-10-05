"use client";

import {
  BookHeartIcon,
  CalendarRangeIcon,
  CheckIcon,
  HomeIcon,
  InfoIcon,
  MapIcon,
  RotateCcwIcon,
  SendIcon,
  SparklesIcon,
  WalletIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BudgetMeter, CategoryBars } from "@/components/budget/budget-charts";
import { ActionCard } from "@/components/companion/action-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import type { AIActionView } from "@/lib/ai-actions";
import { apiFetch, errorMessage } from "@/lib/api-client";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  type BudgetSummaryView,
} from "@/lib/budget";
import { formatDateRange, formatShortDate } from "@/lib/dates";
import { type DemoDay, useDemoStore } from "@/lib/demo/demo-store";
import { DEMO_NOW_MINUTE, DEMO_TRIP } from "@/lib/demo/tokyo";
import { formatMoney } from "@/lib/format";
import {
  CATEGORY_LABELS,
  type ItineraryItemView,
  TRANSPORT_LABELS,
  formatDuration,
  formatMinute,
} from "@/lib/itinerary";
import { MOOD_OPTIONS } from "@/lib/journal";
import { minuteFromTime } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import type { ExpenseCategory, PlaceCategory } from "@/generated/prisma/enums";

const LeafletMap = dynamic(
  () => import("@/components/map/leaflet-map").then((m) => m.LeafletMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full" />,
  },
);

type Tab = "today" | "plan" | "map" | "ai" | "budget" | "journal";
const TABS: { id: Tab; label: string; icon: typeof HomeIcon }[] = [
  { id: "today", label: "오늘", icon: HomeIcon },
  { id: "plan", label: "일정", icon: CalendarRangeIcon },
  { id: "map", label: "지도", icon: MapIcon },
  { id: "ai", label: "AI 동행", icon: SparklesIcon },
  { id: "budget", label: "경비", icon: WalletIcon },
  { id: "journal", label: "기록", icon: BookHeartIcon },
];

interface DraftAction {
  type: AIActionView["type"];
  label: string;
  ref: string | null;
  dayNumber: number | null;
  title: string | null;
  category: PlaceCategory | null;
  startTime: string | null;
  durationMinutes: number | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  amount: number | null;
  text: string | null;
}
interface ChatMsg {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  quickReplies: string[];
  actions: { view: AIActionView; draft: DraftAction }[];
}

export function DemoApp() {
  const store = useDemoStore();
  const [tab, setTab] = useState<Tab>("today");
  const today = store.days[1]!;
  const spent = store.expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6">
      <div
        role="note"
        className="flex flex-col gap-3 rounded-lg bg-accent px-4 py-3 text-sm text-accent-foreground sm:flex-row sm:items-center"
      >
        <p className="flex flex-1 gap-2">
          <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          데모 모드예요. 마음껏 바꿔 보세요 — 이 브라우저 탭에만 임시로 저장되고
          계정과는 완전히 분리돼 있어요.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={store.reset}>
            <RotateCcwIcon data-icon="inline-start" aria-hidden />
            처음으로
          </Button>
          <Button size="sm" asChild>
            <Link href="/signup">내 여행 만들기</Link>
          </Button>
        </div>
      </div>

      <header>
        <p className="text-sm font-medium text-[oklch(0.45_0.11_155)] dark:text-success">
          ● 여행 중 · DAY {today.dayNumber}
        </p>
        <h1 className="mt-1 text-3xl font-bold sm:text-4xl">
          {DEMO_TRIP.title}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {DEMO_TRIP.destination} ·{" "}
          {formatDateRange(store.days[0]!.date, store.days.at(-1)!.date)} ·{" "}
          {DEMO_TRIP.travelerCount}명
        </p>
      </header>

      <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <div
          className="flex min-w-max gap-1 border-b"
          role="tablist"
          aria-label="데모 기능"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative inline-flex h-11 items-center gap-1.5 px-3 text-sm font-medium text-muted-foreground",
                tab === t.id &&
                  "text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary",
              )}
            >
              <t.icon className="size-4" aria-hidden />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel">
        {tab === "today" ? (
          <DemoToday day={today} onAsk={() => setTab("ai")} />
        ) : null}
        {tab === "plan" ? <DemoPlan /> : null}
        {tab === "map" ? <DemoMap /> : null}
        {tab === "ai" ? <DemoChat day={today} spent={spent} /> : null}
        {tab === "budget" ? <DemoBudget spent={spent} /> : null}
        {tab === "journal" ? <DemoJournalTab /> : null}
      </div>
    </div>
  );
}

function DemoTimeline({ items }: { items: ItineraryItemView[] }) {
  const toggle = useDemoStore((s) => s.toggleDone);
  return (
    <ol className="space-y-1.5">
      {items.map((item) => {
        const done = item.status === "DONE";
        const current = item.status === "IN_PROGRESS";
        return (
          <li
            key={item.id}
            className={cn(
              "flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5",
              current && "border-primary ring-1 ring-primary",
            )}
          >
            <time className="w-12 text-sm font-semibold tabular-nums text-muted-foreground">
              {formatMinute(item.startMinute)}
            </time>
            <button
              type="button"
              aria-pressed={done}
              aria-label={
                done ? `${item.title} 완료 취소` : `${item.title} 완료로 표시`
              }
              onClick={() => toggle(item.id)}
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-md border-2",
                done
                  ? "border-success bg-success text-white"
                  : current
                    ? "border-primary"
                    : "border-border",
              )}
            >
              {done ? <CheckIcon className="size-3.5" strokeWidth={3} /> : null}
            </button>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "truncate font-medium",
                  done && "text-muted-foreground line-through decoration-1",
                )}
              >
                {current ? "📍 " : ""}
                {item.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {CATEGORY_LABELS[item.category]}
                {item.durationMinutes
                  ? ` · ${formatDuration(item.durationMinutes)}`
                  : ""}
                {item.travelMinutesFromPrev
                  ? ` · 이동 ${item.transportMode ? TRANSPORT_LABELS[item.transportMode] : ""} ${item.travelMinutesFromPrev}분`
                  : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function DemoToday({ day, onAsk }: { day: DemoDay; onAsk: () => void }) {
  const now = DEMO_NOW_MINUTE;
  const current = day.items.find((i) => i.status === "IN_PROGRESS");
  const next = day.items.find(
    (i) =>
      i.status !== "DONE" &&
      i !== current &&
      i.startMinute >= (current?.startMinute ?? now),
  );
  const done = day.items.filter((i) => i.status === "DONE").length;
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            DAY {day.dayNumber} · {formatShortDate(day.date)} · 데모 시각{" "}
            {formatMinute(now)}
          </p>
          <h2 className="text-2xl font-bold">오늘 일정</h2>
          <p className="text-sm text-muted-foreground">
            {day.items.length}개 중 {done}개 완료
          </p>
        </div>
        <p className="rounded-lg bg-secondary px-3 py-2 text-sm text-secondary-foreground">
          흐림 {day.weather.tempMax}°C · 비 {day.weather.precipitation}%
        </p>
      </div>
      {next ? (
        <div className="rounded-lg bg-secondary/60 p-4">
          <p className="text-xs text-muted-foreground">다음 일정</p>
          <p className="text-lg font-semibold">
            {formatMinute(next.startMinute)} {next.title}
          </p>
          <p className="text-sm text-muted-foreground">
            {next.travelMinutesFromPrev
              ? `${next.transportMode ? TRANSPORT_LABELS[next.transportMode] : "이동"} ${next.travelMinutesFromPrev}분 · `
              : ""}
            예상 체류시간 {formatDuration(next.durationMinutes)}
          </p>
        </div>
      ) : null}
      <DemoTimeline items={day.items} />
      <Button size="lg" className="w-full" onClick={onAsk}>
        <SparklesIcon data-icon="inline-start" aria-hidden />
        지금 AI에게 물어보기
      </Button>
    </section>
  );
}

function DemoPlan() {
  const days = useDemoStore((s) => s.days);
  const [dayId, setDayId] = useState(days[1]!.id);
  const day = days.find((d) => d.id === dayId) ?? days[0]!;
  return (
    <section className="space-y-4">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {days.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={d.id === day.id}
            onClick={() => setDayId(d.id)}
            className={cn(
              "shrink-0 rounded-xl border px-3.5 py-2 text-left",
              d.id === day.id
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card",
            )}
          >
            <span className="block text-xs font-semibold">
              DAY {d.dayNumber}
            </span>
            <span className="text-sm">{formatShortDate(d.date)}</span>
          </button>
        ))}
      </div>
      <h2 className="text-lg font-semibold">
        DAY {day.dayNumber} · {day.title}
      </h2>
      <DemoTimeline items={day.items} />
      <p className="text-sm text-muted-foreground">
        실제 앱에서는 드래그로 순서를 바꾸고, AI가 일정을 만들거나 다시 맞춰
        줘요.{" "}
        <Link
          href="/signup"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          시작하기
        </Link>
      </p>
    </section>
  );
}

function DemoMap() {
  const days = useDemoStore((s) => s.days);
  const [dayId, setDayId] = useState(days[1]!.id);
  const day = days.find((d) => d.id === dayId) ?? days[0]!;
  const located = day.items.filter(
    (i) => i.latitude != null && i.longitude != null,
  );
  const markers = useMemo(
    () =>
      located.map((i) => ({
        id: i.id,
        position: { lat: i.latitude!, lng: i.longitude! },
        label: String(day.items.indexOf(i) + 1),
        title: i.title,
        kind: (i.status === "DONE"
          ? "done"
          : i.category === "FOOD" || i.category === "CAFE"
            ? "food"
            : "stop") as "done" | "food" | "stop",
      })),
    [located, day.items],
  );
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {days.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={d.id === day.id}
            onClick={() => setDayId(d.id)}
            className={cn(
              "h-9 rounded-full border px-4 text-sm font-medium",
              d.id === day.id
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card",
            )}
          >
            DAY {d.dayNumber}
          </button>
        ))}
      </div>
      <div className="h-[55dvh] min-h-80 overflow-hidden rounded-xl border">
        <LeafletMap
          markers={markers}
          route={markers.map((m) => m.position)}
          center={{ lat: 35.68, lng: 139.76 }}
          me={null}
          onSelect={() => {}}
        />
      </div>
    </section>
  );
}

const STARTERS = [
  "지금 너무 피곤해",
  "여기 너무 좋다. 1시간 더 있을래",
  "밥 먹고 어디 가지?",
  "비 오면 어떡하지?",
];

function toView(
  draft: DraftAction,
  day: DemoDay,
  budget: number,
): AIActionView {
  const idx = draft.ref ? Number(draft.ref.slice(1)) - 1 : -1;
  const item = idx >= 0 ? day.items[idx] : undefined;
  const start = draft.startTime ? minuteFromTime(draft.startTime) : null;
  const payload: Record<string, unknown> = {
    title: draft.title ?? item?.title,
    fromTitle: item?.title,
    startMinute: start ?? item?.startMinute ?? 0,
    durationMinutes: draft.durationMinutes ?? item?.durationMinutes ?? 60,
    fromStartMinute: item?.startMinute,
    fromDurationMinutes: item?.durationMinutes,
    amount: draft.amount,
    previous: budget,
    content: draft.text,
    note: draft.text,
    dayNumber: day.dayNumber,
  };
  if (draft.type === "REMOVE_PLACE") payload.title = item?.title;
  return {
    id: Math.random().toString(36).slice(2),
    type: draft.type,
    label: draft.label,
    payload,
    status: "PROPOSED",
    error: null,
  };
}

function DemoChat({ day, spent }: { day: DemoDay; spent: number }) {
  const store = useDemoStore();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || pending) return;
    setDraft("");
    setError(undefined);
    setMessages((m) => [
      ...m,
      {
        id: `u${Date.now()}`,
        role: "USER",
        content: message,
        quickReplies: [],
        actions: [],
      },
    ]);
    setPending(true);
    try {
      const reply = await apiFetch<{
        message: string;
        quickReplies: string[];
        actions: DraftAction[];
      }>("/api/demo/companion", {
        method: "POST",
        body: {
          message,
          dayNumber: day.dayNumber,
          budget: store.budget,
          spent,
          items: day.items.map((i, idx) => ({
            ref: `i${idx + 1}`,
            title: i.title,
            category: i.category,
            startMinute: i.startMinute,
            durationMinutes: i.durationMinutes,
            travelMinutesFromPrev: i.travelMinutesFromPrev,
            status: i.status,
            lat: i.latitude ?? null,
            lng: i.longitude ?? null,
          })),
        },
      });
      setMessages((m) => [
        ...m,
        {
          id: `a${Date.now()}`,
          role: "ASSISTANT",
          content: reply.message,
          quickReplies: reply.quickReplies,
          actions: reply.actions.map((a) => ({
            draft: a,
            view: toView(a, day, store.budget),
          })),
        },
      ]);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setPending(false);
    }
  };

  const decide = (
    msgId: string,
    actionId: string,
    decision: "approve" | "reject",
  ) => {
    const msg = messages.find((m) => m.id === msgId);
    const entry = msg?.actions.find((a) => a.view.id === actionId);
    if (!entry) return;
    if (decision === "approve") applyDraft(entry.draft, day, store);
    setMessages((list) =>
      list.map((m) =>
        m.id !== msgId
          ? m
          : {
              ...m,
              actions: m.actions.map((a) =>
                a.view.id === actionId
                  ? {
                      ...a,
                      view: {
                        ...a.view,
                        status:
                          decision === "approve" ? "EXECUTED" : "REJECTED",
                      },
                    }
                  : a,
              ),
            },
      ),
    );
  };

  return (
    <section className="space-y-4">
      {messages.length === 0 ? (
        <div className="rounded-lg border border-dashed px-5 py-8 text-center">
          <SparklesIcon className="mx-auto size-7 text-primary" aria-hidden />
          <p className="mt-2 font-semibold">
            지금 상황을 알고 대답하는 AI 동행
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            아래 문장을 눌러 보세요. 제안을 승인하면 일정이 실제로 바뀌어요.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border bg-card px-3.5 py-2 text-sm hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {messages.map((m, idx) =>
        m.role === "USER" ? (
          <div key={m.id} className="flex justify-end">
            <p className="max-w-[85%] rounded-lg rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground">
              {m.content}
            </p>
          </div>
        ) : (
          <div key={m.id} className="flex gap-2.5">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-primary"
              aria-hidden
            >
              <SparklesIcon className="size-4" />
            </span>
            <div className="min-w-0 max-w-[85%] space-y-2.5">
              <p className="rounded-lg rounded-tl-md bg-muted px-4 py-3 leading-relaxed whitespace-pre-line">
                {m.content}
              </p>
              {m.actions.map((a) => (
                <ActionCard
                  key={a.view.id}
                  action={a.view}
                  currency={DEMO_TRIP.currency}
                  canEdit
                  pending={false}
                  onDecide={(d) => decide(m.id, a.view.id, d)}
                />
              ))}
              {idx === messages.length - 1 && m.quickReplies.length ? (
                <div className="flex flex-wrap gap-2">
                  {m.quickReplies.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => send(q)}
                      className="rounded-full border bg-card px-3.5 py-1.5 text-sm hover:bg-muted"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ),
      )}
      {pending ? (
        <p className="text-sm text-muted-foreground" role="status">
          지금 상황을 확인하고 있어요…
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="flex gap-2"
      >
        <label htmlFor="demo-input" className="sr-only">
          AI에게 메시지 보내기
        </label>
        <Input
          id="demo-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="예: 지금 너무 피곤해"
          maxLength={500}
        />
        <Button
          type="submit"
          size="icon-lg"
          aria-label="보내기"
          disabled={!draft.trim() || pending}
        >
          <SendIcon />
        </Button>
      </form>
    </section>
  );
}

function applyDraft(
  draft: DraftAction,
  day: DemoDay,
  store: ReturnType<typeof useDemoStore.getState>,
) {
  const idx = draft.ref ? Number(draft.ref.slice(1)) - 1 : -1;
  const item = idx >= 0 ? day.items[idx] : undefined;
  const start = draft.startTime ? minuteFromTime(draft.startTime) : null;
  switch (draft.type) {
    case "REMOVE_PLACE":
      if (item) store.removeItem(item.id);
      break;
    case "RESCHEDULE":
      if (item)
        store.updateItem(
          item.id,
          {
            startMinute: start ?? item.startMinute,
            durationMinutes: draft.durationMinutes ?? item.durationMinutes,
          },
          true,
        );
      break;
    case "REPLACE_PLACE":
    case "SUGGEST_ALTERNATIVE":
      if (item) {
        store.updateItem(item.id, {
          title: draft.title ?? item.title,
          category: draft.category ?? item.category,
          durationMinutes: draft.durationMinutes ?? item.durationMinutes,
          latitude: draft.latitude,
          longitude: draft.longitude,
          source: "AI",
        });
        break;
      }
    // falls through to add when there is no item to replace
    case "ADD_PLACE":
      store.addItem(day.id, {
        id: `demo-${Math.random().toString(36).slice(2, 8)}`,
        title: draft.title ?? "새 일정",
        category: draft.category ?? "OTHER",
        startMinute: start ?? 12 * 60,
        durationMinutes: draft.durationMinutes ?? 60,
        travelMinutesFromPrev: null,
        transportMode: null,
        estimatedCost: null,
        note: null,
        status: "PLANNED",
        source: "AI",
        latitude: draft.latitude,
        longitude: draft.longitude,
      });
      break;
    case "UPDATE_BUDGET":
      if (draft.amount !== null) store.setBudget(draft.amount);
      break;
    case "CREATE_JOURNAL":
      if (draft.text)
        store.addJournal({
          date: day.date,
          content: draft.text,
          mood: null,
          rating: null,
        });
      break;
    case "CREATE_NOTE":
      break;
  }
}

function DemoBudget({ spent }: { spent: number }) {
  const { expenses, budget, addExpense, days } = useDemoStore();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("FOOD");
  const byCat = Object.fromEntries(
    EXPENSE_CATEGORIES.map((c) => [
      c,
      expenses
        .filter((e) => e.category === c)
        .reduce((s, e) => s + e.amount, 0),
    ]),
  );
  const summary: BudgetSummaryView = {
    currency: DEMO_TRIP.currency,
    travelerCount: DEMO_TRIP.travelerCount,
    total: budget,
    allocations: {},
    spent,
    remaining: budget - spent,
    usedPct: Math.round((spent / budget) * 1000) / 10,
    perPerson: Math.round(spent / DEMO_TRIP.travelerCount),
    byCategory: EXPENSE_CATEGORIES.map((c) => ({
      category: c,
      amount: byCat[c] ?? 0,
      allocation: null,
    })),
    byDay: [],
    insights: [],
    isFinal: false,
  };
  return (
    <section className="space-y-6">
      <BudgetMeter summary={summary} />
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(amount.replace(/[,\s]/g, ""));
          if (!title.trim() || !Number.isFinite(n) || n <= 0) return;
          addExpense({
            title: title.trim(),
            amount: n,
            category,
            date: days[1]!.date,
          });
          setTitle("");
          setAmount("");
        }}
      >
        <label className="sr-only" htmlFor="demo-exp-title">
          내용
        </label>
        <Input
          id="demo-exp-title"
          className="min-w-40 flex-1"
          placeholder="예: 규카츠"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <label className="sr-only" htmlFor="demo-exp-amount">
          금액
        </label>
        <Input
          id="demo-exp-amount"
          className="w-32"
          inputMode="decimal"
          placeholder="금액(엔)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <div className="w-28">
          <label className="sr-only" htmlFor="demo-exp-cat">
            카테고리
          </label>
          <NativeSelect
            id="demo-exp-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit">지출 기록</Button>
      </form>
      <CategoryBars summary={summary} />
      <ul className="divide-y rounded-lg border bg-card">
        {expenses.map((e) => (
          <li
            key={e.id}
            className="flex items-center justify-between px-4 py-3 text-sm"
          >
            <span>
              <span className="mr-2 rounded bg-secondary px-1.5 py-0.5 text-xs">
                {EXPENSE_CATEGORY_LABELS[e.category]}
              </span>
              {e.title}
            </span>
            <span className="font-semibold tabular-nums">
              {formatMoney(e.amount, DEMO_TRIP.currency)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DemoJournalTab() {
  const { journal, addJournal, days } = useDemoStore();
  const [content, setContent] = useState("");
  return (
    <section className="space-y-4">
      <form
        className="space-y-2 rounded-lg border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!content.trim()) return;
          addJournal({
            date: days[1]!.date,
            content: content.trim(),
            mood: "HAPPY",
            rating: 4,
          });
          setContent("");
        }}
      >
        <label htmlFor="demo-journal" className="text-sm font-medium">
          오늘의 기억
        </label>
        <Input
          id="demo-journal"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="예: 아사쿠사 텐동 진짜 맛있었다"
        />
        <Button type="submit" size="sm">
          기록하기
        </Button>
      </form>
      {journal.map((j) => (
        <article key={j.id} className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            {formatShortDate(j.date)}{" "}
            {j.mood ? MOOD_OPTIONS.find((m) => m.value === j.mood)?.emoji : ""}{" "}
            {j.rating ? "★".repeat(j.rating) : ""}
          </p>
          <p className="mt-1">{j.content}</p>
        </article>
      ))}
      <p className="text-sm text-muted-foreground">
        여행이 끝나면 기록·사진·지출을 모아 AI 여행 리포트를 만들어 드려요.
      </p>
    </section>
  );
}
