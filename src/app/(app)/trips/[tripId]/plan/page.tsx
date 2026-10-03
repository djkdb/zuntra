import type { Metadata } from "next";
import { PlanEditor } from "@/components/plan/plan-editor";
import { requireOnboardedUser } from "@/server/auth/session";
import { getItinerary } from "@/server/services/itinerary-service";
import { getTripForPage } from "@/server/services/trip-queries";

export const metadata: Metadata = { title: "일정" };

export default async function TripPlanPage(props: PageProps<"/trips/[tripId]/plan">) {
  const [{ tripId }, searchParams] = await Promise.all([props.params, props.searchParams]);
  const dayNumber = Number(searchParams.day) || undefined;
  const user = await requireOnboardedUser();
  // Resolves to the 404 page for non-members before anything else is loaded.
  await getTripForPage(tripId, user.id);
  const itinerary = await getItinerary(tripId, user.id);
  return <PlanEditor tripId={tripId} initialData={itinerary} initialDayNumber={dayNumber} />;
}
