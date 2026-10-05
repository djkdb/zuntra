import { BookHeartIcon, CameraIcon, LightbulbIcon, MapPinIcon, SparklesIcon, UtensilsIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ReportActions } from "@/components/report/report-actions";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/budget";
import { formatDateRange } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { MOOD_OPTIONS } from "@/lib/journal";
import { getReport } from "@/server/ai/travel-reporter";
import { requireOnboardedUser } from "@/server/auth/session";
import { tripPageData } from "@/server/services/trip-queries";

export const metadata: Metadata = { title: "여행 리포트" };

export default async function ReportPage(props: PageProps<"/trips/[tripId]/report">) {
  const { tripId } = await props.params;
  const user = await requireOnboardedUser();
  const { trip, data: report } = await tripPageData(tripId, user.id, () => getReport(tripId, user.id));

  if (!report) {
    return (
      <EmptyState
        icon={BookHeartIcon}
        title="아직 여행 리포트가 없어요"
        description="여행 기록 탭에서 여행을 종료하면 AI가 여행 리포트를 만들어 드려요."
        action={
          <Button asChild>
            <Link href={`/trips/${tripId}/journal`}>여행 기록으로 가기</Link>
          </Button>
        }
      />
    );
  }

  const { stats, highlights, ai } = report;
  const maxCat = Math.max(...stats.byCategory.map((c) => c.amount), 1);
  const canEdit = trip.role !== "VIEWER";

  return (
    <article className="mx-auto max-w-3xl space-y-10">
      <header className="overflow-hidden rounded-xl bg-primary px-6 py-10 text-center text-primary-foreground sm:px-10">
        <div aria-hidden className="mx-auto h-px w-24 bg-primary-foreground/40" />
        <p className="mt-6 text-sm text-primary-foreground/75">{formatDateRange(report.trip.startDate, report.trip.endDate)}</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight">{report.trip.destination} 여행</h2>
        <dl className="mt-6 flex flex-wrap justify-center gap-x-8 gap-y-3 text-lg">
          <div>
            <dt className="sr-only">기간</dt>
            <dd className="font-semibold">{stats.days}일</dd>
          </div>
          <div>
            <dt className="sr-only">방문한 장소</dt>
            <dd className="font-semibold">{stats.places}곳</dd>
          </div>
          <div>
            <dt className="sr-only">총 지출</dt>
            <dd className="font-semibold">{formatMoney(stats.totalSpent, stats.currency)}</dd>
          </div>
        </dl>
        <div aria-hidden className="mx-auto mt-6 h-px w-24 bg-primary-foreground/40" />
        <p className="mt-6 text-xl font-semibold">{ai.title}</p>
      </header>

      {highlights.coverPhotoIds.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="여행 사진">
          {highlights.coverPhotoIds.map((id) => (
            <li key={id}>
              <Image src={`/api/photos/${id}`} alt="여행 사진" width={400} height={400} unoptimized loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
            </li>
          ))}
        </ul>
      ) : null}

      <section aria-label="하이라이트" className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: MapPinIcon, label: "가장 기억에 남은 장소", value: highlights.memorablePlace },
          { icon: UtensilsIcon, label: "가장 좋아한 음식", value: highlights.favoriteFood },
          { icon: CameraIcon, label: "가장 많이 방문한 카테고리", value: highlights.topCategory ? `${highlights.topCategory.label} · ${highlights.topCategory.count}곳` : null },
        ].map((h) => (
          <div key={h.label} className="rounded-lg border bg-card p-4">
            <h.icon className="size-5 text-primary" aria-hidden />
            <p className="mt-3 text-sm text-muted-foreground">{h.label}</p>
            <p className="mt-1 text-lg font-semibold">{h.value ?? "—"}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="retro-title" className="space-y-4">
        <h2 id="retro-title" className="flex items-center gap-2 text-xl font-semibold">
          <SparklesIcon className="size-5 text-primary" aria-hidden />
          AI 여행 회고
        </h2>
        <p className="text-lg leading-relaxed">{ai.retrospective}</p>
        <ul className="space-y-2">
          {ai.highlights.map((h) => (
            <li key={h} className="flex gap-2 rounded-xl bg-muted/60 px-4 py-3 text-sm">
              <span className="text-primary" aria-hidden>
                ✦
              </span>
              {h}
            </li>
          ))}
        </ul>
        <p className="flex gap-2 rounded-xl border border-dashed px-4 py-3 text-sm">
          <LightbulbIcon className="size-4 shrink-0 text-sunset" aria-hidden />
          <span>
            <span className="font-medium">다음 여행 팁 · </span>
            {ai.nextTripTip}
          </span>
        </p>
      </section>

      <section aria-labelledby="money-title" className="space-y-4">
        <h2 id="money-title" className="text-lg font-semibold">
          여행 경비 결산
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["총 지출", formatMoney(stats.totalSpent, stats.currency)],
            ["1인당", formatMoney(stats.perPerson, stats.currency)],
            ["예산", stats.budget !== null ? formatMoney(stats.budget, stats.currency) : "미정"],
            [
              "예산 대비",
              stats.budget ? `${Math.round((stats.totalSpent / stats.budget) * 100)}%${stats.totalSpent > stats.budget ? " · 초과" : ""}` : "—",
            ],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border bg-card p-4">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-1 font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        {stats.byCategory.length > 0 ? (
          <ul className="space-y-3">
            {stats.byCategory.map((c) => (
              <li key={c.category} className="grid grid-cols-[3rem_1fr_6.5rem] items-center gap-3 text-sm">
                <span className="text-muted-foreground">{EXPENSE_CATEGORY_LABELS[c.category]}</span>
                <span className="relative h-2.5 rounded-full bg-muted" aria-hidden>
                  <span className="absolute inset-y-0 left-0 rounded-r-[4px] bg-primary" style={{ width: `${(c.amount / maxCat) * 100}%` }} />
                </span>
                <span className="text-right font-medium tabular-nums">{formatMoney(c.amount, stats.currency)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {highlights.moods.length > 0 ? (
        <section aria-labelledby="mood-title" className="space-y-3">
          <h2 id="mood-title" className="text-lg font-semibold">
            여행 중 기분
          </h2>
          <ul className="flex flex-wrap gap-2">
            {highlights.moods.map((m) => {
              const opt = MOOD_OPTIONS.find((o) => o.value === m.mood);
              return (
                <li key={m.mood} className="rounded-full border bg-card px-4 py-2 text-sm">
                  <span aria-hidden>{opt?.emoji}</span> {opt?.label} {m.count}번
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-sm text-muted-foreground">
        <span>
          {stats.journalEntries}개의 기록 · {stats.photos}장의 사진으로 만들었어요
        </span>
        {canEdit ? <ReportActions tripId={tripId} /> : null}
      </footer>
    </article>
  );
}
