import { z } from "zod";
import { ItineraryItemStatus, PlaceCategory, TransportMode } from "@/generated/prisma/enums";
import { numeric } from "./common";

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
  startMinute: numeric("시간을 확인해 주세요.").pipe(z.number().int("시간을 확인해 주세요.").min(0, "시간을 확인해 주세요.").max(1439, "시간을 확인해 주세요.")),
  durationMinutes: numeric("체류시간을 확인해 주세요.").pipe(z.number().int("체류시간은 분 단위 정수로 입력해 주세요.").min(0, "체류시간을 확인해 주세요.").max(720, "체류시간은 12시간 이하로 입력해 주세요.")),
  travelMinutesFromPrev: nullableNumber(0, 600, "이동시간은 0–600분으로 입력해 주세요."),
  transportMode: z.union([z.enum(TransportMode), z.null(), z.literal("")]).optional().transform((v) => (v === "" ? null : v)),
  estimatedCost: nullableNumber(0, 100_000_000, "비용은 0 이상으로 입력해 주세요."),
  note: z.string().trim().max(500, "메모는 500자 이내로 입력해 주세요.").nullable().optional().transform((v) => (v ? v : v === undefined ? undefined : null)),
  address: z.string().trim().max(200).nullable().optional().transform((v) => (v ? v : v === undefined ? undefined : null)),
  latitude: nullableNumber(-90, 90, "위도가 올바르지 않아요."),
  longitude: nullableNumber(-180, 180, "경도가 올바르지 않아요."),
  isFixed: z.boolean().optional(),
  bookingRef: z.string().trim().max(60, "예약 번호는 60자 이내로 입력해 주세요.").nullable().optional().transform((v) => (v ? v : v === undefined ? undefined : null)),
};

export const createItemSchema = z.object({ dayId: z.string().min(1), ...itemFields });

export const updateItemSchema = z
  .object({ ...itemFields, status: z.enum(ItineraryItemStatus), expectedUpdatedAt: z.iso.datetime() })
  .partial();

export const moveItemSchema = z.object({
  itemId: z.string().min(1),
  toDayId: z.string().min(1),
  toIndex: numeric().pipe(z.number().int().min(0)),
});

export const reflowSchema = z.object({ fromItemId: z.string().min(1).optional() });

// Line breaks and bidi overrides make names render deceptively.
const CONTROL_CHARS = /[\p{Cc}\u202A-\u202E\u2066-\u2069]/u;

export const updateDaySchema = z.object({
  title: z
    .string()
    .trim()
    .max(40, "40자 이내로 입력해 주세요.")
    .refine((v) => !CONTROL_CHARS.test(v), "줄바꿈이나 특수 제어 문자는 쓸 수 없어요.")
    .nullable()
    .optional(),
  /** Where the traveller is based that day; empty clears it (back to the trip destination). */
  city: z
    .string()
    .trim()
    .max(40, "40자 이내로 입력해 주세요.")
    .refine((v) => !CONTROL_CHARS.test(v), "줄바꿈이나 특수 제어 문자는 쓸 수 없어요.")
    .nullable()
    .optional(),
  /** Also set `city` on every later day (multi-city trips: "from here on, 교토"). */
  applyToFollowing: z.boolean().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

const clock = z.string().trim().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "시간을 00:00 형식으로 입력해 주세요.");

/** A flight to or from the destination; becomes a fixed airport stop on that day. */
export const flightSchema = z.object({
  direction: z.enum(["arrival", "departure"]),
  dayId: z.string().min(1),
  /** Optional: first-timers often only know the airline and the time. */
  flightNumber: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.toUpperCase().replace(/[\s-]+/g, "") : null))
    // Airline code (2 letters/digits, or 3 letters) + 1–4 digits, e.g. KE723, 7C1101, JJA1301.
    .refine((v) => v === null || /^([A-Z0-9]{2}|[A-Z]{3})\d{1,4}[A-Z]?$/.test(v), "편명은 항공권에 적힌 영문+숫자예요. 예: KE723 (모르면 비워 두세요)"),
  /** Airport on the destination side ("간사이공항", "KIX"). */
  airport: z.string().trim().max(40).optional().transform((v) => v || null),
  /** Arrival: landing time. Departure: take-off time. Local time at the destination. */
  time: clock,
  /** Other end, for the note ("인천 09:05 출발"). */
  otherEnd: z.string().trim().max(60).optional().transform((v) => v || null),
});
export type FlightInput = z.infer<typeof flightSchema>;
