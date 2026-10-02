import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { type SignUpInput } from "@/lib/validation/auth";
import { type TravelProfileInput } from "@/lib/validation/profile";
import { track } from "@/server/analytics/track";
import { hashPassword } from "@/server/auth/password";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";

export async function registerUser(input: SignUpInput) {
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await db.user.create({
      data: { name: input.name, email: input.email, passwordHash },
      select: { id: true, email: true, name: true },
    });
    await track("signup", { userId: user.id, properties: { method: "email" } });
    return user;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("CONFLICT", "이미 가입된 이메일이에요. 로그인해 주세요.", {
        email: "이미 가입된 이메일이에요.",
      });
    }
    throw error;
  }
}

export async function getTravelProfile(userId: string) {
  return db.travelProfile.findUnique({ where: { userId } });
}

/** Saves the travel profile and marks onboarding complete (first save only). */
export async function saveTravelProfile(userId: string, input: TravelProfileInput) {
  const { name, ...profile } = input;
  const existing = await db.user.findUnique({ where: { id: userId }, select: { onboardedAt: true } });
  if (!existing) throw new AppError("UNAUTHORIZED", "로그인이 필요해요.");

  const [, saved] = await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { name, onboardedAt: existing.onboardedAt ?? new Date() },
    }),
    db.travelProfile.upsert({
      where: { userId },
      create: { userId, ...profile },
      update: profile,
    }),
  ]);

  if (!existing.onboardedAt) {
    await track("complete_onboarding", {
      userId,
      properties: { styles: profile.styles.length, pace: profile.pace, companion: profile.companionType },
    });
  }
  return saved;
}

/** Permanently deletes the account; trips and personal data cascade (see schema). */
export async function deleteAccount(userId: string) {
  await db.user.delete({ where: { id: userId } });
}
