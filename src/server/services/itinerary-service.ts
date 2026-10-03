import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { fromDbDate } from "@/lib/dates";
import { estimateTravelMinutes, suggestMode } from "@/lib/geo";
import type { DayView, ItineraryItemView } from "@/lib/itinerary";
import { moveWithinDay, reflowDay as reflow } from "@/lib/schedule";
import {
  createItemSchema,
  moveItemSchema,
  reflowSchema,
  updateDaySchema,
  updateItemSchema,
} from "@/lib/validation/itinerary";
import { track } from "@/server/analytics/track";
import { db } from "@/server/db";
import { notFound } from "@/server/errors";
import { parseOrThrow } from "@/server/validate";
import { assertTripAccess } from "./trip-service";

type Tx = Prisma.TransactionClient;

const itemInclude = {
  place: { select: { id: true, address: true, latitude: true, longitude: true, isIndoor: true } },
} satisfies Prisma.ItineraryItemInclude;

type ItemRow = Prisma.ItineraryItemGetPayload<{ include: typeof itemInclude }>;

export function toItemView(row: ItemRow): ItineraryItemView {
  return {
    id: row.id,
    dayId: row.dayId,
    position: row.position,
    title: row.title,
    category: row.category,
    startMinute: row.startMinute,
    durationMinutes: row.durationMinutes,
    travelMinutesFromPrev: row.travelMinutesFromPrev,
    transportMode: row.transportMode,
    estimatedCost: row.estimatedCost === null ? null : Number(row.estimatedCost),
    note: row.note,
    status: row.status,
    source: row.source,
    placeId: row.placeId,
    address: row.place?.address ?? null,
    latitude: row.place?.latitude ?? null,
    longitude: row.place?.longitude ?? null,
    isIndoor: row.place?.isIndoor ?? null,
  };
}

async function loadDay(tx: Tx | typeof db, dayId: string): Promise<DayView> {
  const day = await tx.day.findUniqueOrThrow({
    where: { id: dayId },
    include: { items: { include: itemInclude, orderBy: { position: "asc" } } },
  });
  return {
    id: day.id,
    dayNumber: day.dayNumber,
    date: fromDbDate(day.date),
    title: day.title,
    notes: day.notes,
    items: day.items.map(toItemView),
  };
}

export async function getItinerary(tripId: string, userId: string) {
  const role = await assertTripAccess(tripId, userId);
  const trip = await db.trip.findUniqueOrThrow({
    where: { id: tripId },
    select: {
      id: true,
      title: true,
      timezone: true,
      startDate: true,
      endDate: true,
      currency: true,
      status: true,
      destination: true,
      destinationLat: true,
      destinationLng: true,
      days: {
        orderBy: { dayNumber: "asc" },
        include: { items: { include: itemInclude, orderBy: { position: "asc" } } },
      },
    },
  });
  return {
    trip: {
      id: trip.id,
      title: trip.title,
      destination: trip.destination,
      timezone: trip.timezone,
      startDate: fromDbDate(trip.startDate),
      endDate: fromDbDate(trip.endDate),
      currency: trip.currency,
      status: trip.status,
      center:
        trip.destinationLat !== null && trip.destinationLng !== null
          ? { lat: trip.destinationLat, lng: trip.destinationLng }
          : null,
      role,
    },
    days: trip.days.map(
      (d): DayView => ({
        id: d.id,
        dayNumber: d.dayNumber,
        date: fromDbDate(d.date),
        title: d.title,
        notes: d.notes,
        items: d.items.map(toItemView),
      }),
    ),
  };
}

export type Itinerary = Awaited<ReturnType<typeof getItinerary>>;

/** Loads an item only if it belongs to the trip — the IDOR guard for item ids. */
async function findTripItem(tx: Tx | typeof db, tripId: string, itemId: string) {
  const item = await tx.itineraryItem.findFirst({
    where: { id: itemId, day: { tripId } },
    include: itemInclude,
  });
  if (!item) throw notFound("일정");
  return item;
}

async function findTripDay(tx: Tx | typeof db, tripId: string, dayId: string) {
  const day = await tx.day.findFirst({ where: { id: dayId, tripId }, select: { id: true } });
  if (!day) throw notFound("날짜");
  return day;
}

async function renumber(tx: Tx, ids: string[]) {
  for (const [position, id] of ids.entries()) {
    await tx.itineraryItem.update({ where: { id }, data: { position } });
  }
}

