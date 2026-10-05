import {
  ArrowRightIcon,
  BookHeartIcon,
  CalendarRangeIcon,
  CompassIcon,
  PackageCheckIcon,
  RefreshCwIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ProductPreview } from "@/components/marketing/product-preview";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: siteConfig.title },
  alternates: { canonical: "/" },
};

const STAGES = [
  {
    key: "PLAN",
    title: "AI와 함께 계획",
    body: "여행지와 취향만 알려주세요. 이동시간까지 고려한, 실제로 가능한 일정을 만들어요.",
    icon: CalendarRangeIcon,
  },
  {
    key: "PREPARE",
    title: "빠짐없이 준비",
    body: "항공편, 숙소, 예산, 날씨에 맞춘 준비물까지 한 곳에서 챙겨요.",
    icon: PackageCheckIcon,
  },
  {
    key: "TRAVEL",
    title: "지금 할 일을 한눈에",
    body: "현재 시간과 위치, 날씨를 바탕으로 다음 일정과 이동 방법을 알려줘요.",
    icon: CompassIcon,
  },
  {
    key: "ADAPT",
    title: "변수에 맞춰 조정",
    body: "“여기 너무 좋다, 1시간 더 있을래.” 이후 일정을 AI가 다시 맞춰요.",
    icon: RefreshCwIcon,
  },
  {
    key: "REMEMBER",
    title: "기억으로 남기기",
    body: "사진, 메모, 지출을 모아 여행이 끝나면 나만의 여행 리포트를 만들어요.",
    icon: BookHeartIcon,
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-5 pt-14 pb-16 text-center sm:pt-24">
          <h1 className="mx-auto mt-6 max-w-3xl text-[2.5rem] leading-[1.15] font-bold sm:text-6xl">
            여행을 계획하는 게 아니라,
            <br />
            <span className="text-primary">여행을 함께 준비하세요.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            AI가 일정부터 이동, 날씨, 예산, 여행 중 변수까지 함께 관리합니다.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/signup">
                여행 시작하기
                <ArrowRightIcon data-icon="inline-end" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/demo">데모 여행 둘러보기</Link>
            </Button>
          </div>
        </div>
        <div className="px-5 pb-20 sm:pb-28">
          <ProductPreview />
        </div>
      </section>

      <section aria-labelledby="flow-title" className="border-t bg-card/50">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
          <p className="text-sm font-semibold text-primary">하나의 흐름</p>
          <h2 id="flow-title" className="mt-2 max-w-2xl text-3xl font-bold sm:text-4xl">
            떠나기 전부터 돌아온 뒤까지, 같은 여행을 이어서 관리해요.
          </h2>
          <ol className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
            {STAGES.map((stage, i) => (
              <li key={stage.key} className="relative">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
                    <stage.icon className="size-5" aria-hidden />
                  </span>
                  <span className="text-xs font-semibold tracking-widest text-muted-foreground">
                    {String(i + 1).padStart(2, "0")} {stage.key}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{stage.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{stage.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="adapt-title" className="mx-auto max-w-6xl px-5 py-20 sm:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-primary">상황을 이해하는 AI</p>
            <h2 id="adapt-title" className="mt-2 text-3xl font-bold sm:text-4xl">
              챗봇이 아니라,
              <br />
              일정을 함께 바꾸는 동행자.
            </h2>
            <p className="mt-5 text-muted-foreground">
              TripMate의 AI는 지금 몇 시인지, 어디에 있는지, 남은 일정과 예산이 얼마인지 알고 대답해요. 제안은
              언제나 버튼 하나로 일정에 반영되고, 중요한 변경은 꼭 먼저 물어봐요.
            </p>
          </div>
          <ul className="space-y-3">
            {[
              ["비가 와요", "야외 일정을 실내 일정으로 바꿔 드려요."],
              ["일정이 밀렸어요", "남은 일정을 이동시간까지 다시 계산해요."],
              ["밥 먹고 어디 가지?", "현재 위치와 남은 시간, 취향으로 추천해요."],
              ["예산이 빠듯해요", "카테고리별 지출을 보고 아낄 곳을 알려줘요."],
            ].map(([q, a]) => (
              <li key={q} className="rounded-lg border bg-card px-5 py-4">
                <p className="font-semibold">“{q}”</p>
                <p className="mt-1 text-sm text-muted-foreground">{a}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-5 pb-24">
        <div className="mx-auto max-w-6xl rounded-xl bg-primary px-6 py-14 text-center text-primary-foreground sm:py-20">
          <h2 className="text-3xl font-bold sm:text-4xl">다음 여행, 혼자 준비하지 마세요.</h2>
          <p className="mx-auto mt-4 max-w-md text-primary-foreground/80">
            여행지와 날짜만 있으면 시작할 수 있어요.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" variant="secondary">
              <Link href="/signup">여행 시작하기</Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20"
            >
              <Link href="/demo">데모 여행 둘러보기</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
