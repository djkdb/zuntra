import { redirect } from "next/navigation";
import { signOut } from "@/server/auth";
import { getCurrentUser } from "@/server/auth/session";

/**
 * Clears a session cookie whose user no longer exists (e.g. the account was deleted
 * in another tab). Without this, proxy.ts would bounce between /login and /dashboard.
 */
export async function GET() {
  // Only clears sessions whose user is gone — a cross-site link cannot log a valid user out.
  if (await getCurrentUser()) redirect("/dashboard");
  await signOut({ redirectTo: "/login?reason=session" });
}
