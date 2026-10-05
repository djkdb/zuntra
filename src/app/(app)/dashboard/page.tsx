import { ArrowRightIcon, PlaneTakeoffIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { TodayView } from "@/components/today/today-view";
import { FocusTripPanel, QuickLinks } from "@/components/trips/focus-trip-panel";
import { RainBanner } from "@/components/weather/rain-banner";
import { TripList } from "@/components/trips/trip-list";
import { Button } from "@/components/ui/button";
import { groupTripsByPhase, phaseOf, pickFocusTrip } from "@/lib/trips";
import { requireOnboardedUser } from "@/server/auth/session";
import { getTodayData } from "@/server/services/today-service";
import { listTripsForRequest } from "@/server/services/trip-queries";

export const metadata: Metadata = { title: "대시보드" };

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const [user, searchParams] = await Promise.all([requireOnboardedUser(), props.searchParams]);
  const trips = await listTripsForRequest(user.id);
  const focus = pickFocusTrip(trips);
  const groups = groupTripsByPhase(trips);
  const others = [...groups.ongoing, ...groups.upcoming].filter((t) => t.id !== focus?.id).slice(0, 4);
  const firstName = user.name?.trim() || "여행자";
  // During a trip the app opens on TODAY.
  const today = focus ? await getTodayData(focus.id, user.id) : null;
  const ongoing = focus && phaseOf(focus) === "ongoing" && today?.todayDayId;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={searchParams.welcome ? "환영해요!" : undefined}
        title={`안녕하세요, ${firstName}님`}
        description={ongoing ? "오늘도 좋은 여행 되세요." : focus ? "다음 여행을 함께 준비해요." : "어디로 떠나볼까요?"}
        actions={
          trips.length > 0 ? (
            <Button asChild variant="outline" className="hidden sm:inline-flex lg:hidden">
              <Link href="/trips/new">
                <PlusIcon data-icon="inline-start" aria-hidden />새 여행
              </Link>
            </Button>
          ) : null
        }
      />

      {focus ? (
        <div className="space-y-4">
          {ongoing && today?.todayDayId ? (
            <TodayView
              tripId={focus.id}
              itinerary={today.itinerary}
              dayId={today.todayDayId}
              initialNowMinute={today.nowMinute}
              weather={today.todayWeather}
            />
          ) : (
            <FocusTripPanel trip={focus} />
          )}
          {today?.weather?.suggestions.slice(0, 1).map((s) => (
            <RainBanner key={s.dayId} tripId={focus.id} suggestion={s} canEdit={focus.role !== "VIEWER"} />
          ))}
          <QuickLinks tripId={focus.id} />
        </div>
      ) : (
        <EmptyState
          icon={PlaneTakeoffIcon}
          title="첫 여행을 만들어보세요."
          description={
            trips.length > 0
              ? "다가오는 여행이 없어요. 새로운 여행을 계획해 볼까요?"
              : "여행지와 날짜만 정하면 AI가 일정과 준비를 함께 도와드려요."
          }
          action={
            <Button asChild size="lg">
              <Link href="/trips/new">
                <PlusIcon data-icon="inline-start" aria-hidden />새 여행 만들기
              </Link>
            </Button>
          }
        />
      )}

      {others.length > 0 ? (
        <section aria-labelledby="other-trips" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 id="other-trips" className="text-lg font-semibold">
              예정된 여행
            </h2>
            <Link href="/trips" className="inline-flex items-center gap-1 text-sm font-medium text-primary">
              전체 보기 <ArrowRightIcon className="size-4" aria-hidden />
            </Link>
          </div>
          <TripList trips={others} />
        </section>
      ) : null}

      {groups.past.length > 0 ? (
        <section aria-labelledby="past-trips" className="space-y-4">
          <h2 id="past-trips" className="text-lg font-semibold">
            지난 여행
          </h2>
          <TripList trips={groups.past.slice(0, 3)} />
        </section>
      ) : null}
    </div>
  );
}
