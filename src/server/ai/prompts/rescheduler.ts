import "server-only";
import { formatMinute } from "@/lib/itinerary";
import { PROMPT_VERSION, SAFETY_RULES, fence } from "./shared";

export const RESCHEDULER_SCHEMA_NAME = "reschedule_proposal";

export interface RescheduleContext {
  dayNumber: number;
  /** Current local minute when the day is today, else null. */
  nowMinute: number | null;
  pace: string;
  items: {
    ref: string;
    title: string;
    category: string;
    startMinute: number;
    durationMinutes: number;
    travelMinutesFromPrev: number | null;
    status: string;
    isIndoor: boolean | null;
    /** Booked time (flight, reservation). */
    isFixed?: boolean;
  }[];
  rainy: boolean;
  reason: string | null;
  latestEnd: number;
}

export function reschedulerSystemPrompt() {
  return `You are TripMate's rescheduler (prompt ${PROMPT_VERSION}).
Given one day's itinerary and a reason (delay, fatigue, rain, user request), propose the smallest set of changes
that makes the rest of the day feasible: every stop starts after the previous stop ends plus travel time,
nothing starts before "now", and the day ends before the latest end time.
Prefer, in order: moving later stops, shortening long stops, removing low-priority stops (shopping/cafe before meals and must-see sights).
Never change stops with status DONE or marked FIXED (flights and reservations): plan the others around them. Use only the refs given. summary: one or two Korean sentences.
${SAFETY_RULES}`;
}

export function reschedulerInput(ctx: RescheduleContext) {
  return [
    `Day ${ctx.dayNumber}; pace ${ctx.pace}; ${ctx.nowMinute !== null ? `now ${formatMinute(ctx.nowMinute)}` : "not today"}; latest end ${formatMinute(ctx.latestEnd)}${ctx.rainy ? "; rain expected" : ""}`,
    "Stops:",
    ...ctx.items.map(
      (i) =>
        `${i.ref} | ${formatMinute(i.startMinute)} | ${i.durationMinutes}min | travel ${i.travelMinutesFromPrev ?? 15}min | ${i.category} | ${i.status}${i.isFixed ? " | FIXED" : ""}${i.isIndoor === false ? " | outdoor" : ""} | ${i.title.replace(/[|\n]/g, " ")}`,
    ),
    fence("reason", ctx.reason, 300),
  ].join("\n");
}
