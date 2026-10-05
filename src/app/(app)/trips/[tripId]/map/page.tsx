import type { Metadata } from "next";
import { MapPageClient } from "@/components/map/map-page-client";
import { requireOnboardedUser } from "@/server/auth/session";
import { getItinerary } from "@/server/services/itinerary-service";
import { tripPageData } from "@/server/services/trip-queries";
import { ensureTripCenter } from "@/server/services/trip-service";

export const metadata: Metadata = { title: "지도" };

export default async function MapPage(props: PageProps<"/trips/[tripId]/map">) {
  const { tripId } = await props.params;
  const user = await requireOnboardedUser();
  const { data } = await tripPageData(tripId, user.id, async () => {
    // Access is checked by getItinerary; the centre lookup only needs the trip to exist.
    const itinerary = await getItinerary(tripId, user.id);
    if (itinerary.trip.center) return itinerary;
    await ensureTripCenter(tripId).catch(() => null);
    return getItinerary(tripId, user.id);
  });
  return <MapPageClient tripId={tripId} initialData={data} />;
}
