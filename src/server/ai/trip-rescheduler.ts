import "server-only";
import { z } from "zod";
import { fromDbDate, nowMinuteInTimeZone, todayInTimeZone } from "@/lib/dates";
import { analyzeDay, minuteFromTime, reflowDay } from "@/lib/schedule";
import { track } from "@/server/analytics/track";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { findTripDay, loadDay, renumber } from "@/server/services/itinerary-service";
import { assertTripAccess } from "@/server/services/trip-service";
import { parseOrThrow } from "@/server/validate";
import { runAI } from "./guard";
import { RESCHEDULER_SCHEMA_NAME, type RescheduleContext, reschedulerInput, reschedulerSystemPrompt } from "./prompts/rescheduler";
import { rescheduleProposalSchema } from "./schemas/rescheduler";

export const proposeRescheduleSchema = z.object({
  dayId: z.string().min(1),
  reason: z.string().trim().max(300).optional(),
});

export const applyRescheduleSchema = z.object({
  dayId: z.string().min(1),
  changes: z
    .array(
      z.object({
        itemId: z.string().min(1),
        action: z.enum(["MOVE", "SHORTEN", "REMOVE"]),
        startMinute: z.number().int().min(0).max(1439).nullable().optional(),
        durationMinutes: z.number().int().min(0).max(720).nullable().optional(),
      }),
    )
    .min(1)
    .max(30),
});

export interface ProposedChange {
  itemId: string;
  title: string;
  action: "MOVE" | "SHORTEN" | "REMOVE";
  from: { startMinute: number; durationMinutes: number };
  to: { startMinute: number; durationMinutes: number } | null;
  reason: string;
}

export const nowMinuteIn = nowMinuteInTimeZone;

/**
 * "AI로 일정 다시 맞추기": asks the model (or mock) for a minimal fix, then re-validates every
 * change against the real day and runs the deterministic reflow as a safety net. Nothing is
 * written here — the user confirms the returned preview first.
 */
