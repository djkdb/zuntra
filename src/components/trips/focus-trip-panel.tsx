import { CalendarRangeIcon, MapPinIcon, PackageCheckIcon, SparklesIcon, WalletIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { diffDaysIso, formatDDay, formatDateRange, formatShortDate, formatTripLength, todayInTimeZone } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { phaseOf } from "@/lib/trips";
import type { TripSummary } from "@/server/services/trip-service";

/** The hero block on the dashboard: what matters about the trip the user is in or about to start. */
export function FocusTripPanel({ trip }: { trip: TripSummary }) {
  const phase = phaseOf(trip);
  const today = todayInTimeZone(trip.timezone);
  const totalDays = diffDaysIso(trip.startDate, trip.endDate) + 1;
  const dayIndex = diffDaysIso(trip.startDate, today) + 1;

  const stubLabel = phase === "ongoing" ? "여행 중" : "출발까지";
  const stubValue = phase === "ongoing" ? `${dayIndex}일차` : formatDDay(trip.startDate, today);

  // Shaped like a boarding pass: trip details on the left, the countdown on a torn-off stub.
  return (
    <section
      aria-labelledby="focus-trip-title"
      className="grid overflow-hidden rounded-xl border bg-card md:grid-cols-[minmax(0,1fr)_13rem]"
    >
      <div className="p-5 sm:p-6">
        <p className="text-sm text-muted-foreground">{phase === "ongoing" ? "지금 여행 중이에요" : "다가오는 여행"}</p>
        <h2 id="focus-trip-title" className="mt-1 text-2xl font-bold tracking-tight">
          <Link href={`/trips/${trip.id}`} className="underline-offset-4 hover:underline">
            {trip.title}
          </Link>
        </h2>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPinIcon className="size-3.5" aria-hidden />
            {trip.destination}
          </span>
          <span>
            {formatDateRange(trip.startDate, trip.endDate)}, {formatTripLength(trip.startDate, trip.endDate)}
          </span>
        </p>

        <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3 text-sm">
          <div>
            <dt className="text-muted-foreground">일정</dt>
            <dd className="mt-0.5 font-semibold">{trip.dayCount}일</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">인원</dt>
            <dd className="mt-0.5 font-semibold">{trip.travelerCount}명</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">예산</dt>
            <dd className="mt-0.5 font-semibold">
              {trip.budgetAmount !== null ? formatMoney(trip.budgetAmount, trip.currency) : "미정"}
            </dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/trips/${trip.id}/plan`}>
              <CalendarRangeIcon data-icon="inline-start" aria-hidden />
              일정 보기
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/trips/${trip.id}/companion`}>
              <SparklesIcon data-icon="inline-start" aria-hidden />
              AI에게 물어보기
            </Link>
          </Button>
        </div>
      </div>

      <div className="relative flex flex-col justify-center border-t border-dashed p-5 sm:p-6 md:border-t-0 md:border-l">
        {/* Punched notches where the stub tears off. */}
        <span aria-hidden className="absolute -top-2.5 -left-2.5 hidden size-5 rounded-full border bg-background md:block" />
        <span aria-hidden className="absolute -bottom-2.5 -left-2.5 hidden size-5 rounded-full border bg-background md:block" />
        <p className="text-sm text-muted-foreground">{stubLabel}</p>
        <p className="mt-1 text-4xl leading-none font-bold tracking-tight tabular-nums">{stubValue}</p>
        <span aria-hidden className="mt-3 h-1 w-10 rounded-full bg-sunset" />
        <p className="mt-3 text-xs text-muted-foreground">
          {phase === "ongoing" ? `전체 ${totalDays}일 중` : `${formatShortDate(trip.startDate)} 출발`}
        </p>
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
    <ul className="grid grid-cols-3 gap-2 lg:hidden">
      {links.map((l) => (
        <li key={l.href}>
          <Link
            href={l.href}
            className="flex items-center justify-center gap-2 rounded-lg border bg-card py-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <l.icon className="size-4 text-muted-foreground" aria-hidden />
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
