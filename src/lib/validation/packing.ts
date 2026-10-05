import { z } from "zod";
import { numeric } from "./common";

export const packingItemSchema = z.object({
  name: z.string().trim().min(1, "준비물 이름을 입력해 주세요.").max(60, "60자 이내로 입력해 주세요."),
  group: z.string().trim().min(1).max(20).default("기본"),
  quantity: numeric("수량을 입력해 주세요.").pipe(z.number().int().min(1, "수량은 1 이상이어야 해요.").max(99, "수량은 99 이하로 입력해 주세요.")).default(1),
});

export const packingPatchSchema = z
  .object({
    name: packingItemSchema.shape.name,
    group: z.string().trim().min(1).max(20),
    quantity: numeric("수량을 입력해 주세요.").pipe(z.number().int().min(1, "수량은 1 이상이어야 해요.").max(99, "수량은 99 이하로 입력해 주세요.")),
    isPacked: z.boolean(),
  })
  .partial();
