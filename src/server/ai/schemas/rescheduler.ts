import "server-only";
import { z } from "zod";

export const rescheduleProposalSchema = z.strictObject({
  summary: z.string().max(400),
  changes: z
    .array(
      z.strictObject({
        ref: z.string().max(10),
        action: z.enum(["MOVE", "SHORTEN", "REMOVE"]),
        newStartTime: z.string().regex(/^\d{1,2}:\d{2}$/).nullable(),
        newDurationMinutes: z.number().int().min(0).max(720).nullable(),
        reason: z.string().max(160),
      }),
    )
    .max(15),
});

export type RescheduleProposalDraft = z.infer<typeof rescheduleProposalSchema>;
