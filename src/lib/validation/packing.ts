import { z } from "zod";

export const packingItemSchema = z.object({
  name: z.string().trim().min(1, "준비물 이름을 입력해 주세요.").max(60, "60자 이내로 입력해 주세요."),
  group: z.string().trim().min(1).max(20).default("기본"),
  quantity: z.coerce.number().int().min(1).max(99).default(1),
});

export const packingPatchSchema = z
  .object({
    name: packingItemSchema.shape.name,
    group: z.string().trim().min(1).max(20),
    quantity: z.coerce.number().int().min(1).max(99),
    isPacked: z.boolean(),
  })
  .partial();
