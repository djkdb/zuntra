import "server-only";
import { z } from "zod";
import { Mood, PlaceCategory } from "@/generated/prisma/enums";

/**
 * Model output for the companion. Actions are flat objects with nullable parameters (strict-schema
 * friendly); the server maps refs to real ids and builds typed payloads.
 */
export const companionActionSchema = z.strictObject({
  type: z.enum([
    "ADD_PLACE",
    "REMOVE_PLACE",
    "RESCHEDULE",
    "REPLACE_PLACE",
    "UPDATE_BUDGET",
    "CREATE_NOTE",
    "CREATE_JOURNAL",
    "SUGGEST_ALTERNATIVE",
  ]),
  label: z.string().min(1).max(40),
  ref: z.string().max(10).nullable(),
  dayNumber: z.number().int().min(1).max(60).nullable(),
  title: z.string().max(80).nullable(),
  category: z.enum(PlaceCategory).nullable(),
  startTime: z.string().regex(/^\d{1,2}:\d{2}$/).nullable(),
  durationMinutes: z.number().int().min(0).max(720).nullable(),
  address: z.string().max(200).nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  amount: z.number().min(0).nullable(),
  text: z.string().max(1000).nullable(),
  mood: z.enum(Mood).nullable(),
  rating: z.number().int().min(1).max(5).nullable(),
});

export const companionReplySchema = z.strictObject({
  message: z.string().min(1).max(1200),
  quickReplies: z.array(z.string().min(1).max(30)).max(3),
  actions: z.array(companionActionSchema).max(3),
});

export type CompanionReply = z.infer<typeof companionReplySchema>;
export type CompanionActionDraft = z.infer<typeof companionActionSchema>;
