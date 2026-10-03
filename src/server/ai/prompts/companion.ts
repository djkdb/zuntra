import "server-only";
import { TRAVEL_PACE_LABELS, TRAVEL_STYLE_LABELS } from "@/lib/constants";
import { formatMinute } from "@/lib/itinerary";
import type { CompanionContext } from "../context/trip-context";
import { PROMPT_VERSION, SAFETY_RULES, fence } from "./shared";

export const COMPANION_SCHEMA_NAME = "companion_reply";

export function companionSystemPrompt() {
  return `You are TripMate, an AI travel companion that is WITH the traveler during their trip (prompt ${PROMPT_VERSION}).
You understand their current situation from <context>: local time, today's plan and progress, location, weather and budget.
Behaviour:
- Be concrete and situational: cite the current time, how many stops remain, travel minutes, weather or money when relevant.
- Keep messages short (2–5 sentences), warm, practical. End with a question when you propose a change.
- When a change to their plan would help, propose it as an action instead of only describing it. The app asks the user to confirm every action.
  ADD_PLACE(dayNumber,title,category,startTime,durationMinutes[,address,lat,lng]) · REMOVE_PLACE(ref) · RESCHEDULE(ref,startTime and/or durationMinutes; later stops are re-flowed automatically)
  REPLACE_PLACE(ref,title,category,durationMinutes[,address,lat,lng]) · UPDATE_BUDGET(amount = new total) · CREATE_NOTE(dayNumber,text)
  CREATE_JOURNAL(text[,mood,rating]) · SUGGEST_ALTERNATIVE(ref or dayNumber+startTime, title, category, durationMinutes)
  label = short Korean button text (e.g. "일정 줄이기", "저녁 일정 변경하기"). Unused parameters are null.
- If the user cannot edit (canEdit=false), propose no actions.
- quickReplies: up to 3 short follow-up replies the traveler might tap (e.g. "현재 일정 유지", "숙소로 이동").
- Never invent bookings, prices you cannot know precisely, or opening hours as facts; hedge with "보통".
${SAFETY_RULES}`;
}

export function renderContext(ctx: CompanionContext): string {
  const line = (i: CompanionContext["items"][number]) =>
    `${i.ref} | ${formatMinute(i.startMinute)}–${formatMinute(Math.min(i.startMinute + i.durationMinutes, 1439))} | ${i.category} | ${i.status}${
      i.ref === ctx.currentRef ? " | CURRENT" : i.ref === ctx.nextRef ? " | NEXT" : ""
    }${i.isIndoor === false ? " | outdoor" : ""} | ${i.title.replace(/[|\n]/g, " ")}`;
  return [
    "<context>",
    `canEdit=${ctx.canEdit}; trip phase=${ctx.phase}; destination=${ctx.trip.destination}; travelers=${ctx.trip.travelerCount}; currency=${ctx.trip.currency}`,
    `Local now: ${ctx.now.date} ${formatMinute(ctx.now.minute)}; trip ${ctx.trip.startDate}→${ctx.trip.endDate} (${ctx.trip.totalDays} days)`,
    `Traveler: pace ${TRAVEL_PACE_LABELS[ctx.profile.pace].label}; styles ${ctx.profile.styles.map((s) => TRAVEL_STYLE_LABELS[s]).join(", ") || "-"}`,
    ctx.focusDay ? `Focus day: Day ${ctx.focusDay.dayNumber} (${ctx.focusDay.date})${ctx.focusDay.isToday ? " = today" : ""}` : "No itinerary days.",
    ...ctx.items.map(line),
    ctx.location ? `User location: ${ctx.location.lat.toFixed(4)},${ctx.location.lng.toFixed(4)}` : "User location: unknown",
    ctx.lodging ? `Lodging: ${ctx.lodging.title}${ctx.lodging.travelMinutes !== null ? ` (~${ctx.lodging.travelMinutes} min away)` : ""}` : "",
    ctx.weather
      ? `Weather: ${ctx.weather.condition}, ${ctx.weather.tempMin}–${ctx.weather.tempMax}°C, rain ${ctx.weather.precipitation ?? "?"}%`
      : "Weather: unknown",
    ctx.rainyDayNumbers.length ? `Rain expected on days: ${ctx.rainyDayNumbers.join(", ")}` : "",
    `Budget: ${ctx.budget.total ?? "none"} total, ${ctx.budget.spent} spent (${ctx.trip.currency})`,
    `Other days: ${ctx.days.map((d) => `Day ${d.dayNumber}:${d.count} stops`).join(", ")}`,
    "</context>",
  ]
    .filter(Boolean)
    .join("\n");
}

export function companionInput(ctx: CompanionContext, summary: string | null, history: { role: string; content: string }[], message: string) {
  return [
    renderContext(ctx),
    summary ? fence("earlier_conversation_summary", summary, 800) : "",
    history.length ? fence("recent_messages", history.map((m) => `${m.role === "USER" ? "traveler" : "tripmate"}: ${m.content}`).join("\n"), 3000) : "",
    fence("traveler_message", message, 1000),
  ]
    .filter(Boolean)
    .join("\n");
}
