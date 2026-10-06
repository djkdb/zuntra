import { ChevronLeftIcon, MapPinIcon, PencilIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { DeleteTripButton } from "@/components/trips/delete-trip-button";
import { ExportMenu } from "@/components/trips/export-menu";
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
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3 sm:items-center">
        <div className="min-w-0">
          <nav aria-label="경로" className="hidden items-center gap-1 text-sm text-muted-foreground sm:flex">
            <Link href="/trips" className="inline-flex items-center gap-0.5 hover:text-foreground">
              <ChevronLeftIcon className="size-4" aria-hidden />내 여행
            </Link>
          </nav>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:mt-1">
            <h1 className="text-xl leading-tight font-bold tracking-tight sm:text-2xl">{trip.title}</h1>
            <TripPhaseBadge phase={phaseOf(trip)} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:text-sm">
            <span className="inline-flex items-center gap-1">
              <MapPinIcon className="size-3.5" aria-hidden />
              {trip.destination}
            </span>
            <span>
              {formatDateRange(trip.startDate, trip.endDate)}, {formatTripLength(trip.startDate, trip.endDate)}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5 sm:gap-2">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href={`/trips/${trip.id}/members`} aria-label={trip.memberCount > 1 ? `일행 ${trip.memberCount}명, 초대하기` : "일행 초대하기"}>
              <UsersIcon data-icon="inline-start" aria-hidden />
              {trip.memberCount > 1 ? `일행 ${trip.memberCount}` : "초대"}
            </Link>
          </Button>
          <ExportMenu tripId={trip.id} />
        {canEdit ? (
          <>
            <Button asChild variant="outline" size="sm" className="max-sm:size-9 max-sm:px-0">
              <Link href={`/trips/${trip.id}/edit`} aria-label="여행 정보 수정">
                <PencilIcon data-icon="inline-start" aria-hidden />
                <span className="max-sm:sr-only">수정</span>
              </Link>
            </Button>
            {trip.role === "OWNER" ? <DeleteTripButton tripId={trip.id} title={trip.title} /> : null}
          </>
        ) : null}
        </div>
      </header>
      <TripTabs tripId={trip.id} completed={trip.status === "COMPLETED"} />
      <div>{props.children}</div>
    </div>
  );
}
