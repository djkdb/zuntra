import "server-only";
import { z } from "zod";
import { diffDaysIso, fromDbDate } from "@/lib/dates";
import { track } from "@/server/analytics/track";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { estimateMissingTravel, loadDay } from "@/server/services/itinerary-service";
import { assertTripAccess, ensureTripCenter } from "@/server/services/trip-service";
import { parseOrThrow } from "@/server/validate";
import { runAI } from "./guard";
import { validatePlan } from "./plan-validation";
import { PLANNER_SCHEMA_NAME, plannerInput, plannerSystemPrompt } from "./prompts/planner";
import { planDraftSchema } from "./schemas/planner";
import type { PlannerContext } from "./trip-planner-context";

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
      days: { orderBy: { dayNumber: "asc" }, include: { items: { select: { title: true } } } },
      weather: { select: { date: true, precipitationProbability: true } },
    },
  });

  let targets = trip.days;
  if (input.mode === "fill_empty") targets = trip.days.filter((d) => d.items.length === 0);
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

  const existingTitles = trip.days.filter((d) => !targetIds.has(d.id)).flatMap((d) => d.items.map((i) => i.title));
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
        return { dayNumber: d.dayNumber, date, rainy: rainy.has(date), isFirst: d.dayNumber === 1, isLast: d.dayNumber === totalDays };
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
    const validated = validatePlan(draft, { dayNumbers: chunk.map((d) => d.dayNumber), pace: context.pace, center });
    generated.push(...validated.days);
    warnings.push(...validated.warnings);
    summary ||= draft.summary;
  }

  const byNumber = new Map(generated.map((d) => [d.dayNumber, d]));
  const days = await db.$transaction(
    async (tx) => {
      const changed = [];
      for (const day of targets) {
        const plan = byNumber.get(day.dayNumber);
        if (!plan) continue;
        await tx.itineraryItem.deleteMany({ where: { dayId: day.id } });
        await tx.day.update({ where: { id: day.id }, data: { title: plan.title || null } });
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
