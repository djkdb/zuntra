import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { TripForm } from "@/components/trips/trip-form";
import { requireOnboardedUser } from "@/server/auth/session";
import { getTravelProfile } from "@/server/services/user-service";
import { createTripAction } from "../actions";

export const metadata: Metadata = { title: "새 여행 만들기" };

export default async function NewTripPage() {
  const user = await requireOnboardedUser();
  const profile = await getTravelProfile(user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <PageHeader
        eyebrow="새 여행"
        title="어떤 여행을 준비할까요?"
        description="기본 정보만 있으면 충분해요. 일정은 다음 단계에서 AI와 함께 만들어요."
      />
      <TripForm
        action={createTripAction}
        submitLabel="여행 만들기"
        pendingLabel="여행 만드는 중…"
        defaults={{
          styles: profile?.styles,
          pace: profile?.pace,
          preferredFoods: profile?.favoriteFoods,
          travelerCount: 1,
          currency: "KRW",
        }}
      />
    </div>
  );
}
