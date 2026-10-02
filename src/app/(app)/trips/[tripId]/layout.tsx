import { ChevronLeftIcon, MapPinIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { DeleteTripButton } from "@/components/trips/delete-trip-button";
import { TripPhaseBadge } from "@/components/trips/trip-phase-badge";
import { TripTabs } from "@/components/trips/trip-tabs";
import { Button } from "@/components/ui/button";
import { formatDateRange, formatTripLength } from "@/lib/dates";
import { phaseOf } from "@/lib/trips";
import { requireOnboardedUser } from "@/server/auth/session";
import { getTripForPage } from "@/server/services/trip-queries";

export default async function TripLayout(props: LayoutProps<"/trips/[tripId]">) {
  const { tripId } = await props.params;
  const user = await requireOnboardedUser();
  const trip = await getTripForPage(tripId, user.id);
  const canEdit = trip.role === "OWNER" || trip.role === "EDITOR";

  return (
    <div className="space-y-6">
      <Link
        href="/trips"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" aria-hidden />내 여행
      </Link>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <TripPhaseBadge phase={phaseOf(trip)} />
          <h1 className="mt-3 text-[1.75rem] leading-tight font-bold sm:text-4xl">{trip.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPinIcon className="size-4" aria-hidden />
              {trip.destination}
            </span>
            <span>
              {formatDateRange(trip.startDate, trip.endDate)} · {formatTripLength(trip.startDate, trip.endDate)}
            </span>
          </p>
        </div>
        {canEdit ? (
          <div className="flex shrink-0 gap-2">
            <Button asChild variant="outline">
              <Link href={`/trips/${trip.id}/edit`}>
                <PencilIcon data-icon="inline-start" aria-hidden />
                수정
              </Link>
            </Button>
            {trip.role === "OWNER" ? <DeleteTripButton tripId={trip.id} title={trip.title} /> : null}
          </div>
        ) : null}
      </header>
      <TripTabs tripId={trip.id} />
      <div className="pt-2">{props.children}</div>
    </div>
  );
}
