import type { Metadata } from "next";
import { DemoLoader } from "@/components/demo/demo-loader";

export const metadata: Metadata = {
  title: "데모 여행 · Tokyo 5 Days",
  description: "가입 없이 TripMate를 체험해 보세요. 오늘 일정, 지도, AI 동행, 경비, 여행 기록까지 직접 써 볼 수 있어요.",
  alternates: { canonical: "/demo" },
};

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:py-12">
      <DemoLoader />
    </div>
  );
}
