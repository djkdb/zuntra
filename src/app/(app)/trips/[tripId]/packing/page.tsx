import { PackageCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import { UpcomingFeature } from "@/components/states/upcoming-feature";

export const metadata: Metadata = { title: "준비물" };

export default async function TripPackingPage(props: PageProps<"/trips/[tripId]/packing">) {
  // Access is enforced by the trip layout (404 for non-members).
  const { tripId } = await props.params;
  return (
    <UpcomingFeature
      icon={PackageCheckIcon}
      tripId={tripId}
      title="준비물 체크리스트"
      description="여행지, 기간, 날씨, 취향에 맞춘 준비물을 AI가 만들어 줘요."
      points={[
          "기본·날씨 기반·맞춤 준비물",
          "체크 상태 저장",
          "직접 추가·삭제",
      ]}
    />
  );
}
