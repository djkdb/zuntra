import "server-only";
import { TRAVEL_STYLE_LABELS } from "@/lib/constants";
import type { TravelStyle } from "@/generated/prisma/enums";
import { PROMPT_VERSION, SAFETY_RULES, fence } from "./shared";

export const PACKING_SCHEMA_NAME = "packing_list";

export interface PackingContext {
  destination: string;
  domestic: boolean;
  nights: number;
  travelerCount: number;
  styles: TravelStyle[];
  weather: { minTemp: number | null; maxTemp: number | null; rainyDays: number; snowy: boolean; known: boolean };
  plannedCategories: string[];
  notes: string | null;
  existing: string[];
}

export function packingSystemPrompt() {
  return `You create practical packing checklists for TripMate (prompt ${PROMPT_VERSION}).
Group items as: 필수 서류, 기본, 전자기기, 의류, 세면·건강, 날씨, 맞춤.
Base clothing quantities on the number of nights. Add weather items only when the forecast supports them, and personalised
items (맞춤) from travel styles, planned activities and notes. Skip anything already in the existing list.
reason: short Korean explanation for 날씨/맞춤 items (null otherwise). Korean item names.
${SAFETY_RULES}`;
}

export function packingInput(ctx: PackingContext) {
  return [
    `Destination: ${ctx.destination} (${ctx.domestic ? "domestic" : "international"}); nights: ${ctx.nights}; travelers: ${ctx.travelerCount}`,
    `Styles: ${ctx.styles.map((s) => TRAVEL_STYLE_LABELS[s]).join(", ") || "-"}; planned: ${ctx.plannedCategories.join(", ") || "-"}`,
    ctx.weather.known
      ? `Forecast: ${ctx.weather.minTemp}–${ctx.weather.maxTemp}°C, rainy days ${ctx.weather.rainyDays}${ctx.weather.snowy ? ", snow" : ""}`
      : "Forecast: not available yet",
    `Existing: ${ctx.existing.join(", ") || "-"}`,
    fence("notes", ctx.notes, 800),
  ].join("\n");
}
