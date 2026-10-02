import "server-only";
import { z } from "zod";
import { type Prisma, TripMemberRole } from "@/generated/prisma/client";
import { MAX_TRIP_DAYS } from "@/lib/constants";
import { diffDaysIso, eachDateIso, formatShortDate, fromDbDate, toDbDate } from "@/lib/dates";
import { fieldErrors } from "@/lib/validation/common";
import {
  type CreateTripInput,
  type UpdateTripInput,
  createTripSchema,
  updateTripSchema,
} from "@/lib/validation/trip";
import { track } from "@/server/analytics/track";
import { db } from "@/server/db";
import { AppError, notFound } from "@/server/errors";

// ───────────────────────────── Access control ─────────────────────────────

const ROLE_RANK: Record<TripMemberRole, number> = { VIEWER: 0, EDITOR: 1, OWNER: 2 };

/**
 * Every trip-scoped operation goes through here. A trip the user is not a member of is
 * reported as "not found" so ids cannot be probed (IDOR).
 */
export async function assertTripAccess(
  tripId: string,
  userId: string,
  minRole: TripMemberRole = "VIEWER",
): Promise<TripMemberRole> {
  const membership = await db.tripMember.findUnique({
    where: { tripId_userId: { tripId, userId } },
    select: { role: true },
  });
  if (!membership) throw notFound("여행");
  if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
    throw new AppError("FORBIDDEN", "이 여행을 변경할 권한이 없어요.");
  }
  return membership.role;
}

// ───────────────────────────── DTOs ─────────────────────────────

const tripSummaryInclude = {
  budget: { select: { totalAmount: true, currency: true } },
  members: { select: { userId: true, role: true } },
  _count: { select: { days: true } },
} satisfies Prisma.TripInclude;

type TripSummaryRow = Prisma.TripGetPayload<{ include: typeof tripSummaryInclude }>;

export type TripSummary = ReturnType<typeof toTripSummary>;

