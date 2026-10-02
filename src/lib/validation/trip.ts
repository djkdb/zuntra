import { z } from "zod";
import { TravelPace, TravelStyle } from "@/generated/prisma/enums";
import { CURRENCY_CODES, MAX_TRAVELERS, MAX_TRIP_DAYS } from "@/lib/constants";
import { diffDaysIso, isValidTimeZone } from "@/lib/dates";
import { isoDate, optionalText, tagList } from "./common";

const budgetAmount = z
  .union([z.number(), z.string()])
  .optional()
  .transform((v, ctx) => {
    if (v === undefined || v === "") return undefined;
    const n = typeof v === "number" ? v : Number(String(v).replace(/[,\s]/g, ""));
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: "custom", message: "예산은 0 이상의 숫자로 입력해 주세요." });
      return z.NEVER;
    }
    if (n > 10_000_000_000) {
      ctx.addIssue({ code: "custom", message: "예산이 너무 커요." });
      return z.NEVER;
    }
    return Math.round(n * 100) / 100;
  });

const tripFields = {
  title: z.string().trim().min(1, "여행 이름을 입력해 주세요.").max(60, "여행 이름은 60자 이내로 입력해 주세요."),
  destination: z.string().trim().min(1, "여행지를 입력해 주세요.").max(80, "여행지는 80자 이내로 입력해 주세요."),
  timezone: z.string().trim().refine(isValidTimeZone, "올바른 시간대를 골라 주세요."),
  startDate: isoDate,
  endDate: isoDate,
  travelerCount: z.coerce
    .number("인원을 입력해 주세요.")
    .int("인원은 정수로 입력해 주세요.")
    .min(1, "인원은 1명 이상이어야 해요.")
    .max(MAX_TRAVELERS, `인원은 ${MAX_TRAVELERS}명 이하로 입력해 주세요.`),
  styles: z
    .array(z.enum(TravelStyle))
    .max(8)
    .default([])
    .transform((v) => Array.from(new Set(v))),
  pace: z
    .union([z.enum(TravelPace), z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined)),
  budgetAmount,
  currency: z.enum(CURRENCY_CODES, "통화를 골라 주세요."),
  preferredPlaces: tagList(20, 60),
  preferredFoods: tagList(20, 40),
  purpose: optionalText(200),
  notes: optionalText(2000),
};

function refineDates(
  value: { startDate?: string; endDate?: string },
  ctx: z.RefinementCtx,
) {
  if (!value.startDate || !value.endDate) return;
  const span = diffDaysIso(value.startDate, value.endDate);
  if (span < 0) {
    ctx.addIssue({ code: "custom", path: ["endDate"], message: "귀국일은 출발일 이후여야 해요." });
  } else if (span + 1 > MAX_TRIP_DAYS) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: `여행 기간은 최대 ${MAX_TRIP_DAYS}일까지 설정할 수 있어요.`,
    });
  }
}

export const createTripSchema = z.object(tripFields).superRefine(refineDates);

/**
 * PATCH semantics: every field optional; `budgetAmount: null` clears the budget.
 * The date pair is re-validated against the stored values in the service.
 */
export const updateTripSchema = z
  .object({
    ...tripFields,
    styles: z
      .array(z.enum(TravelStyle))
      .max(8)
      .transform((v) => Array.from(new Set(v))),
    budgetAmount: z.union([z.null(), budgetAmount]),
  })
  .partial()
  .superRefine(refineDates);

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;
export { refineDates as refineTripDates };
