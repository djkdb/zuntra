import type { Metadata } from "next";
import { PackingClient } from "@/components/packing/packing-client";
import { requireOnboardedUser } from "@/server/auth/session";
import { getPacking } from "@/server/services/packing-service";
import { getTripForPage } from "@/server/services/trip-queries";

export const metadata: Metadata = { title: "준비물" };

export default async function PackingPage(props: PageProps<"/trips/[tripId]/packing">) {
  const { tripId } = await props.params;
  const user = await requireOnboardedUser();
  await getTripForPage(tripId, user.id);
  return <PackingClient tripId={tripId} initialData={await getPacking(tripId, user.id)} />;
}
