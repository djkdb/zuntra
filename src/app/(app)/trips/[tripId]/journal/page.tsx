import { BookHeartIcon } from "lucide-react";
import type { Metadata } from "next";
import { UpcomingFeature } from "@/components/states/upcoming-feature";

export const metadata: Metadata = { title: "기록" };

export default async function TripJournalPage(props: PageProps<"/trips/[tripId]/journal">) {
  // Access is enforced by the trip layout (404 for non-members).
  const { tripId } = await props.params;
  return (
    <UpcomingFeature
      icon={BookHeartIcon}
      tripId={tripId}
      title="여행 기록"
      description="사진, 메모, 감정, 별점을 남기면 여행이 끝난 뒤 AI가 여행 리포트로 정리해요."
      points={[
          "장소·날짜와 연결된 기록",
          "여행 종료 후 Travel Report",
          "가장 기억에 남은 장소와 음식",
      ]}
    />
  );
}
