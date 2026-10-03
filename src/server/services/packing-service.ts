import "server-only";
import { diffDaysIso, fromDbDate } from "@/lib/dates";
import { packingItemSchema, packingPatchSchema } from "@/lib/validation/packing";
import { runAI } from "@/server/ai/guard";
import { PACKING_SCHEMA_NAME, type PackingContext, packingInput, packingSystemPrompt } from "@/server/ai/prompts/packing";
import { packingListSchema } from "@/server/ai/schemas/packing";
import { db } from "@/server/db";
import { notFound } from "@/server/errors";
import { parseOrThrow } from "@/server/validate";
import { assertTripAccess } from "./trip-service";
import { getTripWeather } from "./weather-service";

export const PACKING_GROUP_ORDER = ["필수 서류", "기본", "전자기기", "의류", "세면·건강", "날씨", "맞춤"];

export interface PackingItemView {
  id: string;
  name: string;
  group: string;
  quantity: number;
  isPacked: boolean;
  reason: string | null;
  source: "USER" | "AI";
}

export async function getPacking(tripId: string, userId: string) {
  const role = await assertTripAccess(tripId, userId);
  const items = await db.packingItem.findMany({ where: { tripId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  return {
    canEdit: role !== "VIEWER",
    items: items.map(
      (i): PackingItemView => ({ id: i.id, name: i.name, group: i.group, quantity: i.quantity, isPacked: i.isPacked, reason: i.reason, source: i.source }),
    ),
  };
}

export type PackingData = Awaited<ReturnType<typeof getPacking>>;

export async function addPackingItem(tripId: string, userId: string, raw: unknown) {
  await assertTripAccess(tripId, userId, "EDITOR");
  const input = parseOrThrow(packingItemSchema, raw);
  const last = await db.packingItem.aggregate({ where: { tripId }, _max: { position: true } });
  await db.packingItem.create({ data: { tripId, ...input, position: (last._max.position ?? 0) + 1 } });
  return getPacking(tripId, userId);
}

export async function updatePackingItem(tripId: string, userId: string, itemId: string, raw: unknown) {
  await assertTripAccess(tripId, userId, "EDITOR");
  const patch = parseOrThrow(packingPatchSchema, raw);
  const { count } = await db.packingItem.updateMany({ where: { id: itemId, tripId }, data: patch });
  if (count === 0) throw notFound("준비물");
  return getPacking(tripId, userId);
}

export async function deletePackingItem(tripId: string, userId: string, itemId: string) {
  await assertTripAccess(tripId, userId, "EDITOR");
  const { count } = await db.packingItem.deleteMany({ where: { id: itemId, tripId } });
  if (count === 0) throw notFound("준비물");
  return getPacking(tripId, userId);
}

/** AI checklist from destination, length, weather, styles and planned activities; never duplicates. */
export async function generatePacking(tripId: string, userId: string) {
  await assertTripAccess(tripId, userId, "EDITOR");
  // Refresh the forecast first so weather items reflect it (best effort).
  await getTripWeather(tripId, userId).catch(() => null);
  const trip = await db.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: {
      owner: { select: { travelProfile: true } },
      packingItems: { select: { name: true, position: true } },
      weather: true,
      days: { select: { items: { select: { category: true } } } },
    },
  });
  const temps = trip.weather;
  const context: PackingContext = {
    destination: trip.destination,
    domestic: trip.timezone === "Asia/Seoul",
    nights: diffDaysIso(fromDbDate(trip.startDate), fromDbDate(trip.endDate)),
    travelerCount: trip.travelerCount,
    styles: trip.styles.length ? trip.styles : (trip.owner.travelProfile?.styles ?? []),
    weather: {
      known: temps.length > 0,
      minTemp: temps.length ? Math.round(Math.min(...temps.map((w) => w.tempMinC))) : null,
      maxTemp: temps.length ? Math.round(Math.max(...temps.map((w) => w.tempMaxC))) : null,
      rainyDays: temps.filter((w) => (w.precipitationProbability ?? 0) >= 60 || w.condition === "rain").length,
      snowy: temps.some((w) => w.condition === "snow"),
    },
    plannedCategories: [...new Set(trip.days.flatMap((d) => d.items.map((i) => i.category)))],
    notes: trip.notes,
    existing: trip.packingItems.map((i) => i.name),
  };
  const list = await runAI({
    feature: "PACKING",
    schemaName: PACKING_SCHEMA_NAME,
    schema: packingListSchema,
    system: packingSystemPrompt(),
    input: packingInput(context),
    context,
    userId,
    tripId,
  });
  const existing = new Set(context.existing);
  const start = trip.packingItems.reduce((m, i) => Math.max(m, i.position), 0) + 1;
  const fresh = list.items.filter((i) => !existing.has(i.name.trim()));
  await db.packingItem.createMany({
    data: fresh.map((i, idx) => ({
      tripId,
      name: i.name.trim(),
      group: i.group,
      quantity: i.quantity,
      reason: i.reason,
      source: "AI" as const,
      position: start + PACKING_GROUP_ORDER.indexOf(i.group) * 100 + idx,
    })),
  });
  return { ...(await getPacking(tripId, userId)), added: fresh.length };
}
