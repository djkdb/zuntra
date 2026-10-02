import { MapIcon } from "lucide-react";
import type { Metadata } from "next";
import { UpcomingFeature } from "@/components/states/upcoming-feature";

export const metadata: Metadata = { title: "지도" };

export default async function TripMapPage(props: PageProps<"/trips/[tripId]/map">) {
  // Access is enforced by the trip layout (404 for non-members).
  const { tripId } = await props.params;
  return (
    <UpcomingFeature
      icon={MapIcon}
      tripId={tripId}
      title="여행 지도"
      description="일정 장소, 숙소, 현재 위치를 Day별로 한눈에 볼 수 있어요."
      points={[
          "Day별 필터와 장소 상세",
          "다음 장소까지 이동시간 표시",
          "현재 위치 기반 안내",
      ]}
    />
  );
}
