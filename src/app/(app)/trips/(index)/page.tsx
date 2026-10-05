import { LuggageIcon, PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { FlashToast } from "@/components/states/flash-toast";
import { TripList } from "@/components/trips/trip-list";
import { Button } from "@/components/ui/button";
import { groupTripsByPhase } from "@/lib/trips";
import { requireOnboardedUser } from "@/server/auth/session";
import { listTripsForRequest } from "@/server/services/trip-queries";

export const metadata: Metadata = { title: "내 여행" };

export default async function TripsPage(props: PageProps<"/trips">) {
  const [user, searchParams] = await Promise.all([requireOnboardedUser(), props.searchParams]);
  const trips = await listTripsForRequest(user.id);
  const groups = groupTripsByPhase(trips);
  const sections = [
    { key: "ongoing", title: "여행 중", trips: groups.ongoing },
    { key: "upcoming", title: "다가오는 여행", trips: groups.upcoming },
    { key: "past", title: "지난 여행", trips: groups.past },
  ].filter((s) => s.trips.length > 0);

  return (
    <div className="space-y-10">
      {searchParams.deleted ? <FlashToast message="여행을 삭제했어요." /> : null}
      <PageHeader
        title="내 여행"
        description={trips.length > 0 ? `${trips.length}개의 여행` : undefined}
        actions={
          <Button asChild>
            <Link href="/trips/new">
              <PlusIcon data-icon="inline-start" aria-hidden />새 여행
            </Link>
          </Button>
        }
      />

      {sections.length === 0 ? (
        <EmptyState
          icon={LuggageIcon}
          title="첫 여행을 만들어보세요."
          description="여행지와 날짜만 정하면 나머지는 TripMate가 함께 준비해요."
          action={
            <Button asChild size="lg">
              <Link href="/trips/new">
                <PlusIcon data-icon="inline-start" aria-hidden />새 여행 만들기
              </Link>
            </Button>
          }
        />
      ) : (
        sections.map((section) => (
          <section key={section.key} aria-labelledby={`trips-${section.key}`} className="space-y-4">
            <h2 id={`trips-${section.key}`} className="text-lg font-semibold">
              {section.title} <span className="text-base font-normal text-muted-foreground">{section.trips.length}</span>
            </h2>
            <TripList trips={section.trips} />
          </section>
        ))
      )}
    </div>
  );
}
