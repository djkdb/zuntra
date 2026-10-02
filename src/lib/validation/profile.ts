import { z } from "zod";
import { BudgetLevel, CompanionType, TravelPace, TravelStyle } from "@/generated/prisma/enums";
import { tagList } from "./common";

export const travelProfileSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요.").max(40, "이름은 40자 이내로 입력해 주세요."),
  styles: z
    .array(z.enum(TravelStyle))
    .min(1, "여행 스타일을 하나 이상 골라 주세요.")
    .max(8)
    .transform((v) => Array.from(new Set(v))),
  pace: z.enum(TravelPace, "여행 속도를 골라 주세요."),
  budgetLevel: z.enum(BudgetLevel, "예산 수준을 골라 주세요."),
  favoriteFoods: tagList(10, 30),
  companionType: z.enum(CompanionType, "동행 유형을 골라 주세요."),
});

export type TravelProfileInput = z.infer<typeof travelProfileSchema>;