export async function proposeReschedule(tripId: string, userId: string, raw: unknown, now = new Date()) {
  await assertTripAccess(tripId, userId, "EDITOR");
  const input = parseOrThrow(proposeRescheduleSchema, raw);
  await findTripDay(db, tripId, input.dayId);

  const trip = await db.trip.findUniqueOrThrow({
    where: { id: tripId },
    select: { timezone: true, pace: true, weather: { select: { date: true, precipitationProbability: true } } },
  });
  const day = await loadDay(db, input.dayId);
  if (day.items.length === 0) throw new AppError("VALIDATION", "조정할 일정이 없어요.");

  const isToday = day.date === todayInTimeZone(trip.timezone, now);
  const refs = new Map(day.items.map((item, i) => [`i${i + 1}`, item]));
  const context: RescheduleContext = {
    dayNumber: day.dayNumber,
    nowMinute: isToday ? nowMinuteIn(trip.timezone, now) : null,
    pace: trip.pace ?? "MODERATE",
    rainy: trip.weather.some((w) => fromDbDate(w.date) === day.date && (w.precipitationProbability ?? 0) >= 60),
    reason: input.reason ?? null,
    latestEnd: 23 * 60,
    items: [...refs.entries()].map(([ref, i]) => ({
      ref,
      title: i.title,
      category: i.category,
      startMinute: i.startMinute,
      durationMinutes: i.durationMinutes,
      travelMinutesFromPrev: i.travelMinutesFromPrev,
      status: i.status,
      isIndoor: i.isIndoor ?? null,
      isFixed: i.isFixed ?? false,
    })),
  };

  const proposal = await runAI({
    feature: "RESCHEDULER",
    schemaName: RESCHEDULER_SCHEMA_NAME,
    schema: rescheduleProposalSchema,
    system: reschedulerSystemPrompt(),
    input: reschedulerInput(context),
    context,
    userId,
    tripId,
    fresh: true,
  });

  // Apply the model's changes to a working copy, ignoring anything invalid.
  const working = day.items.map((i) => ({ ...i }));
  const reasons = new Map<string, string>();
  const removed = new Set<string>();
  for (const change of proposal.changes) {
    const item = refs.get(change.ref);
    // Done stops and booked times (flights, reservations) are never touched.
    if (!item || item.status === "DONE" || item.isFixed) continue;
    const w = working.find((x) => x.id === item.id)!;
    reasons.set(item.id, change.reason);
    if (change.action === "REMOVE") {
      removed.add(item.id);
      continue;
    }
    const start = change.newStartTime ? minuteFromTime(change.newStartTime) : null;
    if (start !== null && (context.nowMinute === null || start >= context.nowMinute - 5)) w.startMinute = start;
    if (change.newDurationMinutes !== null) w.durationMinutes = Math.min(change.newDurationMinutes, w.durationMinutes);
  }
  const kept = working.filter((w) => !removed.has(w.id)).sort((a, b) => a.startMinute - b.startMinute);
  const safe = reflowDay(kept).items;

  const changes: ProposedChange[] = [];
  for (const original of day.items) {
    if (removed.has(original.id)) {
      changes.push({
        itemId: original.id,
        title: original.title,
        action: "REMOVE",
        from: { startMinute: original.startMinute, durationMinutes: original.durationMinutes },
        to: null,
        reason: reasons.get(original.id) ?? "일정을 줄였어요.",
      });
      continue;
    }
    const after = safe.find((s) => s.id === original.id)!;
    if (after.startMinute === original.startMinute && after.durationMinutes === original.durationMinutes) continue;
    changes.push({
      itemId: original.id,
      title: original.title,
      action: after.durationMinutes < original.durationMinutes ? "SHORTEN" : "MOVE",
      from: { startMinute: original.startMinute, durationMinutes: original.durationMinutes },
      to: { startMinute: after.startMinute, durationMinutes: after.durationMinutes },
      reason: reasons.get(original.id) ?? "앞 일정에 맞춰 시간을 옮겼어요.",
    });
  }

  // Say so when the result still doesn't work, rather than "all fine" next to an overlap warning.
  const remaining = analyzeDay(safe);
  const summary =
    remaining.length > 0
      ? `${changes.length ? `${proposal.summary} ` : ""}그래도 겹치는 일정이 남아요. 예약 앞 일정을 직접 줄이거나 빼 주세요.`
      : changes.length
        ? proposal.summary
        : "지금 일정은 무리 없이 진행할 수 있어요.";
  return { dayId: day.id, summary, changes };
}

export async function applyReschedule(tripId: string, userId: string, raw: unknown) {
  await assertTripAccess(tripId, userId, "EDITOR");
  const input = parseOrThrow(applyRescheduleSchema, raw);

  const day = await db.$transaction(async (tx) => {
    await findTripDay(tx, tripId, input.dayId);
    const items = await tx.itineraryItem.findMany({ where: { dayId: input.dayId }, select: { id: true, status: true, isFixed: true } });
    const byId = new Map(items.map((i) => [i.id, i]));
    for (const change of input.changes) {
      const item = byId.get(change.itemId);
      // Only items of this day, and never completed ones.
      if (!item) throw new AppError("NOT_FOUND", "일정을 찾을 수 없어요.");
      if (item.status === "DONE" || item.isFixed) continue;
      if (change.action === "REMOVE") {
        await tx.itineraryItem.delete({ where: { id: change.itemId } });
      } else {
        await tx.itineraryItem.update({
          where: { id: change.itemId },
          data: {
            startMinute: change.startMinute ?? undefined,
            durationMinutes: change.durationMinutes ?? undefined,
          },
        });
      }
    }
    const rest = await tx.itineraryItem.findMany({
      where: { dayId: input.dayId },
      orderBy: [{ startMinute: "asc" }, { position: "asc" }],
      select: { id: true },
    });
    await renumber(tx, rest.map((r) => r.id));
    return loadDay(tx, input.dayId);
  });

  await track("edit_itinerary", { userId, tripId, properties: { action: "ai_reschedule", changes: input.changes.length } });
  return { days: [day] };
}
