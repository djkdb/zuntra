import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

export type AnalyticsEventName =
  | "signup"
  | "complete_onboarding"
  | "create_trip"
  | "update_trip"
  | "delete_trip"
  | "generate_plan"
  | "edit_itinerary"
  | "ask_ai"
  | "ai_action_decided"
  | "ai_suggestion_clicked"
  | "complete_itinerary"
  | "add_expense"
  | "create_journal"
  | "complete_trip"
  | "create_invite"
  | "accept_invite";

type Primitive = string | number | boolean | null;

/**
 * Records a product event. Properties must be non-identifying primitives
 * (counts, enums, booleans) — never names, emails, destinations or free text.
 * Failures are swallowed: analytics must never break a user flow.
 */
export async function track(
  name: AnalyticsEventName,
  context: { userId?: string | null; tripId?: string | null; properties?: Record<string, Primitive> } = {},
): Promise<void> {
  try {
    await db.analyticsEvent.create({
      data: {
        name,
        userId: context.userId ?? null,
        tripId: context.tripId ?? null,
        properties: context.properties ?? Prisma.JsonNull,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.warn(`[analytics] failed to record ${name}`, error);
  }
}
