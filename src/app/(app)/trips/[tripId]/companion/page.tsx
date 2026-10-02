import { SparklesIcon } from "lucide-react";
import type { Metadata } from "next";
import { UpcomingFeature } from "@/components/states/upcoming-feature";

export const metadata: Metadata = { title: "AI 동행" };

export default async function TripCompanionPage(props: PageProps<"/trips/[tripId]/companion">) {
  // Access is enforced by the trip layout (404 for non-members).
  const { tripId } = await props.params;
  return (
    <UpcomingFeature
      icon={SparklesIcon}
      tripId={tripId}
      title="AI 여행 동행"
      description="현재 시간, 위치, 날씨, 남은 일정을 이해하고 지금 무엇을 하면 좋을지 알려줘요."
      points={[
          "\"지금 너무 피곤해\" → 남은 일정 조정 제안",
          "비·지연·휴무 시 대체 일정 제안",
          "제안은 승인 후에만 일정에 반영",
      ]}
    />
  );
}
