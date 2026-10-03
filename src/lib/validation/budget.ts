import { z } from "zod";
import { ExpenseCategory } from "@/generated/prisma/enums";
import { isoDate } from "./common";

const amount = z
  .preprocess(
    (v) => (typeof v === "string" ? v.replace(/[,\s]/g, "") : v),
    z.coerce.number("금액을 입력해 주세요.").positive("금액은 0보다 커야 해요.").max(10_000_000_000, "금액이 너무 커요."),
  )
  .transform((n) => Math.round(n * 100) / 100);

export const expenseSchema = z.object({
  title: z.string().trim().min(1, "내용을 입력해 주세요.").max(80, "80자 이내로 입력해 주세요."),
  category: z.enum(ExpenseCategory, "카테고리를 골라 주세요."),
  amount,
  date: isoDate,
  note: z.string().trim().max(300).nullable().optional().transform((v) => v || null),
  itineraryItemId: z.string().max(40).nullable().optional(),
});

export const expensePatchSchema = expenseSchema.partial();

export const budgetSchema = z.object({
  totalAmount: z.coerce.number().min(0, "예산은 0 이상이어야 해요.").max(10_000_000_000),
  allocations: z.partialRecord(z.enum(ExpenseCategory), z.coerce.number().min(0).max(10_000_000_000)).optional(),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;