function toTripSummary(row: TripSummaryRow, userId: string) {
  return {
    id: row.id,
    title: row.title,
    destination: row.destination,
    timezone: row.timezone,
    startDate: fromDbDate(row.startDate),
    endDate: fromDbDate(row.endDate),
    travelerCount: row.travelerCount,
    styles: row.styles,
    pace: row.pace,
    preferredPlaces: row.preferredPlaces,
    preferredFoods: row.preferredFoods,
    purpose: row.purpose,
    notes: row.notes,
    currency: row.currency,
    status: row.status,
    budgetAmount: row.budget ? Number(row.budget.totalAmount) : null,
    dayCount: row._count.days,
    role: row.members.find((m) => m.userId === userId)?.role ?? "VIEWER",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type TripDetail = Awaited<ReturnType<typeof getTrip>>;

// ───────────────────────────── Queries ─────────────────────────────

export async function listTrips(userId: string): Promise<TripSummary[]> {
  const rows = await db.trip.findMany({
    where: { members: { some: { userId } } },
    include: tripSummaryInclude,
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((row) => toTripSummary(row, userId));
}

export async function getTrip(tripId: string, userId: string) {
  await assertTripAccess(tripId, userId);
  const row = await db.trip.findUnique({
    where: { id: tripId },
    include: {
      ...tripSummaryInclude,
      days: {
        orderBy: { dayNumber: "asc" },
        select: { id: true, date: true, dayNumber: true, title: true, _count: { select: { items: true } } },
      },
    },
  });
  if (!row) throw notFound("여행");
  return {
    ...toTripSummary(row, userId),
    days: row.days.map((d) => ({
      id: d.id,
      date: fromDbDate(d.date),
      dayNumber: d.dayNumber,
      title: d.title,
      itemCount: d._count.items,
    })),
  };
}

// ───────────────────────────── Mutations ─────────────────────────────

function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION", "입력값을 확인해 주세요.", fieldErrors(parsed.error));
  }
  return parsed.data;
}

export async function createTrip(userId: string, rawInput: CreateTripInput | unknown) {
  const input = parseOrThrow(createTripSchema, rawInput);
  const dates = eachDateIso(input.startDate, input.endDate);

  const trip = await db.trip.create({
    data: {
      ownerId: userId,
      title: input.title,
      destination: input.destination,
      timezone: input.timezone,
      startDate: toDbDate(input.startDate),
      endDate: toDbDate(input.endDate),
      travelerCount: input.travelerCount,
      styles: input.styles,
      pace: input.pace ?? null,
      preferredPlaces: input.preferredPlaces,
      preferredFoods: input.preferredFoods,
      purpose: input.purpose ?? null,
      notes: input.notes ?? null,
      currency: input.currency,
      members: { create: { userId, role: TripMemberRole.OWNER } },
      days: { create: dates.map((date, i) => ({ date: toDbDate(date), dayNumber: i + 1 })) },
      budget:
        input.budgetAmount !== undefined
          ? { create: { totalAmount: input.budgetAmount, currency: input.currency } }
          : undefined,
    },
    select: { id: true },
  });

  await track("create_trip", {
    userId,
    tripId: trip.id,
    properties: { days: dates.length, travelers: input.travelerCount, hasBudget: input.budgetAmount !== undefined },
  });
  return trip;
}

/**
 * Partial update. `budgetAmount: null` removes the budget; omitting it leaves it unchanged.
 * Changing dates adds/removes Day rows; removing a day that still has itinerary items is refused.
 */
export async function updateTrip(tripId: string, userId: string, rawPatch: UpdateTripInput | unknown) {
  await assertTripAccess(tripId, userId, "EDITOR");
  const patch = parseOrThrow(updateTripSchema, rawPatch);

  await db.$transaction(async (tx) => {
    const current = await tx.trip.findUniqueOrThrow({
      where: { id: tripId },
      select: { startDate: true, endDate: true, currency: true },
    });
    const startDate = patch.startDate ?? fromDbDate(current.startDate);
    const endDate = patch.endDate ?? fromDbDate(current.endDate);
    const span = diffDaysIso(startDate, endDate);
    if (span < 0) {
      throw new AppError("VALIDATION", "입력값을 확인해 주세요.", { endDate: "귀국일은 출발일 이후여야 해요." });
    }
    if (span + 1 > MAX_TRIP_DAYS) {
      throw new AppError("VALIDATION", "입력값을 확인해 주세요.", {
        endDate: `여행 기간은 최대 ${MAX_TRIP_DAYS}일까지 설정할 수 있어요.`,
      });
    }

    const datesChanged =
      startDate !== fromDbDate(current.startDate) || endDate !== fromDbDate(current.endDate);
    if (datesChanged) await reconcileDays(tx, tripId, startDate, endDate);

    const currency = patch.currency ?? current.currency;
    await tx.trip.update({
      where: { id: tripId },
      data: {
        title: patch.title,
        destination: patch.destination,
        timezone: patch.timezone,
        startDate: toDbDate(startDate),
        endDate: toDbDate(endDate),
        travelerCount: patch.travelerCount,
        styles: patch.styles,
        pace: "pace" in patch ? (patch.pace ?? null) : undefined,
        preferredPlaces: patch.preferredPlaces,
        preferredFoods: patch.preferredFoods,
        purpose: "purpose" in patch ? (patch.purpose ?? null) : undefined,
        notes: "notes" in patch ? (patch.notes ?? null) : undefined,
        currency,
      },
    });

    if (patch.budgetAmount === null) {
      await tx.budget.deleteMany({ where: { tripId } });
    } else if (patch.budgetAmount !== undefined) {
      await tx.budget.upsert({
        where: { tripId },
        create: { tripId, totalAmount: patch.budgetAmount, currency },
        update: { totalAmount: patch.budgetAmount, currency },
      });
    } else if (patch.currency) {
      await tx.budget.updateMany({ where: { tripId }, data: { currency } });
    }
  });

  await track("update_trip", { userId, tripId });
  return { id: tripId };
}

async function reconcileDays(tx: Prisma.TransactionClient, tripId: string, startDate: string, endDate: string) {
  const wanted = eachDateIso(startDate, endDate);
  const wantedSet = new Set(wanted);
  const existing = await tx.day.findMany({
    where: { tripId },
    select: { id: true, date: true, _count: { select: { items: true } } },
  });

  const removed = existing.filter((d) => !wantedSet.has(fromDbDate(d.date)));
  const blocked = removed.filter((d) => d._count.items > 0);
  if (blocked.length > 0) {
    const labels = blocked.map((d) => formatShortDate(fromDbDate(d.date))).join(", ");
    throw new AppError(
      "CONFLICT",
      `${labels}에 일정이 남아 있어 여행 기간을 줄일 수 없어요. 일정을 먼저 옮기거나 삭제해 주세요.`,
      { endDate: "일정이 있는 날짜는 기간에서 뺄 수 없어요." },
    );
  }
  if (removed.length > 0) await tx.day.deleteMany({ where: { id: { in: removed.map((d) => d.id) } } });

  // Day numbers are unique per trip: park the kept rows on negative numbers first, then renumber.
  const kept = existing.filter((d) => wantedSet.has(fromDbDate(d.date)));
  for (const [i, day] of kept.entries()) {
    await tx.day.update({ where: { id: day.id }, data: { dayNumber: -(i + 1) } });
  }
  const keptByDate = new Map(kept.map((d) => [fromDbDate(d.date), d.id]));
  for (const [i, date] of wanted.entries()) {
    const id = keptByDate.get(date);
    if (id) {
      await tx.day.update({ where: { id }, data: { dayNumber: i + 1 } });
    } else {
      await tx.day.create({ data: { tripId, date: toDbDate(date), dayNumber: i + 1 } });
    }
  }
}

export async function deleteTrip(tripId: string, userId: string) {
  await assertTripAccess(tripId, userId, "OWNER");
  await db.trip.delete({ where: { id: tripId } });
  await track("delete_trip", { userId });
}
