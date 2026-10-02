import { CalendarRangeIcon } from "lucide-react";
import type { Metadata } from "next";
import { UpcomingFeature } from "@/components/states/upcoming-feature";

export const metadata: Metadata = { title: "일정" };

export default async function TripPlanPage(props: PageProps<"/trips/[tripId]/plan">) {
  // Access is enforced by the trip layout (404 for non-members).
  const { tripId } = await props.params;
  return (
    <UpcomingFeature
      icon={CalendarRangeIcon}
      tripId={tripId}
      title="날짜별 일정"
      description="Day별 타임라인에서 장소를 추가하고 drag & drop으로 순서를 바꿀 수 있어요."
      points={[
          "장소·시간·체류시간·이동수단·비용·메모 관리",
          "drag & drop으로 일정 이동, 시간 변경",
          "AI로 일정 생성 및 \"AI로 일정 다시 맞추기\"",
      ]}
    />
  );
}
