import type { Metadata } from "next";
import { PackingClient } from "@/components/packing/packing-client";
import { requireOnboardedUser } from "@/server/auth/session";
import { getPacking } from "@/server/services/packing-service";
import { tripPageData } from "@/server/services/trip-queries";

export const metadata: Metadata = { title: "준비물" };

export default async function PackingPage(props: PageProps<"/trips/[tripId]/packing">) {
  const { tripId } = await props.params;
  const user = await requireOnboardedUser();
  const { data } = await tripPageData(tripId, user.id, () => getPacking(tripId, user.id));
  return <PackingClient tripId={tripId} initialData={data} />;
}
