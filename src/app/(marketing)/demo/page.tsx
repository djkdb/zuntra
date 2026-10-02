import { CloudIcon, CloudRainIcon, InfoIcon, MapPinIcon, SunIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DayTimeline } from "@/components/itinerary/day-timeline";
import { Button } from "@/components/ui/button";
import { formatDateRange, formatShortDate, formatTripLength } from "@/lib/dates";
import { DEMO_TRIP } from "@/lib/demo/tokyo";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = {
  title: "데모 여행 · Tokyo 5 Days",
  description: "가입 없이 TripMate의 도쿄 5일 샘플 여행을 둘러보세요.",
  alternates: { canonical: "/demo" },
};

const WEATHER_ICON = { sunny: SunIcon, cloudy: CloudIcon, rain: CloudRainIcon } as const;
const WEATHER_LABEL = { sunny: "맑음", cloudy: "흐림", rain: "비" } as const;

export default function DemoPage() {
  const trip = DEMO_TRIP;
  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
      <div role="note" className="flex items-start gap-3 rounded-2xl bg-accent px-4 py-3 text-sm text-accent-foreground">
        <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          데모 모드예요. 샘플 여행이라 실제 계정과 연결되지 않고 저장되지 않아요.{" "}
          <Link href="/signup" className="font-semibold underline underline-offset-4">
            내 여행 만들기
          </Link>
        </p>
      </div>

      <header className="mt-8">
        <p className="text-sm font-medium text-primary">샘플 여행</p>
        <h1 className="mt-1 text-4xl font-bold">{trip.title}</h1>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPinIcon className="size-4" aria-hidden />
            {trip.destination}
          </span>
          <span>
            {formatDateRange(trip.startDate, trip.endDate)} · {formatTripLength(trip.startDate, trip.endDate)}
          </span>
          <span className="inline-flex items-center gap-1">
            <UsersIcon className="size-4" aria-hidden />
            {trip.travelerCount}명
          </span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          예산 {formatMoney(trip.budgetAmount, trip.currency)} · 사용 {formatMoney(trip.spentAmount, trip.currency)}
        </p>
      </header>

      <nav aria-label="날짜로 이동" className="mt-8 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {trip.days.map((d) => (
          <a
            key={d.dayNumber}
            href={`#day-${d.dayNumber}`}
            className="shrink-0 rounded-full border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            DAY {d.dayNumber}
          </a>
        ))}
      </nav>

      <div className="mt-8 space-y-12">
        {trip.days.map((day) => {
          const Icon = WEATHER_ICON[day.weather.condition];
          return (
            <section key={day.dayNumber} id={`day-${day.dayNumber}`} aria-labelledby={`day-${day.dayNumber}-title`} className="scroll-mt-24">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-wider text-primary">DAY {day.dayNumber}</p>
                  <h2 id={`day-${day.dayNumber}-title`} className="text-xl font-semibold">
                    {formatShortDate(day.date)} · {day.title}
                  </h2>
                </div>
                <p className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
                  <Icon className="size-4" aria-hidden />
                  <span>
                    {WEATHER_LABEL[day.weather.condition]} {day.weather.tempMax}° / {day.weather.tempMin}°
                    {day.weather.precipitation >= 50 ? ` · 강수 ${day.weather.precipitation}%` : ""}
                  </span>
                </p>
              </div>
              <DayTimeline items={day.items} />
            </section>
          );
        })}
      </div>

      <div className="mt-16 rounded-3xl border bg-card p-8 text-center">
        <h2 className="text-2xl font-bold">내 여행도 이렇게 만들어 볼까요?</h2>
        <p className="mt-2 text-muted-foreground">여행지와 날짜만 있으면 시작할 수 있어요.</p>
        <Button asChild size="lg" className="mt-6">
          <Link href="/signup">여행 시작하기</Link>
        </Button>
      </div>
    </div>
  );
}