/** Fills in travel time from the previous stop when both have coordinates and none was given. */
async function estimateMissingTravel(tx: Tx, dayId: string) {
  const items = await tx.itineraryItem.findMany({ where: { dayId }, include: itemInclude, orderBy: { position: "asc" } });
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1]!.place;
    const cur = items[i]!;
    if (cur.travelMinutesFromPrev !== null || !prev?.latitude || !cur.place?.latitude) continue;
    const from = { lat: prev.latitude, lng: prev.longitude! };
    const to = { lat: cur.place.latitude, lng: cur.place.longitude! };
    const mode = cur.transportMode ?? suggestMode(from, to);
    await tx.itineraryItem.update({
      where: { id: cur.id },
      data: { travelMinutesFromPrev: estimateTravelMinutes(from, to, mode), transportMode: mode },
    });
  }
}

async function upsertPlace(
  tx: Tx,
  tripId: string,
  existingPlaceId: string | null,
  data: { name: string; category: ItemRow["category"]; address?: string | null; latitude?: number | null; longitude?: number | null },
) {
  const hasLocation = data.address || (data.latitude !== null && data.latitude !== undefined);
  if (!hasLocation) return existingPlaceId;
  const fields = {
    name: data.name,
    category: data.category,
    address: data.address ?? undefined,
    latitude: data.latitude ?? undefined,
    longitude: data.longitude ?? undefined,
  };
  if (existingPlaceId) {
    await tx.place.update({ where: { id: existingPlaceId }, data: fields });
    return existingPlaceId;
  }
  const place = await tx.place.create({ data: { tripId, ...fields } });
  return place.id;
}

export async function addItem(tripId: string, userId: string, raw: unknown) {
  await assertTripAccess(tripId, userId, "EDITOR");
  const input = parseOrThrow(createItemSchema, raw);

  const day = await db.$transaction(async (tx) => {
    await findTripDay(tx, tripId, input.dayId);
    const siblings = await tx.itineraryItem.findMany({
      where: { dayId: input.dayId },
      orderBy: { position: "asc" },
      select: { id: true, startMinute: true },
    });
    // Insert after the last stop that starts at or before the new one.
    let index = siblings.length;
    for (let i = siblings.length - 1; i >= 0; i--) {
      if (siblings[i]!.startMinute <= input.startMinute) {
        index = i + 1;
        break;
      }
      index = i;
    }
    const placeId = await upsertPlace(tx, tripId, null, {
      name: input.title,
      category: input.category,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
    });
    const created = await tx.itineraryItem.create({
      data: {
        dayId: input.dayId,
        placeId,
        title: input.title,
        category: input.category,
        position: index,
        startMinute: input.startMinute,
        durationMinutes: input.durationMinutes,
        travelMinutesFromPrev: input.travelMinutesFromPrev ?? null,
        transportMode: input.transportMode ?? null,
        estimatedCost: input.estimatedCost ?? null,
        note: input.note ?? null,
        source: "USER",
      },
    });
    const ids = siblings.map((s) => s.id);
    ids.splice(index, 0, created.id);
    await renumber(tx, ids);
    await estimateMissingTravel(tx, input.dayId);
    return loadDay(tx, input.dayId);
  });

  await track("edit_itinerary", { userId, tripId, properties: { action: "add" } });
  return { days: [day] };
}

export async function updateItem(tripId: string, userId: string, itemId: string, raw: unknown) {
  await assertTripAccess(tripId, userId, "EDITOR");
  const patch = parseOrThrow(updateItemSchema, raw);

  const day = await db.$transaction(async (tx) => {
    const item = await findTripItem(tx, tripId, itemId);
    const placeId =
      patch.address !== undefined || patch.latitude !== undefined
        ? await upsertPlace(tx, tripId, item.placeId, {
            name: patch.title ?? item.title,
            category: patch.category ?? item.category,
            address: patch.address,
            latitude: patch.latitude,
            longitude: patch.longitude,
          })
        : item.placeId;

    await tx.itineraryItem.update({
      where: { id: itemId },
      data: {
        title: patch.title,
        category: patch.category,
        startMinute: patch.startMinute,
        durationMinutes: patch.durationMinutes,
        travelMinutesFromPrev: patch.travelMinutesFromPrev,
        transportMode: patch.transportMode,
        estimatedCost: patch.estimatedCost,
        note: patch.note,
        status: patch.status,
        completedAt: patch.status === undefined ? undefined : patch.status === "DONE" ? new Date() : null,
        placeId,
      },
    });

    if (patch.startMinute !== undefined && patch.startMinute !== item.startMinute) {
      // A time edit re-sorts the day by time (stable for ties).
      const siblings = await tx.itineraryItem.findMany({
        where: { dayId: item.dayId },
        orderBy: { position: "asc" },
        select: { id: true, startMinute: true },
      });
      const sorted = siblings
        .map((s, i) => ({ ...s, i }))
        .sort((a, b) => a.startMinute - b.startMinute || a.i - b.i)
        .map((s) => s.id);
      await renumber(tx, sorted);
    }
    return loadDay(tx, item.dayId);
  });

  const action = patch.status === "DONE" ? "complete" : "update";
  await track(patch.status === "DONE" ? "complete_itinerary" : "edit_itinerary", {
    userId,
    tripId,
    properties: { action },
  });
  return { days: [day] };
}

