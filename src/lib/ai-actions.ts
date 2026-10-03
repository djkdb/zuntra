import { z } from "zod";
import { ExpenseCategory, Mood, PlaceCategory } from "@/generated/prisma/enums";

/**
 * Stored AIAction payloads (real ids, resolved server-side from the model's short refs).
 * Every payload is validated when proposed and again right before it runs.
 */
const place = {
  title: z.string().min(1).max(80),
  category: z.enum(PlaceCategory),
  durationMinutes: z.number().int().min(0).max(720),
  address: z.string().max(200).nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
};

export const actionPayloadSchemas = {
  ADD_PLACE: z.object({ dayId: z.string(), startMinute: z.number().int().min(0).max(1439), ...place }),
  REMOVE_PLACE: z.object({ itemId: z.string(), title: z.string() }),
  RESCHEDULE: z.object({
    itemId: z.string(),
    title: z.string(),
    fromStartMinute: z.number().int(),
    fromDurationMinutes: z.number().int(),
    startMinute: z.number().int().min(0).max(1439),
    durationMinutes: z.number().int().min(0).max(720),
  }),
  REPLACE_PLACE: z.object({ itemId: z.string(), fromTitle: z.string(), ...place }),
  UPDATE_BUDGET: z.object({ amount: z.number().min(0).max(10_000_000_000), currency: z.string().length(3), previous: z.number().nullable() }),
  CREATE_NOTE: z.object({ dayId: z.string(), dayNumber: z.number().int(), note: z.string().min(1).max(500) }),
  CREATE_JOURNAL: z.object({
    dayId: z.string().nullable(),
    content: z.string().min(1).max(2000),
    mood: z.enum(Mood).nullable(),
    rating: z.number().int().min(1).max(5).nullable(),
  }),
  SUGGEST_ALTERNATIVE: z.object({
    itemId: z.string().nullable(),
    fromTitle: z.string().nullable(),
    dayId: z.string(),
    startMinute: z.number().int().min(0).max(1439),
    ...place,
  }),
} as const;

export type AIActionTypeName = keyof typeof actionPayloadSchemas;
export type ActionPayload<T extends AIActionTypeName> = z.infer<(typeof actionPayloadSchemas)[T]>;

export const EXPENSE_CATEGORY_KEYS = Object.values(ExpenseCategory);

export interface AIActionView {
  id: string;
  type: AIActionTypeName;
  label: string;
  payload: Record<string, unknown>;
  status: "PROPOSED" | "APPROVED" | "REJECTED" | "EXECUTED" | "FAILED" | "EXPIRED";
  error: string | null;
}

export interface ChatMessageView {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
  quickReplies: string[];
  actions: AIActionView[];
}
