import "server-only";
import { z } from "zod";
import { type AIActionTypeName, actionPayloadSchemas } from "@/lib/ai-actions";
import type { DayView } from "@/lib/itinerary";
import { track } from "@/server/analytics/track";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { addItem, deleteItem, findTripItem, reflowItineraryDay, updateItem } from "@/server/services/itinerary-service";
import { assertTripAccess } from "@/server/services/trip-service";
import { parseOrThrow } from "@/server/validate";

export const decideSchema = z.object({ decision: z.enum(["approve", "reject"]) });

type Result = { days: DayView[] };

/**
 * Runs an AI-proposed change only after the user approved it. Before running it re-checks:
 * the action belongs to this trip and this user, it is still PROPOSED and not expired, the
 * user may still edit the trip, the payload matches the schema for its type, and every
 * referenced item/day still belongs to the trip (via the regular service functions).
 */
export async function decideAction(tripId: string, userId: string, actionId: string, raw: unknown) {
  const { decision } = parseOrThrow(decideSchema, raw);
  await assertTripAccess(tripId, userId);

  const action = await db.aIAction.findFirst({ where: { id: actionId, tripId, userId } });
  if (!action) throw new AppError("NOT_FOUND", "제안을 찾을 수 없어요.");
  if (action.status !== "PROPOSED") throw new AppError("CONFLICT", "이미 처리된 제안이에요.");
  if (action.expiresAt && action.expiresAt.getTime() < Date.now()) {
    await db.aIAction.update({ where: { id: action.id }, data: { status: "EXPIRED" } });
    throw new AppError("CONFLICT", "시간이 지나 만료된 제안이에요. 다시 물어봐 주세요.");
  }

  // Claim the action atomically so a double tap cannot run it twice.
  const claimed = await db.aIAction.updateMany({
    where: { id: action.id, status: "PROPOSED" },
    data: { status: decision === "approve" ? "APPROVED" : "REJECTED", decidedAt: new Date() },
  });
  if (claimed.count === 0) throw new AppError("CONFLICT", "이미 처리된 제안이에요.");

  const type = action.type as AIActionTypeName;
  if (decision === "reject") {
    await track("ai_action_decided", { userId, tripId, properties: { type, approved: false } });
    return { status: "REJECTED" as const, days: [] as DayView[] };
  }

  try {
    await assertTripAccess(tripId, userId, "EDITOR");
    const result = await execute(tripId, userId, type, action.payload);
    await db.aIAction.update({ where: { id: action.id }, data: { status: "EXECUTED", executedAt: new Date() } });
    await track("ai_action_decided", { userId, tripId, properties: { type, approved: true } });
    return { status: "EXECUTED" as const, days: result.days };
  } catch (error) {
    const message = error instanceof AppError ? error.message : "실행하지 못했어요.";
    await db.aIAction.update({ where: { id: action.id }, data: { status: "FAILED", error: message.slice(0, 200) } });
    if (error instanceof AppError) throw error;
    throw new AppError("INTERNAL", "제안을 적용하지 못했어요. 다시 시도해 주세요.");
  }
}

async function execute(tripId: string, userId: string, type: AIActionTypeName, payload: unknown): Promise<Result> {
  switch (type) {
    case "ADD_PLACE": {
      const p = parse(type, payload);
      return addItem(tripId, userId, {
        dayId: p.dayId,
        title: p.title,
        category: p.category,
        startMinute: p.startMinute,
        durationMinutes: p.durationMinutes,
        address: p.address,
        latitude: p.latitude,
        longitude: p.longitude,
      });
    }
    case "REMOVE_PLACE": {
      const p = parse(type, payload);
      return deleteItem(tripId, userId, p.itemId);
    }
    case "RESCHEDULE": {
      const p = parse(type, payload);
      const updated = await updateItem(tripId, userId, p.itemId, { startMinute: p.startMinute, durationMinutes: p.durationMinutes });
      const day = updated.days[0]!;
      // Later stops follow automatically ("이후 일정을 자동으로 조정").
      return reflowItineraryDay(tripId, userId, day.id, { fromItemId: p.itemId });
    }
    case "REPLACE_PLACE": {
      const p = parse(type, payload);
      return updateItem(tripId, userId, p.itemId, {
        title: p.title,
        category: p.category,
        durationMinutes: p.durationMinutes,
        address: p.address,
        latitude: p.latitude,
        longitude: p.longitude,
        note: `AI 추천으로 ‘${p.fromTitle}’에서 변경했어요.`,
      });
    }
    case "SUGGEST_ALTERNATIVE": {
      const p = parse(type, payload);
      if (p.itemId) {
        await findTripItem(db, tripId, p.itemId);
        return updateItem(tripId, userId, p.itemId, {
          title: p.title,
          category: p.category,
          durationMinutes: p.durationMinutes,
          address: p.address,
          latitude: p.latitude,
          longitude: p.longitude,
        });
      }
      return addItem(tripId, userId, {
        dayId: p.dayId,
        title: p.title,
        category: p.category,
        startMinute: p.startMinute,
        durationMinutes: p.durationMinutes,
        address: p.address,
        latitude: p.latitude,
        longitude: p.longitude,
      });
    }
    case "UPDATE_BUDGET": {
      const p = parse(type, payload);
      const trip = await db.trip.findUniqueOrThrow({ where: { id: tripId }, select: { currency: true } });
      await db.budget.upsert({
        where: { tripId },
        create: { tripId, totalAmount: p.amount, currency: trip.currency },
        update: { totalAmount: p.amount },
      });
      return { days: [] };
    }
    case "CREATE_NOTE": {
      const p = parse(type, payload);
      const day = await db.day.findFirst({ where: { id: p.dayId, tripId } });
      if (!day) throw new AppError("NOT_FOUND", "날짜를 찾을 수 없어요.");
      await db.day.update({ where: { id: day.id }, data: { notes: [day.notes, p.note].filter(Boolean).join("\n").slice(0, 1000) } });
      return { days: [] };
    }
    case "CREATE_JOURNAL": {
      const p = parse(type, payload);
      const day = p.dayId ? await db.day.findFirst({ where: { id: p.dayId, tripId } }) : null;
      const trip = await db.trip.findUniqueOrThrow({ where: { id: tripId }, select: { startDate: true } });
      await db.journalEntry.create({
        data: {
          tripId,
          authorId: userId,
          dayId: day?.id ?? null,
          content: p.content,
          mood: p.mood,
          rating: p.rating,
          entryDate: day?.date ?? trip.startDate,
        },
      });
      await track("create_journal", { userId, tripId, properties: { source: "ai" } });
      return { days: [] };
    }
  }
}

function parse<T extends AIActionTypeName>(type: T, payload: unknown): z.infer<(typeof actionPayloadSchemas)[T]> {
  const parsed = actionPayloadSchemas[type].safeParse(payload);
  if (!parsed.success) throw new AppError("VALIDATION", "제안 내용이 올바르지 않아 적용할 수 없어요.");
  return parsed.data as z.infer<(typeof actionPayloadSchemas)[T]>;
}
