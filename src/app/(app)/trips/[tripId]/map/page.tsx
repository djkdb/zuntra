import type { Metadata } from "next";
import { MapPageClient } from "@/components/map/map-page-client";
import { requireOnboardedUser } from "@/server/auth/session";
import { getItinerary } from "@/server/services/itinerary-service";
import { getTripForPage } from "@/server/services/trip-queries";
import { ensureTripCenter } from "@/server/services/trip-service";

export const metadata: Metadata = { title: "지도" };

export default async function MapPage(props: PageProps<"/trips/[tripId]/map">) {
  const { tripId } = await props.params;
  const user = await requireOnboardedUser();
  await getTripForPage(tripId, user.id);
  await ensureTripCenter(tripId).catch(() => null);
  return <MapPageClient tripId={tripId} initialData={await getItinerary(tripId, user.id)} />;
}
