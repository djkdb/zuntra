import "server-only";
import { z } from "zod";
import { PlaceCategory, TransportMode } from "@/generated/prisma/enums";

/**
 * Model output for itinerary generation. Strict objects with nullable (not optional) fields so the
 * same schema works as an OpenAI strict JSON schema.
 */
export const planItemSchema = z.strictObject({
  title: z.string().min(1).max(80),
  category: z.enum(PlaceCategory),
  startTime: z.string().regex(/^\d{1,2}:\d{2}$/),
  durationMinutes: z.number().int().min(0).max(720),
  transportMode: z.enum(TransportMode).nullable(),
  travelMinutesFromPrev: z.number().int().min(0).max(600).nullable(),
  estimatedCost: z.number().min(0).nullable(),
  address: z.string().max(200).nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  isIndoor: z.boolean().nullable(),
  note: z.string().max(200).nullable(),
});

export const planDraftSchema = z.strictObject({
  summary: z.string().max(500),
  days: z
    .array(
      z.strictObject({
        dayNumber: z.number().int().min(1).max(60),
        title: z.string().max(40),
        items: z.array(planItemSchema).max(12),
      }),
    )
    .max(31),
});

export type PlanDraft = z.infer<typeof planDraftSchema>;
export type PlanItemDraft = z.infer<typeof planItemSchema>;
