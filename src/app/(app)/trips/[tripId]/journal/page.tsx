import type { Metadata } from "next";
import { JournalClient } from "@/components/journal/journal-client";
import { requireOnboardedUser } from "@/server/auth/session";
import { getJournal } from "@/server/services/journal-service";
import { getTripForPage } from "@/server/services/trip-queries";

export const metadata: Metadata = { title: "여행 기록" };

export default async function JournalPage(props: PageProps<"/trips/[tripId]/journal">) {
  const { tripId } = await props.params;
  const user = await requireOnboardedUser();
  await getTripForPage(tripId, user.id);
  return <JournalClient tripId={tripId} initialData={await getJournal(tripId, user.id)} />;
}
