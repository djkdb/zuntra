import { z } from "zod";
import { ExpenseCategory } from "@/generated/prisma/enums";
import { CURRENCY_CODES } from "@/lib/constants";
import { isoDate, numeric } from "./common";

// Rounded to cents before the range check, so 0.001 is "too small" rather than a ₩0 expense.
const amount = numeric("금액을 입력해 주세요.")
  .transform((n) => Math.round(n * 100) / 100)
  .pipe(z.number().positive("금액은 0보다 커야 해요.").max(10_000_000_000, "금액이 너무 커요."));

export const expenseSchema = z.object({
  title: z.string().trim().min(1, "내용을 입력해 주세요.").max(80, "80자 이내로 입력해 주세요."),
  category: z.enum(ExpenseCategory, "카테고리를 골라 주세요."),
  amount,
  date: isoDate,
  note: z.string().trim().max(300).nullable().optional().transform((v) => v || null),
  itineraryItemId: z.string().max(40).nullable().optional(),
  /** Paid in another currency: `amount` is in this currency, converted with `fxRate`. */
  currency: z.enum(CURRENCY_CODES, "통화를 골라 주세요.").optional(),
  /** Trip-currency units for one unit of `currency`. Defaults to a reference rate. */
  // A plain decimal: "9,1" must not become 91 (thousand separators make no sense in a rate).
  fxRate: z
    .union([z.number(), z.string().trim().regex(/^\d+(\.\d+)?$/, "환율은 숫자와 소수점(.)으로 입력해 주세요. 예: 9.1").transform(Number)], "환율을 입력해 주세요.")
    .pipe(z.number().positive("환율은 0보다 커야 해요.").max(1_000_000, "환율을 확인해 주세요."))
    .optional(),
  /** Participant who paid. Omitted on create = the person recording it. */
  paidById: z.string().max(40).nullable().optional(),
  /** Participants who share it; empty = everyone. */
  splitWith: z.array(z.string().max(40)).max(30).optional(),
});

export const expensePatchSchema = expenseSchema.partial();

export const budgetSchema = z.object({
  totalAmount: numeric("예산을 입력해 주세요.").pipe(z.number().min(0, "예산은 0 이상이어야 해요.").max(10_000_000_000, "금액이 너무 커요.")),
  allocations: z.partialRecord(z.enum(ExpenseCategory), numeric().pipe(z.number().min(0, "0 이상으로 입력해 주세요.").max(10_000_000_000))).optional(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
