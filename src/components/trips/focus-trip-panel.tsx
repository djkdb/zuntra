import { CalendarRangeIcon, MapPinIcon, PackageCheckIcon, SparklesIcon, WalletIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { diffDaysIso, formatDDay, formatDateRange, formatTripLength, todayInTimeZone } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { phaseOf } from "@/lib/trips";
import type { TripSummary } from "@/server/services/trip-service";

/** The hero block on the dashboard: what matters about the trip the user is in or about to start. */
export function FocusTripPanel({ trip }: { trip: TripSummary }) {
  const phase = phaseOf(trip);
  const today = todayInTimeZone(trip.timezone);
  const totalDays = diffDaysIso(trip.startDate, trip.endDate) + 1;
  const dayIndex = diffDaysIso(trip.startDate, today) + 1;

  return (
    <section
      aria-labelledby="focus-trip-title"
      className="relative overflow-hidden rounded-3xl bg-primary px-6 py-7 text-primary-foreground sm:px-8 sm:py-9"
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-35 [background:radial-gradient(40rem_20rem_at_110%_-20%,var(--sunset),transparent_60%)]"
      />
      <div className="relative">
        <p className="text-sm font-medium text-primary-foreground/80">
          {phase === "ongoing" ? `여행 중 · Day ${dayIndex} / ${totalDays}` : `다가오는 여행 · ${formatDDay(trip.startDate, today)}`}
        </p>
        <h2 id="focus-trip-title" className="mt-2 text-3xl font-bold sm:text-4xl">
          <Link href={`/trips/${trip.id}`} className="underline-offset-4 hover:underline">
            {trip.title}
          </Link>
        </h2>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-primary-foreground/80">
          <span className="inline-flex items-center gap-1.5">
            <MapPinIcon className="size-4" aria-hidden />
            {trip.destination}
          </span>
          <span>
            {formatDateRange(trip.startDate, trip.endDate)} · {formatTripLength(trip.startDate, trip.endDate)}
          </span>
        </p>

        <dl className="mt-7 grid max-w-lg grid-cols-3 gap-4 border-t border-primary-foreground/15 pt-5 text-sm">
          <div>
            <dt className="text-primary-foreground/70">일정</dt>
            <dd className="mt-1 text-lg font-semibold">{trip.dayCount}일</dd>
          </div>
          <div>
            <dt className="text-primary-foreground/70">인원</dt>
            <dd className="mt-1 text-lg font-semibold">{trip.travelerCount}명</dd>
          </div>
          <div>
            <dt className="text-primary-foreground/70">예산</dt>
            <dd className="mt-1 truncate text-lg font-semibold">
              {trip.budgetAmount !== null ? formatMoney(trip.budgetAmount, trip.currency) : "미정"}
            </dd>
          </div>
        </dl>

        <div className="mt-7 flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="lg">
            <Link href={`/trips/${trip.id}/plan`}>
              <CalendarRangeIcon data-icon="inline-start" aria-hidden />
              일정 보기
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            className="bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
          >
            <Link href={`/trips/${trip.id}/companion`}>
              <SparklesIcon data-icon="inline-start" aria-hidden />
              AI에게 물어보기
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function QuickLinks({ tripId }: { tripId: string }) {
  const links = [
    { href: `/trips/${tripId}/budget`, label: "경비", icon: WalletIcon },
    { href: `/trips/${tripId}/packing`, label: "준비물", icon: PackageCheckIcon },
    { href: `/trips/${tripId}/map`, label: "지도", icon: MapPinIcon },
  ];
  return (
    <ul className="grid grid-cols-3 gap-2">
      {links.map((l) => (
        <li key={l.href}>
          <Link
            href={l.href}
            className="flex flex-col items-center gap-2 rounded-2xl border bg-card py-4 text-sm font-medium transition-colors hover:bg-muted"
          >
            <l.icon className="size-5 text-primary" aria-hidden />
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
