import "server-only";
import type { TravelReportView } from "@/lib/report";
import { PROMPT_VERSION, SAFETY_RULES, fence } from "./shared";

export const REPORTER_SCHEMA_NAME = "travel_report";

export interface ReporterContext {
  stats: TravelReportView["stats"];
  highlights: TravelReportView["highlights"];
  trip: TravelReportView["trip"];
  styles: string[];
  journal: { date: string; rating: number | null; place: string | null; content: string }[];
}

export function reporterSystemPrompt() {
  return `You write TripMate's end-of-trip report (prompt ${PROMPT_VERSION}).
Write warmly and specifically in Korean, grounded ONLY in the given stats and journal entries — never invent places or events.
title: a short evocative title. retrospective: 3–5 sentences reflecting what kind of trip it was (e.g. "이번 여행은 관광보다 카페와 맛집을 중심으로...").
highlights: 2–4 bullet memories. nextTripTip: one practical suggestion for their next trip based on budget/pace.
${SAFETY_RULES}`;
}

export function reporterInput(ctx: ReporterContext) {
  const s = ctx.stats;
  return [
    `Trip: ${ctx.trip.destination}, ${ctx.trip.startDate}→${ctx.trip.endDate}, ${ctx.trip.travelerCount} travelers, styles ${ctx.styles.join(", ") || "-"}`,
    `Stats: ${s.days} days, ${s.places} places, spent ${s.totalSpent} ${s.currency}${s.budget ? ` of ${s.budget}` : ""}, photos ${s.photos}`,
    `By category: ${s.byCategory.map((c) => `${c.category} ${c.amount}`).join(", ") || "-"}`,
    `Most visited category: ${ctx.highlights.topCategory?.label ?? "-"}; memorable place: ${ctx.highlights.memorablePlace ?? "-"}; favourite food: ${ctx.highlights.favoriteFood ?? "-"}`,
    fence(
      "journal",
      ctx.journal.map((j) => `${j.date}${j.rating ? ` ★${j.rating}` : ""}${j.place ? ` @${j.place}` : ""}: ${j.content}`).join("\n"),
      3000,
    ),
  ].join("\n");
}
