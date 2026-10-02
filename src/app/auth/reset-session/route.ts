import { signOut } from "@/server/auth";

/**
 * Clears a session cookie whose user no longer exists (e.g. the account was deleted
 * in another tab). Without this, proxy.ts would bounce between /login and /dashboard.
 */
export async function GET() {
  await signOut({ redirectTo: "/login?reason=session" });
}
