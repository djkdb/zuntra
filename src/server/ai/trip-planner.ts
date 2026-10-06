import "server-only";
import { z } from "zod";
import { diffDaysIso, fromDbDate } from "@/lib/dates";
import { clashesWithFixed } from "@/lib/schedule";
import { track } from "@/server/analytics/track";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { estimateMissingTravel, loadDay, renumber } from "@/server/services/itinerary-service";
import { assertTripAccess, ensureTripCenter } from "@/server/services/trip-service";
import { parseOrThrow } from "@/server/validate";
import { runAI } from "./guard";
import { validatePlan } from "./plan-validation";
import { PLANNER_SCHEMA_NAME, plannerInput, plannerSystemPrompt } from "./prompts/planner";
import { planDraftSchema } from "./schemas/planner";
import type { FixedSlot, PlannerContext } from "./trip-planner-context";

export const generatePlanSchema = z.object({
  mode: z.enum(["fill_empty", "replace_all", "day"]),
  dayId: z.string().optional(),
  request: z.string().trim().max(500).optional(),
});

const CHUNK_DAYS = 5;

/**
 * AI itinerary generation: builds a minimal context from the user's own trip and profile,
 * asks the planner in chunks of days, validates every draft, then writes the result in one
 * transaction (replacing the targeted days' items).
 */
