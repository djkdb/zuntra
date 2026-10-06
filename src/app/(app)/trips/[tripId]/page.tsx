import { ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FlashToast } from "@/components/states/flash-toast";
import { TodayView } from "@/components/today/today-view";
import { RainBanner } from "@/components/weather/rain-banner";
import { WeatherStrip } from "@/components/weather/weather-strip";
import { Badge } from "@/components/ui/badge";
import { TIME_ZONES, TRAVEL_PACE_LABELS, TRAVEL_STYLE_LABELS } from "@/lib/constants";
import { diffDaysIso, formatDDay, formatShortDate, todayInTimeZone } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { phaseOf } from "@/lib/trips";
import { cn } from "@/lib/utils";
import { requireOnboardedUser } from "@/server/auth/session";
import { getTodayData } from "@/server/services/today-service";
import { getTripForPage, getTripProgress } from "@/server/services/trip-queries";
import { isDomesticTrip } from "@/lib/timezone-guess";
import { type NextStep, NextSteps } from "@/components/trips/next-steps";

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
  const [todayData, progress] = await Promise.all([getTodayData(tripId, user.id), getTripProgress(tripId)]);
  const phase = phaseOf(trip);
  const canEdit = trip.role !== "VIEWER";
  const today = todayInTimeZone(trip.timezone);
  const totalItems = trip.days.reduce((sum, d) => sum + d.itemCount, 0);
  const tzLabel = TIME_ZONES.find((z) => z.id === trip.timezone)?.label ?? trip.timezone;

  const base = `/trips/${trip.id}`;
  const emptyDays = trip.days.filter((d) => d.itemCount === 0).length;
  const abroad = !isDomesticTrip(trip.destination, trip.timezone);
  const stepStatus =
    phase === "upcoming" ? `출발까지 ${formatDDay(trip.startDate, today)}` : phase === "ongoing" ? `여행 ${diffDaysIso(trip.startDate, today) + 1}일차` : "여행이 끝났어요";
  const steps: NextStep[] =
    phase === "upcoming"
      ? [
          {
            label: "일정 채우기",
            hint: totalItems === 0 ? "AI가 여행 전체 일정을 한 번에 짜 드려요." : `아직 비어 있는 날이 ${emptyDays}일 있어요.`,
            href: `${base}/plan`,
            done: totalItems > 0 && emptyDays === 0,
          },
          {
            label: "예산 정하기",
            hint: "항공·숙소를 빼고 현지에서 쓸 돈을 정해 두면 사용률을 알려 드려요.",
            href: `${base}/budget`,
            done: trip.budgetAmount !== null,
          },
          {
            label: abroad ? "준비물 챙기기 (여권 포함)" : "준비물 챙기기",
            hint:
              progress.packingTotal === 0
                ? "여행지와 날씨에 맞춰 AI가 체크리스트를 만들어 드려요."
                : `${progress.packingTotal}개 중 ${progress.packingPacked}개 챙겼어요.`,
            href: `${base}/packing`,
            done: progress.packingTotal > 0 && progress.packingPacked === progress.packingTotal,
          },
          ...(abroad
            ? [{ label: "현지에서 물어볼 것 정리", hint: "공항에서 시내 가는 법, 환전, 교통패스를 AI에게 물어보세요.", href: `${base}/companion`, done: false }]
            : []),
        ]
      : phase === "ongoing"
        ? [
            { label: "오늘 일정 확인", hint: "다음 장소와 이동시간을 확인해요.", href: `${base}/plan`, done: false },
            { label: "쓴 돈 기록", hint: progress.expenseCount === 0 ? "아직 기록한 지출이 없어요." : `지출 ${progress.expenseCount}건을 기록했어요.`, href: `${base}/budget`, done: progress.expenseCount > 0 },
            { label: "오늘의 기록 남기기", hint: "사진과 한 줄 메모로 남겨 두면 리포트에 담겨요.", href: `${base}/journal`, done: false },
          ]
        : [
            { label: "여행 기록 정리", hint: `기록 ${progress.journalCount}개가 있어요.`, href: `${base}/journal`, done: progress.journalCount > 0 },
            { label: "여행 리포트 보기", hint: "장소·지출·기록을 모은 회고를 만들어요.", href: trip.status === "COMPLETED" ? `${base}/report` : `${base}/journal`, done: trip.status === "COMPLETED" },
          ];
  const stepTitle = phase === "upcoming" ? "출발 전에 할 일" : phase === "ongoing" ? "오늘 할 일" : "여행 마무리";

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
      {searchParams.joined ? <FlashToast message="여행에 참여했어요. 함께 준비해요!" /> : null}

      <div className="min-w-0 space-y-6">
        {/* On phones the guide leads the page (the side column sits far below); mid-trip, today's plan comes first. */}
        {phase !== "ongoing" ? <NextSteps id="next-step-top" status={stepStatus} title={stepTitle} steps={steps} className="lg:hidden" /> : null}
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

        {todayData.weather ? <WeatherStrip days={todayData.weather.days} stale={todayData.weather.stale} today={today} /> : null}
      </div>

      <aside aria-labelledby="trip-info" className="space-y-5">
        <NextSteps status={stepStatus} title={stepTitle} steps={steps} className={phase !== "ongoing" ? "hidden lg:block" : undefined} />
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
