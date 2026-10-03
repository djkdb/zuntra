import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { type AIActionTypeName, type ChatMessageView, actionPayloadSchemas } from "@/lib/ai-actions";
import { minuteFromTime } from "@/lib/schedule";
import { track } from "@/server/analytics/track";
import { db } from "@/server/db";
import { assertTripAccess } from "@/server/services/trip-service";
import { parseOrThrow } from "@/server/validate";
import { type CompanionContext, buildCompanionContext } from "./context/trip-context";
import { runAI } from "./guard";
import { COMPANION_SCHEMA_NAME, companionInput, companionSystemPrompt } from "./prompts/companion";
import { type CompanionActionDraft, companionReplySchema } from "./schemas/companion";

export const sendMessageSchema = z.object({
  message: z.string().trim().min(1, "메시지를 입력해 주세요.").max(1000, "메시지는 1000자 이내로 입력해 주세요."),
  location: z
    .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .nullable()
    .optional(),
  /** Talk about a specific day (e.g. a rain warning for Day 3) instead of today. */
  focusDayId: z.string().max(40).nullable().optional(),
});

const HISTORY_MESSAGES = 8;
const SUMMARIZE_AFTER = 20;
const ACTION_TTL_MS = 12 * 60 * 60 * 1000;

const quickRepliesSchema = z.object({ quickReplies: z.array(z.string()).default([]) });

type ActionRow = { id: string; type: string; payload: unknown; status: string; error: string | null; messageId: string | null; expiresAt: Date | null };

function toActionView(a: ActionRow, now = Date.now()) {
  const expired = a.status === "PROPOSED" && a.expiresAt !== null && a.expiresAt.getTime() < now;
  const payload = (a.payload ?? {}) as Record<string, unknown>;
  return {
    id: a.id,
    type: a.type as AIActionTypeName,
    label: typeof payload.label === "string" ? payload.label : a.type,
    payload,
    status: (expired ? "EXPIRED" : a.status) as ChatMessageView["actions"][number]["status"],
    error: a.error,
  };
}

async function findConversation(tripId: string, userId: string) {
  return db.aIConversation.findFirst({ where: { tripId, userId }, orderBy: { updatedAt: "desc" } });
}

export async function getConversation(tripId: string, userId: string): Promise<{ messages: ChatMessageView[]; canEdit: boolean }> {
  const role = await assertTripAccess(tripId, userId);
  const conversation = await findConversation(tripId, userId);
  if (!conversation) return { messages: [], canEdit: role !== "VIEWER" };
  const messages = await db.aIMessage.findMany({
    where: { conversationId: conversation.id, role: { in: ["USER", "ASSISTANT"] } },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: { actions: true },
  });
  return {
    canEdit: role !== "VIEWER",
    messages: messages.reverse().map((m) => ({
      id: m.id,
      role: m.role as "USER" | "ASSISTANT",
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      quickReplies: quickRepliesSchema.safeParse(m.meta ?? {}).data?.quickReplies ?? [],
      actions: m.actions.map((a) => toActionView(a)),
    })),
  };
}

/**
 * Turns the model's ref-based action into a typed payload with real ids, or null if it does
 * not refer to something in this trip. This is where hallucinated or injected ids die.
 */
export function resolveAction(draft: CompanionActionDraft, ctx: CompanionContext) {
  const item = draft.ref ? ctx.items.find((i) => i.ref === draft.ref) : undefined;
  if (draft.ref && !item) return null;
  const day = draft.dayNumber ? ctx.days.find((d) => d.dayNumber === draft.dayNumber) : undefined;
  const dayId = day?.dayId ?? item?.dayId ?? ctx.focusDay?.dayId ?? null;
  const start = draft.startTime ? minuteFromTime(draft.startTime) : null;
  const place = {
    title: draft.title?.trim() ?? "",
    category: draft.category ?? "OTHER",
    durationMinutes: draft.durationMinutes ?? 60,
    address: draft.address,
    latitude: draft.latitude,
    longitude: draft.longitude,
  };

  let payload: Record<string, unknown> | null = null;
  switch (draft.type) {
    case "ADD_PLACE":
      if (!dayId || start === null) return null;
      payload = { dayId, startMinute: start, ...place };
      break;
    case "REMOVE_PLACE":
      if (!item) return null;
      payload = { itemId: item.id, title: item.title };
      break;
    case "RESCHEDULE": {
      if (!item) return null;
      const startMinute = start ?? item.startMinute;
      const durationMinutes = draft.durationMinutes ?? item.durationMinutes;
      if (startMinute === item.startMinute && durationMinutes === item.durationMinutes) return null;
      payload = {
        itemId: item.id,
        title: item.title,
        fromStartMinute: item.startMinute,
        fromDurationMinutes: item.durationMinutes,
        startMinute,
        durationMinutes,
      };
      break;
    }
    case "REPLACE_PLACE":
      if (!item) return null;
      payload = { itemId: item.id, fromTitle: item.title, ...place };
      break;
    case "UPDATE_BUDGET":
      if (draft.amount === null) return null;
      payload = { amount: draft.amount, currency: ctx.trip.currency, previous: ctx.budget.total };
      break;
    case "CREATE_NOTE":
      if (!dayId || !draft.text) return null;
      payload = { dayId, dayNumber: day?.dayNumber ?? ctx.focusDay?.dayNumber ?? 1, note: draft.text };
      break;
    case "CREATE_JOURNAL":
      if (!draft.text) return null;
      payload = { dayId: ctx.focusDay?.isToday ? ctx.focusDay.dayId : null, content: draft.text, mood: draft.mood, rating: draft.rating };
      break;
    case "SUGGEST_ALTERNATIVE":
      if (!dayId) return null;
      payload = {
        itemId: item?.id ?? null,
        fromTitle: item?.title ?? null,
        dayId,
        startMinute: start ?? item?.startMinute ?? 12 * 60,
        ...place,
      };
      break;
  }
  const parsed = actionPayloadSchemas[draft.type].safeParse(payload);
  return parsed.success ? { type: draft.type, label: draft.label, payload: parsed.data } : null;
}

