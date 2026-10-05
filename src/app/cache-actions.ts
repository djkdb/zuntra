"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";

/**
 * Called after client-side (API) mutations. Revalidating from a server action also drops the
 * browser's prefetched copies of every page, so other tabs never show pre-change numbers.
 */
export async function refreshPages() {
  await requireUser();
  revalidatePath("/", "layout");
}
