import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { getAdminMetrics } from "@/server/admin/metrics";
import { requireAdmin } from "@/server/auth/session";

export const metadata: Metadata = { title: "관리자", robots: { index: false } };

const ms = (v: number) => (v < 1000 ? `${v}ms` : `${(v / 1000).toFixed(1)}초`);
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 1000) / 10}%`);
const FEATURE_LABELS: Record<string, string> = {
  PLANNER: "일정 생성",
  RESCHEDULER: "일정 재조정",
  COMPANION: "AI 동행",
  ANALYZER: "지출 분석",
  PACKING: "준비물",
  REPORTER: "여행 리포트",
};

export default async function AdminPage() {
  await requireAdmin();
  const m = await getAdminMetrics(30);
  const top = Math.max(...m.funnel.map((f) => f.users), 1);

  const tiles: [string, string, string?][] = [
    ["회원 수", m.users.total.toLocaleString("ko-KR"), `최근 30일 +${m.users.new}`],
    ["여행 생성 수", m.trips.total.toLocaleString("ko-KR"), `최근 30일 +${m.trips.new}`],
    ["AI 요청 수", m.ai.requests.toLocaleString("ko-KR"), "최근 30일"],
    ["AI 평균 응답시간", ms(m.ai.avgLatencyMs)],
    ["AI 오류율", pct(m.ai.errorRate)],
    ["AI 비용", `$${m.ai.costUsd.toFixed(2)}`, `${m.ai.tokens.toLocaleString("ko-KR")} tokens`],
    ["평균 일정 수", `${m.trips.avgItems}개`, "여행당"],
    ["평균 여행 비용", m.avgTripCost.toLocaleString("ko-KR"), "지출 기록이 있는 여행 · 여행 통화 기준"],
    ["AI Action 승인율", pct(m.ai.actionApprovalRate), `${m.ai.actionDecisions}건 결정`],
    ["AI 추천 클릭률", pct(m.ai.suggestionClickRate), "빠른 답장 클릭 / AI 질문"],
  ];

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Admin" title="서비스 지표" description="최근 30일 기준. 개인을 식별할 수 있는 정보는 표시하지 않아요." />

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="rounded-2xl border bg-card p-4">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-2xl font-semibold">{value}</dd>
            {sub ? <dd className="mt-0.5 text-xs text-muted-foreground">{sub}</dd> : null}
          </div>
        ))}
      </dl>

      <section aria-labelledby="funnel-title" className="space-y-3">
        <h2 id="funnel-title" className="text-xl font-semibold">
          사용자 퍼널 <span className="text-sm font-normal text-muted-foreground">(고유 사용자, 30일 · 비율은 가입 대비)</span>
        </h2>
        <ol className="space-y-2">
          {m.funnel.map((f, i) => (
            <li key={f.event} className="grid grid-cols-[7rem_1fr_5rem] items-center gap-3 text-sm">
              <span className="text-muted-foreground">{f.label}</span>
              <span className="relative h-3 rounded-full bg-muted" aria-hidden>
                <span className="absolute inset-y-0 left-0 rounded-r-[4px] bg-primary" style={{ width: `${(f.users / top) * 100}%` }} />
              </span>
              <span className="text-right tabular-nums">
                {f.users}
                {i > 0 && m.funnel[0]!.users > 0 ? (
                  <span className="ml-1 text-xs text-muted-foreground">{Math.round((f.users / m.funnel[0]!.users) * 100)}%</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="ai-title" className="space-y-3">
          <h2 id="ai-title" className="text-xl font-semibold">
            AI 기능별 사용량
          </h2>
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2 font-medium">기능</th>
                <th className="py-2 text-right font-medium">요청</th>
                <th className="py-2 text-right font-medium">평균 응답</th>
                <th className="py-2 text-right font-medium">비용</th>
              </tr>
            </thead>
            <tbody>
              {m.ai.byFeature.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-muted-foreground">
                    아직 AI 요청이 없어요.
                  </td>
                </tr>
              ) : (
                m.ai.byFeature.map((f) => (
                  <tr key={f.feature} className="border-t">
                    <td className="py-2">{FEATURE_LABELS[f.feature] ?? f.feature}</td>
                    <td className="py-2 text-right tabular-nums">{f.requests}</td>
                    <td className="py-2 text-right tabular-nums">{ms(f.avgLatencyMs)}</td>
                    <td className="py-2 text-right tabular-nums">${f.costUsd.toFixed(3)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {m.ai.errors.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              AI 오류: {m.ai.errors.map((e) => `${e.code} ${e.count}건`).join(" · ")}
            </p>
          ) : null}
        </section>

        <section aria-labelledby="dest-title" className="space-y-3">
          <h2 id="dest-title" className="text-xl font-semibold">
            인기 여행지
          </h2>
          {m.popularDestinations.length === 0 ? (
            <p className="text-sm text-muted-foreground">충분한 데이터가 모이면 보여드려요 (여행지당 2건 이상).</p>
          ) : (
            <ol className="divide-y rounded-2xl border bg-card text-sm">
              {m.popularDestinations.map((d, i) => (
                <li key={d.destination} className="flex justify-between px-4 py-2.5">
                  <span>
                    <span className="mr-2 text-muted-foreground tabular-nums">{i + 1}</span>
                    {d.destination}
                  </span>
                  <span className="tabular-nums">{d.trips}건</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
