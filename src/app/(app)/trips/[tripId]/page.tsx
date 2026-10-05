import { CalendarPlusIcon, ChevronRightIcon, SparklesIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FlashToast } from "@/components/states/flash-toast";
import { TodayView } from "@/components/today/today-view";
import { RainBanner } from "@/components/weather/rain-banner";
import { WeatherStrip } from "@/components/weather/weather-strip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TIME_ZONES, TRAVEL_PACE_LABELS, TRAVEL_STYLE_LABELS } from "@/lib/constants";
import { diffDaysIso, formatDDay, formatShortDate, todayInTimeZone } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { phaseOf } from "@/lib/trips";
import { cn } from "@/lib/utils";
import { requireOnboardedUser } from "@/server/auth/session";
import { getTodayData } from "@/server/services/today-service";
import { getTripForPage } from "@/server/services/trip-queries";

export async function generateMetadata(props: PageProps<"/trips/[tripId]">): Promise<Metadata> {
  const { tripId } = await props.params;
  const user = await requireOnboardedUser();
  const trip = await getTripForPage(tripId, user.id);
  return { title: trip.title };
}

export default async function TripOverviewPage(props: PageProps<"/trips/[tripId]">) {
  const [{ tripId }, searchParams] = await Promise.all([props.params, props.searchParams]);
  const user = await requireOnboardedUser();
  const trip = await getTripForPage(tripId, user.id);
  const todayData = await getTodayData(tripId, user.id);
  const phase = phaseOf(trip);
  const canEdit = trip.role !== "VIEWER";
  const today = todayInTimeZone(trip.timezone);
  const totalItems = trip.days.reduce((sum, d) => sum + d.itemCount, 0);
  const tzLabel = TIME_ZONES.find((z) => z.id === trip.timezone)?.label ?? trip.timezone;

  const details: Array<[string, React.ReactNode]> = [
    ["인원", `${trip.travelerCount}명`],
    ["현지 시간대", tzLabel],
    ["예산", trip.budgetAmount !== null ? formatMoney(trip.budgetAmount, trip.currency) : "미정"],
    ["여행 속도", trip.pace ? TRAVEL_PACE_LABELS[trip.pace].label : "프로필 기준"],
  ];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-8">
      {searchParams.created ? <FlashToast message="여행을 만들었어요!" /> : null}
      {searchParams.updated ? <FlashToast message="여행 정보를 저장했어요." /> : null}

      <div className="min-w-0 space-y-6">
        {phase === "ongoing" && todayData.todayDayId ? (
          <TodayView
            tripId={trip.id}
            itinerary={todayData.itinerary}
            dayId={todayData.todayDayId}
            initialNowMinute={todayData.nowMinute}
            weather={todayData.todayWeather}
          />
        ) : null}
        {todayData.weather?.suggestions.slice(0, 2).map((s) => (
          <RainBanner key={s.dayId} tripId={trip.id} suggestion={s} canEdit={canEdit} />
        ))}

        <section aria-labelledby="days-title" className="space-y-3">
          <h2 id="days-title" className="text-base font-semibold">
            날짜별 일정 <span className="text-sm font-normal text-muted-foreground">{trip.days.length}일</span>
          </h2>
          <ol className="divide-y overflow-hidden rounded-lg border bg-card">
            {trip.days.map((day) => {
              const isToday = day.date === today;
              return (
                <li key={day.id}>
                  <Link
                    href={`/trips/${trip.id}/plan?day=${day.dayNumber}`}
                    className="flex items-center gap-4 px-4 py-2.5 transition-colors hover:bg-muted/60"
                  >
                    <span
                      className={cn(
                        "flex h-7 min-w-14 items-center justify-center rounded-md bg-muted px-2 text-xs font-semibold text-muted-foreground",
                        isToday && "bg-sunset text-[oklch(0.25_0.05_70)]",
                      )}
                    >
                      DAY {day.dayNumber}
                    </span>
                    <span className="flex-1">
                      <span className="font-medium">{formatShortDate(day.date)}</span>
                      {isToday ? <span className="ml-2 text-xs font-semibold">오늘</span> : null}
                      {day.title ? <span className="block text-sm text-muted-foreground">{day.title}</span> : null}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {day.itemCount > 0 ? `일정 ${day.itemCount}개` : "비어 있음"}
                    </span>
                    <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>

        {todayData.weather ? <WeatherStrip days={todayData.weather.days} stale={todayData.weather.stale} /> : null}
      </div>

      <aside aria-labelledby="trip-info" className="space-y-5">
        <section aria-labelledby="next-step" className="rounded-lg border bg-card p-4">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 rounded-full bg-sunset" aria-hidden />
          {phase === "upcoming"
            ? `출발까지 ${formatDDay(trip.startDate, today)}`
            : phase === "ongoing"
              ? `여행 ${diffDaysIso(trip.startDate, today) + 1}일차`
              : "여행이 끝났어요"}
        </p>
        <h2 id="next-step" className="mt-1.5 font-semibold">
          {totalItems === 0 ? "이제 일정을 채워볼까요?" : `${totalItems}개의 일정이 준비되어 있어요.`}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          날짜별로 가고 싶은 곳을 추가하거나, AI에게 취향에 맞는 일정을 부탁할 수 있어요.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={`/trips/${trip.id}/plan`}>
              <CalendarPlusIcon data-icon="inline-start" aria-hidden />
              일정 만들기
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/trips/${trip.id}/companion`}>
              <SparklesIcon data-icon="inline-start" aria-hidden />
              AI 동행
            </Link>
          </Button>
        </div>
      </section>
        <h2 id="trip-info" className="text-base font-semibold">
          여행 정보
        </h2>
        <dl className="divide-y rounded-lg border bg-card text-sm">
          {details.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 px-4 py-3">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        {trip.styles.length > 0 ? (
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">여행 스타일</h3>
            <ul className="flex flex-wrap gap-1.5">
              {trip.styles.map((s) => (
                <li key={s}>
                  <Badge variant="secondary" className="h-7 rounded-full px-3 text-sm">
                    {TRAVEL_STYLE_LABELS[s]}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <TagSection title="가고 싶은 곳" items={trip.preferredPlaces} />
        <TagSection title="먹고 싶은 음식" items={trip.preferredFoods} />
        {trip.purpose ? <TextSection title="여행 목적" text={trip.purpose} /> : null}
        {trip.notes ? <TextSection title="메모" text={trip.notes} /> : null}
      </aside>
    </div>
  );
}

function TagSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">{title}</h3>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li key={item}>
            <Badge variant="outline" className="h-7 rounded-full px-3 text-sm">
              {item}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TextSection({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="mb-1.5 text-sm font-medium text-muted-foreground">{title}</h3>
      {/* Rendered as text (React escapes it) and whitespace-preserved; never as HTML. */}
      <p className="text-sm whitespace-pre-line">{text}</p>
    </div>
  );
}
