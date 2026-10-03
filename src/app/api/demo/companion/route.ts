import { z } from "zod";
import { PlaceCategory } from "@/generated/prisma/enums";
import { todayInTimeZone } from "@/lib/dates";
import { DEMO_NOW_MINUTE, DEMO_TRIP } from "@/lib/demo/tokyo";
import type { CompanionContext } from "@/server/ai/context/trip-context";
import { mockCompanion } from "@/server/ai/mock/companion";
import { companionReplySchema } from "@/server/ai/schemas/companion";
import { findCity } from "@/server/ai/mock/poi-catalog";
import { AppError } from "@/server/errors";
import { handleApi, readJson } from "@/server/http";
import { clientIpFrom, createMemoryRateLimiter } from "@/server/rate-limit";
import { parseOrThrow } from "@/server/validate";

/**
 * Demo Mode companion. Public and stateless: the browser sends its (sample) day, the
 * deterministic companion answers. It never calls a paid model and never touches the database.
 */
const limiter = createMemoryRateLimiter({ limit: 30, windowMs: 60_000 });

const itemSchema = z.object({
  ref: z.string().max(5),
  title: z.string().max(80),
  category: z.enum(PlaceCategory),
  startMinute: z.number().int().min(0).max(1439),
  durationMinutes: z.number().int().min(0).max(720),
  travelMinutesFromPrev: z.number().int().min(0).max(600).nullable(),
  status: z.enum(["PLANNED", "IN_PROGRESS", "DONE", "SKIPPED"]),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});

const bodySchema = z.object({
  message: z.string().trim().min(1).max(500),
  dayNumber: z.number().int().min(1).max(5),
  items: z.array(itemSchema).max(15),
  budget: z.number().min(0).max(10_000_000),
  spent: z.number().min(0).max(10_000_000),
});

export async function POST(request: Request) {
  return handleApi(async () => {
    const limit = await limiter.consume(clientIpFrom(request.headers));
    if (!limit.ok) throw new AppError("RATE_LIMITED", "잠시 후 다시 시도해 주세요.");
    const body = parseOrThrow(bodySchema, await readJson(request));
    const tz = DEMO_TRIP.timezone;
    const minute = DEMO_NOW_MINUTE;
    const items = body.items.map((i) => ({
      ...i,
      id: i.ref,
      dayId: "demo",
      isIndoor: null,
      location: i.lat !== null && i.lng !== null ? { lat: i.lat, lng: i.lng } : null,
    }));
    const current = items.find((i) => i.status === "IN_PROGRESS") ?? items.find((i) => i.status !== "DONE" && i.startMinute <= minute && minute < i.startMinute + i.durationMinutes);
    const next = items.find((i) => i.status !== "DONE" && i.startMinute > minute && i !== current);
    const city = findCity(DEMO_TRIP.destination)!;
    const ctx: CompanionContext = {
      canEdit: true,
      phase: "ongoing",
      now: { date: todayInTimeZone(tz), minute },
      trip: { destination: DEMO_TRIP.destination, currency: DEMO_TRIP.currency, travelerCount: DEMO_TRIP.travelerCount, startDate: "", endDate: "", totalDays: DEMO_TRIP.days.length },
      profile: { styles: [...DEMO_TRIP.styles], pace: "MODERATE", foods: ["라멘", "스시"] },
      focusDay: { dayId: "demo", dayNumber: body.dayNumber, date: todayInTimeZone(tz), isToday: true },
      items,
      currentRef: current?.ref ?? null,
      nextRef: next?.ref ?? null,
      location: null,
      center: city.center,
      lodging: { title: "호텔 · 시부야", location: { lat: 35.658, lng: 139.7016 }, travelMinutes: 18 },
      weather: { condition: "흐림", tempMax: 17, tempMin: 10, precipitation: 30 },
      rainyDayNumbers: [3],
      budget: { total: body.budget, spent: body.spent, byCategory: {} },
      days: DEMO_TRIP.days.map((d) => ({ dayNumber: d.dayNumber, dayId: "demo", date: "", count: d.items.length })),
    };
    return companionReplySchema.parse(mockCompanion({ ctx, message: body.message }));
  });
}
