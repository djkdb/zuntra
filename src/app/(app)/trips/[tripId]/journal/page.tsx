import type { Metadata } from "next";
import { JournalClient } from "@/components/journal/journal-client";
import { requireOnboardedUser } from "@/server/auth/session";
import { getJournal } from "@/server/services/journal-service";
import { tripPageData } from "@/server/services/trip-queries";

export const metadata: Metadata = { title: "여행 기록" };

export default async function JournalPage(props: PageProps<"/trips/[tripId]/journal">) {
  const { tripId } = await props.params;
  const user = await requireOnboardedUser();
  const { data } = await tripPageData(tripId, user.id, () => getJournal(tripId, user.id));
  return <JournalClient tripId={tripId} initialData={data} />;
}
