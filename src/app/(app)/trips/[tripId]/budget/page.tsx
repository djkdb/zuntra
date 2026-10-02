import { WalletIcon } from "lucide-react";
import type { Metadata } from "next";
import { UpcomingFeature } from "@/components/states/upcoming-feature";

export const metadata: Metadata = { title: "경비" };

export default async function TripBudgetPage(props: PageProps<"/trips/[tripId]/budget">) {
  // Access is enforced by the trip layout (404 for non-members).
  const { tripId } = await props.params;
  return (
    <UpcomingFeature
      icon={WalletIcon}
      tripId={tripId}
      title="여행 경비"
      description="지출을 기록하면 예산 대비 사용 현황과 카테고리별 분석을 보여줘요."
      points={[
          "숙박·교통·식비·관광·쇼핑·기타",
          "예산 사용률과 1인당 비용",
          "AI 지출 분석",
      ]}
    />
  );
}
