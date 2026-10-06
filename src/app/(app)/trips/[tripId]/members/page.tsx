import type { Metadata } from "next";
import { MembersClient } from "@/components/members/members-client";
import { requireOnboardedUser } from "@/server/auth/session";
import { getMembers } from "@/server/services/member-service";
import { tripPageData } from "@/server/services/trip-queries";

export const metadata: Metadata = { title: "함께하는 사람" };

export default async function MembersPage(props: PageProps<"/trips/[tripId]/members">) {
  const { tripId } = await props.params;
  const user = await requireOnboardedUser();
  const { trip, data } = await tripPageData(tripId, user.id, () => getMembers(tripId, user.id));
  return <MembersClient tripId={tripId} initialData={data} travelerCount={trip.travelerCount} />;
}
