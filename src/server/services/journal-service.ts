import "server-only";
import { createId } from "@/server/ids";
import type { Prisma } from "@/generated/prisma/client";
import { fromDbDate, toDbDate } from "@/lib/dates";
import {
  type JournalEntryView,
  MAX_PHOTO_BYTES,
  type PhotoView,
} from "@/lib/journal";
import { journalPatchSchema, journalSchema } from "@/lib/validation/journal";
import { track } from "@/server/analytics/track";
import { db } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { detectImageType, getStorage } from "@/server/integrations/storage";
import { parseOrThrow } from "@/server/validate";
import { assertTripAccess } from "./trip-service";

const MAX_PHOTOS_PER_TRIP = 500;

const entryInclude = {
  day: { select: { dayNumber: true } },
  place: { select: { id: true, name: true, category: true } },
  photos: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.JournalEntryInclude;

type EntryRow = Prisma.JournalEntryGetPayload<{ include: typeof entryInclude }>;

export function photoView(p: {
  id: string;
  width: number | null;
  height: number | null;
  caption: string | null;
}): PhotoView {
  return {
    id: p.id,
    url: `/api/photos/${p.id}`,
    width: p.width,
    height: p.height,
    caption: p.caption,
  };
}

function toView(e: EntryRow, userId: string): JournalEntryView {
  return {
    id: e.id,
    content: e.content,
    mood: e.mood,
    rating: e.rating,
    date: fromDbDate(e.entryDate),
    dayNumber: e.day?.dayNumber ?? null,
    place: e.place,
    photos: e.photos.map(photoView),
    createdAt: e.createdAt.toISOString(),
    isMine: e.authorId === userId,
  };
}

export async function getJournal(tripId: string, userId: string) {
  const role = await assertTripAccess(tripId, userId);
  const trip = await db.trip.findUniqueOrThrow({
    where: { id: tripId },
    select: {
      status: true,
      startDate: true,
      endDate: true,
      timezone: true,
      report: { select: { id: true } },
      days: {
        orderBy: { dayNumber: "asc" },
        select: {
          id: true,
          dayNumber: true,
          date: true,
          items: {
            orderBy: { position: "asc" },
            select: { id: true, title: true },
          },
        },
      },
      journalEntries: {
        orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
        include: entryInclude,
      },
    },
  });
  return {
    canEdit: role !== "VIEWER",
    status: trip.status,
    hasReport: Boolean(trip.report),
    startDate: fromDbDate(trip.startDate),
    endDate: fromDbDate(trip.endDate),
    timezone: trip.timezone,
    days: trip.days.map((d) => ({
      id: d.id,
      dayNumber: d.dayNumber,
      date: fromDbDate(d.date),
      items: d.items,
    })),
    entries: trip.journalEntries.map((e) => toView(e, userId)),
  };
}

export type JournalData = Awaited<ReturnType<typeof getJournal>>;

async function resolveLinks(
  tripId: string,
  date: string,
  itemId: string | null | undefined,
) {
  const day = await db.day.findFirst({
    where: { tripId, date: toDbDate(date) },
    select: { id: true },
  });
  let placeId: string | null = null;
  if (itemId) {
    const item = await db.itineraryItem.findFirst({
      where: { id: itemId, day: { tripId } },
      select: { id: true, title: true, category: true, placeId: true },
    });
    if (!item) throw notFound("일정");
    // Journal entries link to a Place; create one for stops that don't have a location yet.
    placeId =
      item.placeId ??
      (
        await db.place.create({
          data: { tripId, name: item.title, category: item.category },
        })
      ).id;
    if (!item.placeId)
      await db.itineraryItem.update({
        where: { id: item.id },
        data: { placeId },
      });
  }
  return { dayId: day?.id ?? null, placeId };
}

/** Attaches uploaded photos — only this trip's, only unattached or already this entry's. */
async function attachPhotos(
  tx: Prisma.TransactionClient,
  tripId: string,
  userId: string,
  entryId: string,
  photoIds: string[],
) {
  if (photoIds.length === 0) return;
  const { count } = await tx.tripPhoto.updateMany({
    where: {
      id: { in: photoIds },
      tripId,
      uploaderId: userId,
      OR: [{ journalEntryId: null }, { journalEntryId: entryId }],
    },
    data: { journalEntryId: entryId },
  });
  if (count !== photoIds.length)
    throw new AppError("VALIDATION", "첨부할 수 없는 사진이 있어요.");
}

export async function createJournalEntry(
  tripId: string,
  userId: string,
  raw: unknown,
) {
  await assertTripAccess(tripId, userId, "EDITOR");
  const input = parseOrThrow(journalSchema, raw);
  const links = await resolveLinks(tripId, input.date, input.itemId);
  // Entry + photo attachment succeed or fail together.
  await db.$transaction(async (tx) => {
    const entry = await tx.journalEntry.create({
      data: {
        tripId,
        authorId: userId,
        content: input.content,
        mood: input.mood ?? null,
        rating: input.rating ?? null,
        entryDate: toDbDate(input.date),
        ...links,
      },
    });
    await attachPhotos(tx, tripId, userId, entry.id, input.photoIds);
  });
  await track("create_journal", {
    userId,
    tripId,
    properties: { photos: input.photoIds.length, rated: Boolean(input.rating) },
  });
  return getJournal(tripId, userId);
}

/** Members may only change their own entries; the trip owner may moderate all of them. */
async function findOwnEntry(
  tripId: string,
  userId: string,
  entryId: string,
  role: string,
) {
  return db.journalEntry.findFirst({
    where: {
      id: entryId,
      tripId,
      ...(role === "OWNER" ? {} : { authorId: userId }),
    },
    include: { photos: true },
  });
}

export async function updateJournalEntry(
  tripId: string,
  userId: string,
  entryId: string,
  raw: unknown,
) {
  const role = await assertTripAccess(tripId, userId, "EDITOR");
  const input = parseOrThrow(journalPatchSchema, raw);
  const entry = await findOwnEntry(tripId, userId, entryId, role);
  if (!entry) throw notFound("기록");
  const links = input.date
    ? await resolveLinks(tripId, input.date, input.itemId)
    : {};
  await db.$transaction(async (tx) => {
    await tx.journalEntry.update({
      where: { id: entryId },
      data: {
        content: input.content,
        mood: input.mood,
        rating: input.rating,
        entryDate: input.date ? toDbDate(input.date) : undefined,
        ...links,
      },
    });
    if (input.photoIds)
      await attachPhotos(tx, tripId, userId, entryId, input.photoIds);
  });
  return getJournal(tripId, userId);
}

export async function deleteJournalEntry(
  tripId: string,
  userId: string,
  entryId: string,
) {
  const role = await assertTripAccess(tripId, userId, "EDITOR");
  const entry = await findOwnEntry(tripId, userId, entryId, role);
  if (!entry) throw notFound("기록");
  await db.journalEntry.delete({ where: { id: entryId } });
  await db.tripPhoto.deleteMany({
    where: { id: { in: entry.photos.map((p) => p.id) } },
  });
  await getStorage()
    .remove(entry.photos.map((p) => p.storageKey))
    .catch(() => {});
  return getJournal(tripId, userId);
}

export async function uploadPhoto(
  tripId: string,
  userId: string,
  file: {
    bytes: Uint8Array;
    width?: number | null;
    height?: number | null;
    caption?: string | null;
  },
) {
  await assertTripAccess(tripId, userId, "EDITOR");
  if (file.bytes.byteLength === 0)
    throw new AppError("VALIDATION", "빈 파일이에요.");
  if (file.bytes.byteLength > MAX_PHOTO_BYTES)
    throw new AppError("VALIDATION", "사진은 8MB 이하만 올릴 수 있어요.");
  const type = detectImageType(file.bytes);
  if (!type)
    throw new AppError("VALIDATION", "JPG, PNG, WEBP 사진만 올릴 수 있어요.");
  await purgeOrphanPhotos(tripId, userId);
  if (
    (await db.tripPhoto.count({ where: { tripId } })) >= MAX_PHOTOS_PER_TRIP
  ) {
    throw new AppError(
      "VALIDATION",
      `여행 하나에는 사진을 ${MAX_PHOTOS_PER_TRIP}장까지 올릴 수 있어요.`,
    );
  }
  const key = `${tripId.toLowerCase()}/${createId()}.${type}`;
  const contentType = {
    webp: "image/webp",
    jpg: "image/jpeg",
    png: "image/png",
  }[type];
  await getStorage().put(key, file.bytes, contentType);
  const photo = await db.tripPhoto.create({
    data: {
      tripId,
      uploaderId: userId,
      storageKey: key,
      contentType,
      sizeBytes: file.bytes.byteLength,
      width: file.width ?? null,
      height: file.height ?? null,
      caption: file.caption?.slice(0, 200) ?? null,
    },
  });
  return photoView(photo);
}

/** Streams a photo only to members of its trip. */
export async function readPhoto(photoId: string, userId: string) {
  const photo = await db.tripPhoto.findUnique({ where: { id: photoId } });
  if (!photo) throw notFound("사진");
  await assertTripAccess(photo.tripId, userId);
  const object = await getStorage().get(photo.storageKey);
  if (!object) throw notFound("사진");
  return object;
}

/**
 * Photos uploaded but never attached to an entry (abandoned drafts) are removed after a day,
 * so storage does not fill with unreferenced personal images.
 */
async function purgeOrphanPhotos(tripId: string, userId: string) {
  const stale = await db.tripPhoto.findMany({
    where: {
      tripId,
      uploaderId: userId,
      journalEntryId: null,
      createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    select: { id: true, storageKey: true },
    take: 50,
  });
  if (stale.length === 0) return;
  await db.tripPhoto.deleteMany({
    where: { id: { in: stale.map((p) => p.id) } },
  });
  await getStorage()
    .remove(stale.map((p) => p.storageKey))
    .catch(() => {});
}
