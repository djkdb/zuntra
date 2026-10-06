import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/server/db";
import { auth } from "./index";

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/**
 * Resolves the session to a live user row (once per request).
 * A valid JWT for a deleted account resolves to null.
 */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return db.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, image: true, role: true, onboardedAt: true },
  });
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const session = await auth();
    // A JWT without a matching user must be cleared, or proxy.ts keeps treating it as signed in.
    redirect(session?.user ? "/auth/reset-session" : "/login");
  }
  return user;
}

export async function requireOnboardedUser(next?: string): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.onboardedAt) redirect(next ? `/onboarding?next=${encodeURIComponent(next)}` : "/onboarding");
  return user;
}

/** Admin-only pages and APIs. Non-admins get the 404 page so the area is not discoverable. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return user;
}
