import "server-only";
import { formatMinute } from "@/lib/itinerary";
import { BUDGET_LEVEL_LABELS, TRAVEL_PACE_LABELS, TRAVEL_STYLE_LABELS } from "@/lib/constants";
import type { PlannerContext } from "../trip-planner-context";
import { PROMPT_VERSION, SAFETY_RULES, fence } from "./shared";

export const PLANNER_SCHEMA_NAME = "trip_plan";

export function plannerSystemPrompt() {
  return `You are TripMate's itinerary planner (prompt ${PROMPT_VERSION}).
Create realistic, feasible day-by-day plans for the requested days only.
Rules:
- Times are local to the destination, 24h "HH:MM". Each stop must start after the previous stop ends plus travel time.
- Respect the pace: RELAXED ≈ 3–4 stops/day with long breaks, MODERATE ≈ 5–6, PACKED ≈ 7–8. Always include lunch and dinner.
- Group nearby places on the same day to minimise travel. Give travelMinutesFromPrev and transportMode for every stop except the first.
- Use real, well-known places at the destination with approximate coordinates and a short address. Set isIndoor.
- estimatedCost is per group (all travelers) in the trip currency, or null if free/unknown.
- Day 1 starts after arrival (from ~13:00) unless notes say otherwise. The last day ends by early afternoon and its final item is the trip to the airport/station (category AIRPORT), leaving 2+ hours before an international departure.
- Days marked rainy should favour indoor places in the afternoon.
- Do not repeat places already planned on other days (listed as existing).
- note: one short Korean sentence explaining why this stop fits the traveler (or null).
${SAFETY_RULES}`;
}

export function plannerInput(ctx: PlannerContext) {
  const lines = [
    `Destination: ${ctx.destination} (timezone ${ctx.timezone})`,
    `Dates: ${ctx.startDate} → ${ctx.endDate}; travelers: ${ctx.travelerCount}; currency: ${ctx.currency}`,
    `Generate days: ${ctx.days.map((d) => `Day ${d.dayNumber} (${d.date}${d.rainy ? ", rainy" : ""}${d.hint ? `, traveller's plan for this day: "${d.hint}" — stay in that city/area` : ""}${d.fixed?.length ? `, already booked (keep clear, plan around): ${d.fixed.map((f) => `${formatMinute(f.start)}–${formatMinute(f.end)} ${f.title.replace(/[,\n]/g, " ")}`).join("; ")}` : ""})`).join(", ")}`,
    `Total days in trip: ${ctx.totalDays}`,
    `Pace: ${ctx.pace} (${TRAVEL_PACE_LABELS[ctx.pace].label}); budget level: ${BUDGET_LEVEL_LABELS[ctx.budgetLevel].label}${
      ctx.budgetAmount ? `; total budget ${ctx.budgetAmount} ${ctx.currency}` : ""
    }`,
    `Styles: ${ctx.styles.map((s) => TRAVEL_STYLE_LABELS[s]).join(", ") || "none"}`,
    ctx.center ? `Destination centre: ${ctx.center.lat.toFixed(4)}, ${ctx.center.lng.toFixed(4)}` : "",
    ctx.existing.length ? `Existing (keep, do not duplicate): ${ctx.existing.join(" | ")}` : "",
    fence("preferred_places", ctx.preferredPlaces.join(", "), 400),
    fence("preferred_foods", ctx.preferredFoods.join(", "), 300),
    fence("purpose", ctx.purpose, 300),
    fence("notes", ctx.notes, 1500),
    fence("request", ctx.request, 800),
  ];
  return lines.filter(Boolean).join("\n");
}
