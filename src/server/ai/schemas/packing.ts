import "server-only";
import { z } from "zod";

export const packingListSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        name: z.string().min(1).max(60),
        group: z.enum(["필수 서류", "기본", "전자기기", "의류", "세면·건강", "날씨", "맞춤"]),
        quantity: z.number().int().min(1).max(20),
        reason: z.string().max(80).nullable(),
      }),
    )
    .max(60),
});

export type PackingList = z.infer<typeof packingListSchema>;
