import "server-only";
import type { ExpenseCategory, PlaceCategory, TravelPace, TravelStyle } from "@/generated/prisma/enums";
import { diffDaysIso, fromDbDate, getTripPhase, todayInTimeZone } from "@/lib/dates";
import { type LatLng, estimateTravelMinutes, haversineKm, suggestMode } from "@/lib/geo";
import { db } from "@/server/db";
import { ensureTripCenter } from "@/server/services/trip-service";
import { nowMinuteIn } from "../trip-rescheduler";

export interface ContextItem {
  ref: string;
  id: string;
  dayId: string;
  title: string;
  category: PlaceCategory;
  startMinute: number;
  durationMinutes: number;
  travelMinutesFromPrev: number | null;
  status: string;
  isIndoor: boolean | null;
  location: LatLng | null;
}

/**
 * What the companion knows about "right now". Built only from the requesting user's trip;
 * the model sees a compact text rendering, the mock provider sees this object.
 */
export interface CompanionContext {
  canEdit: boolean;
  phase: "upcoming" | "ongoing" | "past" | "completed";
  now: { date: string; minute: number };
  trip: { destination: string; currency: string; travelerCount: number; startDate: string; endDate: string; totalDays: number };
  profile: { styles: TravelStyle[]; pace: TravelPace; foods: string[] };
  focusDay: { dayId: string; dayNumber: number; date: string; isToday: boolean } | null;
  items: ContextItem[];
  currentRef: string | null;
  nextRef: string | null;
  location: LatLng | null;
  center: LatLng | null;
  lodging: { title: string; location: LatLng; travelMinutes: number | null } | null;
  weather: { condition: string; tempMax: number; tempMin: number; precipitation: number | null } | null;
  rainyDayNumbers: number[];
  budget: { total: number | null; spent: number; byCategory: Partial<Record<ExpenseCategory, number>> };
  days: { dayNumber: number; dayId: string; date: string; count: number }[];
}

export async function buildCompanionContext(
  tripId: string,
  options: { canEdit: boolean; location: LatLng | null; now?: Date; focusDayId?: string | null },
): Promise<CompanionContext> {
  const now = options.now ?? new Date();
  const trip = await db.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: {
      budget: true,
      owner: { select: { travelProfile: true } },
      days: {
        orderBy: { dayNumber: "asc" },
        include: { items: { orderBy: { position: "asc" }, include: { place: true } } },
      },
      weather: true,
    },
  });
  const center = await ensureTripCenter(tripId).catch(() => null);
  const today = todayInTimeZone(trip.timezone, now);
  const minute = nowMinuteIn(trip.timezone, now);
  const startDate = fromDbDate(trip.startDate);
  const endDate = fromDbDate(trip.endDate);
  const phase = getTripPhase({ startDate, endDate, status: trip.status }, today);

  const todayDay = trip.days.find((d) => fromDbDate(d.date) === today);
  const requested = options.focusDayId ? trip.days.find((d) => d.id === options.focusDayId) : undefined;
  const focus = requested ?? todayDay ?? (phase === "upcoming" ? trip.days[0] : undefined) ?? trip.days.at(-1);
  const focusIsToday = Boolean(todayDay && focus?.id === todayDay.id);

  const items: ContextItem[] = (focus?.items ?? []).map((i, idx) => ({
    ref: `i${idx + 1}`,
    id: i.id,
    dayId: i.dayId,
    title: i.title,
    category: i.category,
    startMinute: i.startMinute,
    durationMinutes: i.durationMinutes,
    travelMinutesFromPrev: i.travelMinutesFromPrev,
    status: i.status,
    isIndoor: i.place?.isIndoor ?? null,
    location: i.place?.latitude != null && i.place.longitude != null ? { lat: i.place.latitude, lng: i.place.longitude } : null,
  }));

  let currentRef: string | null = null;
  let nextRef: string | null = null;
  if (focusIsToday) {
    const current =
      items.find((i) => i.status === "IN_PROGRESS") ??
      items.find((i) => i.status !== "DONE" && i.startMinute <= minute && minute < i.startMinute + i.durationMinutes);
    currentRef = current?.ref ?? null;
    nextRef = items.find((i) => i.status !== "DONE" && i.startMinute > minute && i.ref !== currentRef)?.ref ?? null;
  } else {
    nextRef = items.find((i) => i.status !== "DONE")?.ref ?? null;
  }

  // Lodging: any LODGING place on the trip with coordinates.
  const lodgingItem = trip.days.flatMap((d) => d.items).find((i) => i.category === "LODGING" && i.place?.latitude != null);
  const here = options.location ?? (currentRef ? items.find((i) => i.ref === currentRef)?.location ?? null : null);
  const lodgingLoc = lodgingItem?.place ? { lat: lodgingItem.place.latitude!, lng: lodgingItem.place.longitude! } : null;

  const expenses = await db.expense.groupBy({ by: ["category"], where: { tripId }, _sum: { amount: true } });
  const byCategory: CompanionContext["budget"]["byCategory"] = {};
  let spent = 0;
  for (const e of expenses) {
    const v = Number(e._sum.amount ?? 0);
    byCategory[e.category] = v;
    spent += v;
  }

  const weatherToday = trip.weather.find((w) => fromDbDate(w.date) === (focus ? fromDbDate(focus.date) : today));
  const profile = trip.owner.travelProfile;

  return {
    canEdit: options.canEdit,
    phase,
    now: { date: today, minute },
    trip: {
      destination: trip.destination,
      currency: trip.currency,
      travelerCount: trip.travelerCount,
      startDate,
      endDate,
      totalDays: diffDaysIso(startDate, endDate) + 1,
    },
    profile: {
      styles: trip.styles.length ? trip.styles : (profile?.styles ?? []),
      pace: trip.pace ?? profile?.pace ?? "MODERATE",
      foods: trip.preferredFoods.length ? trip.preferredFoods : (profile?.favoriteFoods ?? []),
    },
    focusDay: focus
      ? { dayId: focus.id, dayNumber: focus.dayNumber, date: fromDbDate(focus.date), isToday: focusIsToday }
      : null,
    items,
    currentRef,
    nextRef,
    location: options.location,
    center,
    lodging:
      lodgingItem && lodgingLoc
        ? {
            title: lodgingItem.title,
            location: lodgingLoc,
            travelMinutes: here ? estimateTravelMinutes(here, lodgingLoc, suggestMode(here, lodgingLoc)) : null,
          }
        : null,
    weather: weatherToday
      ? {
          condition: weatherToday.condition,
          tempMax: weatherToday.tempMaxC,
          tempMin: weatherToday.tempMinC,
          precipitation: weatherToday.precipitationProbability,
        }
      : null,
    rainyDayNumbers: trip.days
      .filter((d) => trip.weather.some((w) => w.date.getTime() === d.date.getTime() && (w.precipitationProbability ?? 0) >= 60))
      .map((d) => d.dayNumber),
    budget: { total: trip.budget ? Number(trip.budget.totalAmount) : null, spent, byCategory },
    days: trip.days.map((d) => ({ dayNumber: d.dayNumber, dayId: d.id, date: fromDbDate(d.date), count: d.items.length })),
  };
}

export function distanceKm(a: LatLng | null, b: LatLng | null): number | null {
  return a && b ? haversineKm(a, b) : null;
}
