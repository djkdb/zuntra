import type { Metadata } from "next";
import { CompanionChat } from "@/components/companion/companion-chat";
import { TodayView } from "@/components/today/today-view";
import { getConversation } from "@/server/ai/trip-companion";
import { requireOnboardedUser } from "@/server/auth/session";
import { getTodayData } from "@/server/services/today-service";
import { tripPageData } from "@/server/services/trip-queries";

export const metadata: Metadata = { title: "AI 동행" };

export default async function CompanionPage(props: PageProps<"/trips/[tripId]/companion">) {
  const [{ tripId }, searchParams] = await Promise.all([props.params, props.searchParams]);
  const user = await requireOnboardedUser();
  const {
    trip,
    data: [conversation, today],
  } = await tripPageData(tripId, user.id, () => Promise.all([getConversation(tripId, user.id), getTodayData(tripId, user.id)]));

  const q = typeof searchParams.q === "string" ? searchParams.q.slice(0, 500) : undefined;
  const day = typeof searchParams.day === "string" ? searchParams.day : undefined;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        <h2 className="sr-only">AI 여행 동행과 대화</h2>
        <CompanionChat
          tripId={tripId}
          currency={trip.currency}
          initial={conversation}
          autoSend={q ? { message: q, focusDayId: day } : undefined}
        />
      </div>
      {today.todayDayId ? (
        <aside className="hidden lg:block">
          <div className="sticky top-6">
            <TodayView
              tripId={tripId}
              itinerary={today.itinerary}
              dayId={today.todayDayId}
              initialNowMinute={today.nowMinute}
              weather={today.todayWeather}
            />
          </div>
        </aside>
      ) : null}
    </div>
  );
}