export async function generatePlan(tripId: string, userId: string, raw: unknown) {
  await assertTripAccess(tripId, userId, "EDITOR");
  const input = parseOrThrow(generatePlanSchema, raw);

  const trip = await db.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: {
      budget: true,
      owner: { select: { travelProfile: true } },
      days: {
        orderBy: { dayNumber: "asc" },
        include: { items: { select: { title: true, isFixed: true, category: true, startMinute: true, durationMinutes: true } } },
      },
      weather: { select: { date: true, precipitationProbability: true } },
    },
  });

  let targets = trip.days;
  // A day holding only bookings (e.g. the flight) still counts as empty.
  if (input.mode === "fill_empty") targets = trip.days.filter((d) => d.items.every((i) => i.isFixed));
  if (input.mode === "day") {
    targets = trip.days.filter((d) => d.id === input.dayId);
    if (targets.length === 0) throw new AppError("NOT_FOUND", "날짜를 찾을 수 없어요.");
  }
  if (targets.length === 0) {
    throw new AppError("VALIDATION", "비어 있는 날이 없어요. ‘전체 다시 만들기’를 선택해 주세요.");
  }

  const center = await ensureTripCenter(tripId).catch(() => null);
  const profile = trip.owner.travelProfile;
  const targetIds = new Set(targets.map((d) => d.id));
  const rainy = new Set(
    trip.weather.filter((w) => (w.precipitationProbability ?? 0) >= 60).map((w) => fromDbDate(w.date)),
  );
  const startDate = fromDbDate(trip.startDate);
  const endDate = fromDbDate(trip.endDate);
  const totalDays = diffDaysIso(startDate, endDate) + 1;

  const baseContext: Omit<PlannerContext, "days" | "existing"> = {
    destination: trip.destination,
    timezone: trip.timezone,
    currency: trip.currency,
    travelerCount: trip.travelerCount,
    startDate,
    endDate,
    totalDays,
    styles: trip.styles.length ? trip.styles : (profile?.styles ?? []),
    pace: trip.pace ?? profile?.pace ?? "MODERATE",
    budgetLevel: profile?.budgetLevel ?? "STANDARD",
    budgetAmount: trip.budget ? Number(trip.budget.totalAmount) : null,
    preferredPlaces: trip.preferredPlaces,
    preferredFoods: trip.preferredFoods.length ? trip.preferredFoods : (profile?.favoriteFoods ?? []),
    purpose: trip.purpose,
    notes: trip.notes,
    request: input.request ?? null,
    center,
  };

  const existingTitles = trip.days.flatMap((d) => d.items.filter((i) => !targetIds.has(d.id) || i.isFixed).map((i) => i.title));
  const fixedOf = (d: (typeof trip.days)[number]): FixedSlot[] =>
    d.items
      .filter((i) => i.isFixed)
      .map((i) => ({ title: i.title, category: i.category, start: i.startMinute, end: i.startMinute + i.durationMinutes }))
      .sort((a, b) => a.start - b.start);
  const generated = [];
  const warnings: string[] = [];
  let summary = "";

  for (let i = 0; i < targets.length; i += CHUNK_DAYS) {
    const chunk = targets.slice(i, i + CHUNK_DAYS);
    const context: PlannerContext = {
      ...baseContext,
      existing: [...existingTitles, ...generated.flatMap((d) => d.items.map((it) => it.title))],
      days: chunk.map((d) => {
        const date = fromDbDate(d.date);
        return {
          dayNumber: d.dayNumber,
          date,
          rainy: rainy.has(date),
          isFirst: d.dayNumber === 1,
          isLast: d.dayNumber === totalDays,
          // Where they're based that day, plus their own name for it ("교토 · 아라시야마").
          hint: [d.city, d.titleByUser ? d.title : null].filter(Boolean).join(" · ") || null,
          fixed: fixedOf(d),
        };
      }),
    };
    const draft = await runAI({
      feature: "PLANNER",
      schemaName: PLANNER_SCHEMA_NAME,
      schema: planDraftSchema,
      system: plannerSystemPrompt(),
      input: plannerInput(context),
      context,
      userId,
      tripId,
      skipRateLimit: i > 0,
      maxOutputTokens: 6000,
    });
    const centers = new Map(
      chunk.flatMap((d) => (d.cityLat !== null && d.cityLng !== null ? [[d.dayNumber, { lat: d.cityLat, lng: d.cityLng }] as const] : [])),
    );
    const validated = validatePlan(draft, { dayNumbers: chunk.map((d) => d.dayNumber), pace: context.pace, center, centers });
    // Safety net for whatever the model returns: nothing may collide with a booking.
    generated.push(
      ...validated.days.map((day) => {
        const source = chunk.find((d) => d.dayNumber === day.dayNumber);
        return source ? { ...day, items: fitAroundFixed(day.items, fixedOf(source), source.dayNumber === 1, source.dayNumber === totalDays) } : day;
      }),
    );
    warnings.push(...validated.warnings);
    summary ||= draft.summary;
  }

  const byNumber = new Map(generated.map((d) => [d.dayNumber, d]));
  // Tell the truth about days that came back empty instead of "N일 일정을 만들었어요", and
  // never wipe a day's plan for an empty result.
  const empty = targets.filter((t) => (byNumber.get(t.dayNumber)?.items.length ?? 0) === 0);
  if (empty.length === targets.length) {
    const labels = targets.map((d) => `${d.dayNumber}일차`).join(", ");
    throw new AppError(
      "AI_FAILED",
      `${labels}에 넣을 장소를 찾지 못했어요. 다른 날과 겹치지 않는 후보가 부족했을 수 있어요. 직접 추가하거나 관심사를 바꿔 다시 시도해 주세요.`,
    );
  }
  if (empty.length > 0) {
    const labels = empty.map((d) => `${d.dayNumber}일차`).join(", ");
    warnings.push(`${labels}에는 맞는 장소를 찾지 못해 그대로 뒀어요. 직접 추가하거나 다시 시도해 주세요.`);
    summary = `${targets.length - empty.length}일 일정을 만들었어요.`;
  }

  const days = await db.$transaction(
    async (tx) => {
      const changed = [];
      for (const day of targets) {
        const plan = byNumber.get(day.dayNumber);
        if (!plan || plan.items.length === 0) continue;
        // Bookings stay; everything else on the day is replaced.
        await tx.itineraryItem.deleteMany({ where: { dayId: day.id, isFixed: false } });
        // A day the traveller named keeps its name; only AI-made titles are replaced.
        if (!day.titleByUser) await tx.day.update({ where: { id: day.id }, data: { title: plan.title || null } });
        for (const [position, item] of plan.items.entries()) {
          const place =
            item.address || item.latitude !== null
              ? await tx.place.create({
                  data: {
                    tripId,
                    name: item.title,
                    category: item.category,
                    address: item.address,
                    latitude: item.latitude,
                    longitude: item.longitude,
                    isIndoor: item.isIndoor,
                    provider: "ai",
                  },
                })
              : null;
          await tx.itineraryItem.create({
            data: {
              dayId: day.id,
              placeId: place?.id ?? null,
              title: item.title,
              category: item.category,
              position,
              startMinute: item.startMinute,
              durationMinutes: item.durationMinutes,
              travelMinutesFromPrev: item.travelMinutesFromPrev,
              transportMode: item.transportMode,
              estimatedCost: item.estimatedCost,
              note: item.note,
              source: "AI",
            },
          });
        }
        const ordered = await tx.itineraryItem.findMany({
          where: { dayId: day.id },
          orderBy: [{ startMinute: "asc" }, { position: "asc" }],
          select: { id: true },
        });
        await renumber(tx, ordered.map((o) => o.id));
        await estimateMissingTravel(tx, day.id);
        changed.push(await loadDay(tx, day.id));
      }
      // Places no longer referenced by any item or journal entry are cleaned up.
      await tx.place.deleteMany({ where: { tripId, items: { none: {} }, journalEntries: { none: {} } } });
      return changed;
    },
    { timeout: 20_000 },
  );

  await track("generate_plan", {
    userId,
    tripId,
    properties: { mode: input.mode, days: days.length, items: days.reduce((n, d) => n + d.items.length, 0) },
  });
  return { days, summary, warnings };
}

/**
 * Drops generated stops that collide with a booking. An airport booking on the first day is the
 * arrival (nothing before it); on the last day it is the departure (nothing after it), and the
 * planner's own airport stops give way to the real flight.
 */
export function fitAroundFixed<T extends { startMinute: number; durationMinutes: number; category: string }>(
  items: T[],
  fixed: FixedSlot[],
  isFirst: boolean,
  isLast: boolean,
): T[] {
  if (fixed.length === 0) return items;
  const airport = fixed.filter((f) => f.category === "AIRPORT");
  const arrival = isFirst ? airport[0] : undefined;
  const departure = isLast ? airport.at(-1) : undefined;
  return items.filter((i) => {
    const end = i.startMinute + i.durationMinutes;
    if (airport.length > 0 && i.category === "AIRPORT") return false;
    if (arrival && i.startMinute < arrival.end + 30) return false;
    if (departure && end > departure.start - 45) return false;
    return !clashesWithFixed(i.startMinute, end, fixed);
  });
}
