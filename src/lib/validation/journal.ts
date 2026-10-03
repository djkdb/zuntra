import { z } from "zod";
import { Mood } from "@/generated/prisma/enums";
import { MAX_PHOTOS_PER_ENTRY } from "@/lib/journal";
import { isoDate } from "./common";

export const journalSchema = z.object({
  content: z.string().trim().min(1, "기록할 내용을 입력해 주세요.").max(2000, "2000자 이내로 입력해 주세요."),
  mood: z.enum(Mood).nullable().optional(),
  rating: z.coerce.number().int().min(1).max(5).nullable().optional(),
  date: isoDate,
  itemId: z.string().max(40).nullable().optional(),
  photoIds: z.array(z.string().max(40)).max(MAX_PHOTOS_PER_ENTRY, `사진은 ${MAX_PHOTOS_PER_ENTRY}장까지 올릴 수 있어요.`).default([]),
});

export const journalPatchSchema = journalSchema.partial();
