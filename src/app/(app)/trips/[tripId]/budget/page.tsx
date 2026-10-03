import type { Metadata } from "next";
import { BudgetPageClient } from "@/components/budget/budget-page-client";
import { requireOnboardedUser } from "@/server/auth/session";
import { getBudget } from "@/server/services/budget-service";
import { getTripForPage } from "@/server/services/trip-queries";

export const metadata: Metadata = { title: "경비" };

export default async function BudgetPage(props: PageProps<"/trips/[tripId]/budget">) {
  const { tripId } = await props.params;
  const user = await requireOnboardedUser();
  await getTripForPage(tripId, user.id);
  const data = await getBudget(tripId, user.id);
  return <BudgetPageClient tripId={tripId} initialData={data} />;
}
