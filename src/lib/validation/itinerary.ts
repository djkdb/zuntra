import { z } from "zod";
import { ItineraryItemStatus, PlaceCategory, TransportMode } from "@/generated/prisma/enums";

const nullableNumber = (min: number, max: number, message: string) =>
  z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v, ctx) => {
      if (v === undefined) return undefined;
      if (v === null || v === "") return null;
      const n = typeof v === "number" ? v : Number(String(v).replace(/[,\s]/g, ""));
      if (!Number.isFinite(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return n;
    });

const itemFields = {
  title: z.string().trim().min(1, "일정 이름을 입력해 주세요.").max(80, "80자 이내로 입력해 주세요."),
  category: z.enum(PlaceCategory),
  startMinute: z.coerce.number().int().min(0, "시간을 확인해 주세요.").max(1439, "시간을 확인해 주세요."),
  durationMinutes: z.coerce.number().int().min(0).max(720, "체류시간은 12시간 이하로 입력해 주세요."),
  travelMinutesFromPrev: nullableNumber(0, 600, "이동시간은 0–600분으로 입력해 주세요."),
  transportMode: z.union([z.enum(TransportMode), z.null(), z.literal("")]).optional().transform((v) => (v === "" ? null : v)),
  estimatedCost: nullableNumber(0, 100_000_000, "비용은 0 이상으로 입력해 주세요."),
  note: z.string().trim().max(500, "메모는 500자 이내로 입력해 주세요.").nullable().optional().transform((v) => (v ? v : v === undefined ? undefined : null)),
  address: z.string().trim().max(200).nullable().optional().transform((v) => (v ? v : v === undefined ? undefined : null)),
  latitude: nullableNumber(-90, 90, "위도가 올바르지 않아요."),
  longitude: nullableNumber(-180, 180, "경도가 올바르지 않아요."),
};

export const createItemSchema = z.object({ dayId: z.string().min(1), ...itemFields });

export const updateItemSchema = z
  .object({ ...itemFields, status: z.enum(ItineraryItemStatus) })
  .partial();

export const moveItemSchema = z.object({
  itemId: z.string().min(1),
  toDayId: z.string().min(1),
  toIndex: z.coerce.number().int().min(0),
});

export const reflowSchema = z.object({ fromItemId: z.string().min(1).optional() });

export const updateDaySchema = z.object({
  title: z.string().trim().max(40).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
