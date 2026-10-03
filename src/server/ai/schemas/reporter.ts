import "server-only";
import { z } from "zod";

export const reportNarrativeSchema = z.strictObject({
  title: z.string().min(1).max(60),
  retrospective: z.string().min(1).max(900),
  highlights: z.array(z.string().min(1).max(120)).min(1).max(4),
  nextTripTip: z.string().min(1).max(200),
});

export type ReportNarrative = z.infer<typeof reportNarrativeSchema>;