export async function deleteItem(tripId: string, userId: string, itemId: string) {
  await assertTripAccess(tripId, userId, "EDITOR");
  const day = await db.$transaction(async (tx) => {
    const item = await findTripItem(tx, tripId, itemId);
    await tx.itineraryItem.delete({ where: { id: itemId } });
    if (item.placeId) {
      const stillUsed = await tx.place.findFirst({
        where: { id: item.placeId, OR: [{ items: { some: {} } }, { journalEntries: { some: {} } }] },
        select: { id: true },
      });
      if (!stillUsed) await tx.place.delete({ where: { id: item.placeId } });
    }
    const rest = await tx.itineraryItem.findMany({ where: { dayId: item.dayId }, orderBy: { position: "asc" }, select: { id: true } });
    await renumber(tx, rest.map((r) => r.id));
    return loadDay(tx, item.dayId);
  });
  await track("edit_itinerary", { userId, tripId, properties: { action: "delete" } });
  return { days: [day] };
}

/** Drag & drop: move within a day or to another day; the item takes the slot time it lands on. */
export async function moveItem(tripId: string, userId: string, raw: unknown) {
  await assertTripAccess(tripId, userId, "EDITOR");
  const input = parseOrThrow(moveItemSchema, raw);

  const days = await db.$transaction(async (tx) => {
    const item = await findTripItem(tx, tripId, input.itemId);
    await findTripDay(tx, tripId, input.toDayId);
    const sourceDayId = item.dayId;

    const target = await tx.itineraryItem.findMany({
      where: { dayId: input.toDayId },
      orderBy: { position: "asc" },
      select: { id: true, startMinute: true, durationMinutes: true, travelMinutesFromPrev: true },
    });
    const list = sourceDayId === input.toDayId ? target : [...target, { ...item, id: item.id }];
    const moved = moveWithinDay(list, item.id, input.toIndex);
    const newStart = moved.find((m) => m.id === item.id)!.startMinute;

    await tx.itineraryItem.update({
      where: { id: item.id },
      data: {
        dayId: input.toDayId,
        startMinute: newStart,
        // The previous stop changed, so the old travel time no longer applies; it is re-estimated
        // from coordinates below, or the schedule falls back to the default travel time.
        travelMinutesFromPrev: null,
      },
    });
    await renumber(tx, moved.map((m) => m.id));
    await estimateMissingTravel(tx, input.toDayId);

    const changed = [await loadDay(tx, input.toDayId)];
    if (sourceDayId !== input.toDayId) {
      const rest = await tx.itineraryItem.findMany({ where: { dayId: sourceDayId }, orderBy: { position: "asc" }, select: { id: true } });
      await renumber(tx, rest.map((r) => r.id));
      changed.push(await loadDay(tx, sourceDayId));
    }
    return changed;
  });

  await track("edit_itinerary", { userId, tripId, properties: { action: "move" } });
  return { days };
}

/** "자동 조정": pushes later stops so nothing overlaps, then reports what moved. */
export async function reflowItineraryDay(tripId: string, userId: string, dayId: string, raw: unknown) {
  await assertTripAccess(tripId, userId, "EDITOR");
  const input = parseOrThrow(reflowSchema, raw ?? {});
  const result = await db.$transaction(async (tx) => {
    await findTripDay(tx, tripId, dayId);
    const day = await loadDay(tx, dayId);
    const fromIndex = input.fromItemId ? Math.max(day.items.findIndex((i) => i.id === input.fromItemId), 0) : 0;
    const { changes, maxDelay, overflow } = reflow(day.items, fromIndex);
    for (const change of changes) {
      await tx.itineraryItem.update({ where: { id: change.id }, data: { startMinute: change.to } });
    }
    return { day: await loadDay(tx, dayId), changes, maxDelay, overflow };
  });
  await track("edit_itinerary", { userId, tripId, properties: { action: "reflow", moved: result.changes.length } });
  return { days: [result.day], changes: result.changes, maxDelay: result.maxDelay, overflow: result.overflow };
}

export async function updateDay(tripId: string, userId: string, dayId: string, raw: unknown) {
  await assertTripAccess(tripId, userId, "EDITOR");
  const input = parseOrThrow(updateDaySchema, raw);
  await findTripDay(db, tripId, dayId);
  await db.day.update({ where: { id: dayId }, data: { title: input.title || null, notes: input.notes || null } });
  return { days: [await loadDay(db, dayId)] };
}

export { loadDay, findTripItem, findTripDay, renumber, upsertPlace, estimateMissingTravel };
