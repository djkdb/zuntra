import { z } from "zod";

export const inviteRoleSchema = z.enum(["EDITOR", "VIEWER"], { message: "권한을 골라 주세요." });

export const createInviteSchema = z.object({ role: inviteRoleSchema.default("EDITOR") });

export const memberPatchSchema = z.object({ role: inviteRoleSchema });

export const participantNameSchema = z.string().trim().min(1, "이름을 입력해 주세요.").max(20, "20자 이내로 입력해 주세요.");

export const participantSchema = z.object({ name: participantNameSchema });

export const acceptInviteSchema = z.object({
  /** Claim a name the trip already uses for settling costs (e.g. "민수") instead of adding a new one. */
  participantId: z.string().min(1).optional(),
});
