import { ChevronRightIcon, MapPinIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { formatDDay, formatDateRange, formatTripLength, todayInTimeZone } from "@/lib/dates";
import { phaseOf } from "@/lib/trips";
import type { TripSummary } from "@/server/services/trip-service";
import { TripPhaseBadge } from "./trip-phase-badge";

type TripListTrip = Pick<
  TripSummary,
  "id" | "title" | "destination" | "startDate" | "endDate" | "status" | "timezone" | "travelerCount"
>;

export function TripList({ trips, now }: { trips: TripListTrip[]; now?: Date }) {
  return (
    <ul className="divide-y overflow-hidden rounded-lg border bg-card">
      {trips.map((trip) => (
        <li key={trip.id}>
          <TripRow trip={trip} now={now} />
        </li>
      ))}
    </ul>
  );
}

function TripRow({ trip, now }: { trip: TripListTrip; now?: Date }) {
  const phase = phaseOf(trip, now);
  const today = todayInTimeZone(trip.timezone, now);
  const [, month, day] = trip.startDate.split("-");

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none sm:px-5"
    >
      <div
        aria-hidden
        className="flex size-12 shrink-0 flex-col items-center justify-center rounded-lg bg-muted text-foreground"
      >
        <span className="text-[11px] font-medium">{Number(month)}월</span>
        <span className="text-lg leading-none font-bold">{Number(day)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold">{trip.title}</p>
          {phase === "upcoming" ? (
            <span className="shrink-0 text-xs font-semibold text-sunset">{formatDDay(trip.startDate, today)}</span>
          ) : null}
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPinIcon className="size-3.5" aria-hidden />
            {trip.destination}
          </span>
          <span>
            {formatDateRange(trip.startDate, trip.endDate)} · {formatTripLength(trip.startDate, trip.endDate)}
          </span>
          <span className="inline-flex items-center gap-1">
            <UsersIcon className="size-3.5" aria-hidden />
            <span className="sr-only">인원</span>
            {trip.travelerCount}명
          </span>
        </p>
      </div>
      <TripPhaseBadge phase={phase} className="hidden sm:inline-flex" />
      <ChevronRightIcon
        className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}
