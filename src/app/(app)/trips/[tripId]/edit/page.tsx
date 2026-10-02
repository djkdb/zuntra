import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TripForm } from "@/components/trips/trip-form";
import { requireOnboardedUser } from "@/server/auth/session";
import { getTripForPage } from "@/server/services/trip-queries";
import { updateTripAction } from "../../actions";

export const metadata: Metadata = { title: "여행 수정" };

export default async function EditTripPage(props: PageProps<"/trips/[tripId]/edit">) {
  const { tripId } = await props.params;
  const user = await requireOnboardedUser();
  const trip = await getTripForPage(tripId, user.id);
  if (trip.role === "VIEWER") redirect(`/trips/${trip.id}`);

  return (
    <div className="max-w-2xl space-y-8">
      <h2 className="text-xl font-semibold">여행 정보 수정</h2>
      <TripForm
        action={updateTripAction.bind(null, trip.id)}
        submitLabel="저장하기"
        pendingLabel="저장 중…"
        defaults={trip}
        footnote={
          <p className="hidden text-xs text-muted-foreground sm:block">
            기간을 줄이면 빠지는 날짜에 일정이 없을 때만 저장돼요.
          </p>
        }
      />
    </div>
  );
}