export async function sendMessage(tripId: string, userId: string, raw: unknown, now = new Date()) {
  const role = await assertTripAccess(tripId, userId);
  const input = parseOrThrow(sendMessageSchema, raw);

  const conversation =
    (await findConversation(tripId, userId)) ??
    (await db.aIConversation.create({ data: { tripId, userId, title: input.message.slice(0, 40) } }));

  const history = await db.aIMessage.findMany({
    where: { conversationId: conversation.id, role: { in: ["USER", "ASSISTANT"] } },
    orderBy: { createdAt: "desc" },
    take: HISTORY_MESSAGES,
    select: { role: true, content: true },
  });
  const userMessage = await db.aIMessage.create({
    data: { conversationId: conversation.id, role: "USER", content: input.message },
  });

  const ctx = await buildCompanionContext(tripId, {
    canEdit: role !== "VIEWER",
    location: input.location ?? null,
    now,
    focusDayId: input.focusDayId ?? null,
  });
  const reply = await runAI({
    feature: "COMPANION",
    schemaName: COMPANION_SCHEMA_NAME,
    schema: companionReplySchema,
    system: companionSystemPrompt(),
    input: companionInput(ctx, conversation.summary, history.reverse(), input.message),
    context: { ctx, message: input.message },
    userId,
    tripId,
    fresh: true,
    maxOutputTokens: 1200,
  });

  const resolved = ctx.canEdit ? reply.actions.map((a) => resolveAction(a, ctx)).filter((a) => a !== null) : [];

  const assistant = await db.aIMessage.create({
    data: {
      conversationId: conversation.id,
      role: "ASSISTANT",
      content: reply.message,
      meta: { quickReplies: reply.quickReplies.slice(0, 3) } as Prisma.InputJsonValue,
      actions: {
        create: resolved.map((a) => ({
          tripId,
          userId,
          conversationId: conversation.id,
          type: a.type,
          payload: { ...a.payload, label: a.label } as Prisma.InputJsonValue,
          expiresAt: new Date(now.getTime() + ACTION_TTL_MS),
        })),
      },
    },
    include: { actions: true },
  });

  await maybeSummarize(conversation.id, conversation.summary);
  await db.aIConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
  await track("ask_ai", { userId, tripId, properties: { actions: resolved.length, phase: ctx.phase } });

  const view = (m: typeof assistant | typeof userMessage, actions: ActionRow[] = []): ChatMessageView => ({
    id: m.id,
    role: m.role as "USER" | "ASSISTANT",
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    quickReplies: m.id === assistant.id ? reply.quickReplies.slice(0, 3) : [],
    actions: actions.map((a) => toActionView(a)),
  });
  return { messages: [view(userMessage), view(assistant, assistant.actions)] };
}

/**
 * Keeps prompts small: once a conversation is long, older turns are folded into a short,
 * deterministic summary (no extra model call) and only recent turns are sent verbatim.
 */
async function maybeSummarize(conversationId: string, previous: string | null) {
  const count = await db.aIMessage.count({ where: { conversationId } });
  if (count < SUMMARIZE_AFTER || count % 10 !== 0) return;
  const older = await db.aIMessage.findMany({
    where: { conversationId, role: "USER" },
    orderBy: { createdAt: "desc" },
    skip: HISTORY_MESSAGES / 2,
    take: 10,
    select: { content: true },
  });
  const topics = older.map((m) => m.content.replace(/\s+/g, " ").slice(0, 40)).reverse();
  const summary = [previous, `이전에 사용자가 말한 것: ${topics.join(" / ")}`].filter(Boolean).join("\n").slice(-800);
  await db.aIConversation.update({ where: { id: conversationId }, data: { summary } });
}
