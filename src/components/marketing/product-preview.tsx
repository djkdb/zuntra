import { CloudRainIcon, MapPinIcon, NavigationIcon, SparklesIcon, SunIcon } from "lucide-react";
import { DayTimeline } from "@/components/itinerary/day-timeline";
import { DEMO_TRIP } from "@/lib/demo/tokyo";
import { formatMoney } from "@/lib/format";

/**
 * The landing page's product shot, rendered from the same components and demo data the app
 * uses — not a static image — so it stays true to the real product and costs no image bytes.
 */
export function ProductPreview() {
  const day = DEMO_TRIP.days[1]!;
  const rainDay = DEMO_TRIP.days[2]!;
  const spentPct = Math.round((DEMO_TRIP.spentAmount / DEMO_TRIP.budgetAmount) * 100);

  return (
    <div className="relative mx-auto grid max-w-5xl items-start gap-6 lg:grid-cols-[340px_1fr]">
      {/* Phone: the TODAY screen */}
      <figure
        aria-label="여행 중 오늘 일정 화면 예시"
        className="relative mx-auto w-full max-w-[340px] rounded-[2.5rem] border-[10px] border-foreground/90 bg-background shadow-2xl shadow-primary/20"
      >
        <div className="rounded-[1.9rem] px-4 pt-5 pb-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>DAY {day.dayNumber} · 11월 4일 (수)</span>
            <span className="inline-flex items-center gap-1">
              <SunIcon className="size-3.5 text-sunset" aria-hidden />
              {day.weather.tempMax}°C
            </span>
          </div>
          <p className="mt-3 text-[1.6rem] leading-none font-bold">오늘 일정</p>
          <div className="mt-4 rounded-lg bg-secondary p-3.5 text-secondary-foreground">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <MapPinIcon className="size-3.5" aria-hidden />
              현재 위치 · Ueno
            </p>
            <p className="mt-2 text-xs opacity-80">다음 일정</p>
            <p className="font-semibold">16:00 아메요코 시장</p>
            <p className="mt-1 flex items-center gap-1 text-xs opacity-80">
              <NavigationIcon className="size-3" aria-hidden />
              도보 8분 · 예상 체류 1시간 30분
            </p>
          </div>
          <div className="mt-4">
            <DayTimeline items={day.items.slice(0, 4)} compact />
          </div>
          <div className="mt-4 flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground">
            <SparklesIcon className="size-4" aria-hidden />
            지금 AI에게 물어보기
          </div>
        </div>
      </figure>

      {/* Companion + context cards */}
      <div className="space-y-4">
        <figure aria-label="AI 동행 대화 예시" className="rounded-xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex justify-end">
            <p className="max-w-[80%] rounded-lg rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
              지금 너무 피곤해.
            </p>
          </div>
          <div className="mt-4 flex gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
              <SparklesIcon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 space-y-3">
              <p className="rounded-lg rounded-tl-md bg-muted px-4 py-3 text-sm leading-relaxed">
                지금은 15:50이고 오늘 일정이 2개 남아 있어요. 숙소까지는 18분 정도 걸려요.
                <br />
                아메요코 시장은 내일 오전으로 옮기고, 숙소 근처에서 저녁을 먹는 걸 추천해요.
              </p>
              <div className="flex flex-wrap gap-2" aria-hidden>
                <span className="rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground">
                  일정 줄이기
                </span>
                <span className="rounded-full border px-3.5 py-1.5 text-xs font-medium">현재 일정 유지</span>
                <span className="rounded-full border px-3.5 py-1.5 text-xs font-medium">숙소로 이동</span>
              </div>
            </div>
          </div>
        </figure>

        <div className="grid gap-4 sm:grid-cols-2">
          <figure aria-label="날씨 기반 제안 예시" className="rounded-xl border bg-card p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <CloudRainIcon className="size-4 text-primary" aria-hidden />
              Day {rainDay.dayNumber} 오후 비 예보 · {rainDay.weather.precipitation}%
            </p>
            <p className="mt-2 text-sm text-muted-foreground">야외 일정 대신 실내 일정으로 바꿀까요?</p>
            <p className="mt-3 text-sm">
              <span className="text-muted-foreground line-through">도쿄 타워</span>
              <span className="mx-2 text-muted-foreground">→</span>
              <span className="font-medium">팀랩 플래닛</span>
            </p>
          </figure>
          <figure aria-label="예산 현황 예시" className="rounded-xl border bg-card p-5">
            <p className="text-sm font-semibold">예산의 {spentPct}%를 사용했어요</p>
            <p className="mt-1 text-2xl font-bold">{formatMoney(DEMO_TRIP.spentAmount, DEMO_TRIP.currency)}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-primary" style={{ width: `${spentPct}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">식비 지출이 예상보다 조금 높아요.</p>
          </figure>
        </div>
      </div>
    </div>
  );
}
