"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ExpenseCategory, Mood } from "@/generated/prisma/enums";
import { addDaysIso, todayInTimeZone } from "@/lib/dates";
import type { ItineraryItemView } from "@/lib/itinerary";
import { reflowDay } from "@/lib/schedule";
import { DEMO_NOW_MINUTE, DEMO_TRIP } from "./tokyo";

/**
 * Demo Mode state. Lives only in this browser tab (sessionStorage) and is never sent to the
 * user database — the demo AI endpoint is stateless and receives just what it needs.
 */
export interface DemoDay {
  id: string;
  dayNumber: number;
  date: string;
  title: string;
  weather: (typeof DEMO_TRIP.days)[number]["weather"];
  items: ItineraryItemView[];
}

export interface DemoExpense {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
}

export interface DemoJournal {
  id: string;
  date: string;
  content: string;
  mood: Mood | null;
  rating: number | null;
}

interface DemoState {
  version: number;
  days: DemoDay[];
  expenses: DemoExpense[];
  journal: DemoJournal[];
  budget: number;
  toggleDone: (itemId: string) => void;
  removeItem: (itemId: string) => void;
  updateItem: (itemId: string, patch: Partial<ItineraryItemView>, reflow?: boolean) => void;
  addItem: (dayId: string, item: ItineraryItemView) => void;
  addExpense: (e: Omit<DemoExpense, "id">) => void;
  addJournal: (j: Omit<DemoJournal, "id">) => void;
  setBudget: (amount: number) => void;
  reset: () => void;
}

const uid = () => Math.random().toString(36).slice(2, 10);

/** Day 2 of the sample trip is always "today", so TODAY and the companion have something to do. */
export function buildDemoTrip(now = new Date()) {
  const tz = DEMO_TRIP.timezone;
  const start = addDaysIso(todayInTimeZone(tz, now), -1);
  const minute = DEMO_NOW_MINUTE;
  const days: DemoDay[] = DEMO_TRIP.days.map((d, i) => ({
    id: `demo-day-${d.dayNumber}`,
    dayNumber: d.dayNumber,
    date: addDaysIso(start, i),
    title: d.title,
    weather: d.weather,
    items: d.items.map((item) => {
      const status =
        i === 0
          ? "DONE"
          : i === 1
            ? item.startMinute + item.durationMinutes <= minute
              ? "DONE"
              : item.startMinute <= minute
                ? "IN_PROGRESS"
                : "PLANNED"
            : "PLANNED";
      return { ...item, dayId: `demo-day-${d.dayNumber}`, status } as ItineraryItemView;
    }),
  }));
  const expenses: DemoExpense[] = [
    { id: uid(), title: "호텔 4박", category: "LODGING", amount: 72_000, date: days[0]!.date },
    { id: uid(), title: "이치란 라멘", category: "FOOD", amount: 2_800, date: days[0]!.date },
    { id: uid(), title: "스이카 충전", category: "TRANSPORT", amount: 5_000, date: days[0]!.date },
    { id: uid(), title: "시부야 스카이", category: "SIGHTSEEING", amount: 5_000, date: days[0]!.date },
    { id: uid(), title: "텐동", category: "FOOD", amount: 3_600, date: days[1]!.date },
  ];
  const journal: DemoJournal[] = [
    { id: uid(), date: days[0]!.date, content: "시부야 스카이에서 본 노을이 정말 예뻤다. 이치란 라멘도 최고!", mood: "AMAZING", rating: 5 },
  ];
  return { days, expenses, journal, budget: DEMO_TRIP.budgetAmount };
}

export const DEMO_VERSION = 2;

export const useDemoStore = create<DemoState>()(
  persist(
    (set) => ({
      version: DEMO_VERSION,
      ...buildDemoTrip(),
      toggleDone: (itemId) =>
        set((s) => ({
          days: s.days.map((d) => ({
            ...d,
            items: d.items.map((i) => (i.id === itemId ? { ...i, status: i.status === "DONE" ? "PLANNED" : "DONE" } : i)),
          })),
        })),
      removeItem: (itemId) => set((s) => ({ days: s.days.map((d) => ({ ...d, items: d.items.filter((i) => i.id !== itemId) })) })),
      updateItem: (itemId, patch, reflow = false) =>
        set((s) => ({
          days: s.days.map((d) => {
            if (!d.items.some((i) => i.id === itemId)) return d;
            let items = d.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)).sort((a, b) => a.startMinute - b.startMinute);
            if (reflow) {
              const from = items.findIndex((i) => i.id === itemId);
              items = reflowDay(items, from).items as ItineraryItemView[];
            }
            return { ...d, items };
          }),
        })),
      addItem: (dayId, item) =>
        set((s) => ({
          days: s.days.map((d) =>
            d.id === dayId ? { ...d, items: [...d.items, { ...item, dayId }].sort((a, b) => a.startMinute - b.startMinute) } : d,
          ),
        })),
      addExpense: (e) => set((s) => ({ expenses: [{ ...e, id: uid() }, ...s.expenses] })),
      addJournal: (j) => set((s) => ({ journal: [{ ...j, id: uid() }, ...s.journal] })),
      setBudget: (amount) => set({ budget: amount }),
      reset: () => set({ ...buildDemoTrip() }),
    }),
    {
      name: "tripmate-demo",
      version: DEMO_VERSION,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ days: s.days, expenses: s.expenses, journal: s.journal, budget: s.budget, version: s.version }),
    },
  ),
);
