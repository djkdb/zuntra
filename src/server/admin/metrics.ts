import "server-only";
import type { AnalyticsEventName } from "@/server/analytics/track";
import { db } from "@/server/db";

const DAY = 86_400_000;
const FUNNEL: { event: AnalyticsEventName; label: string }[] = [
  { event: "signup", label: "회원가입" },
  { event: "complete_onboarding", label: "온보딩 완료" },
  { event: "create_trip", label: "여행 생성" },
  { event: "generate_plan", label: "AI 일정 생성" },
  { event: "ask_ai", label: "AI에게 질문" },
  { event: "add_expense", label: "경비 기록" },
  { event: "create_journal", label: "여행 기록" },
  { event: "complete_trip", label: "여행 종료" },
];
/** Destinations shown only when at least this many trips share them (k-anonymity). */
const MIN_GROUP = 2;

export async function getAdminMetrics(days = 30) {
  const since = new Date(Date.now() - days * DAY);
  const [users, newUsers, trips, newTrips, items, expenses, ai, aiByFeature, aiErrors, destinations, actionDecisions, suggestionClicks, askAi] =
    await Promise.all([
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: since } } }),
      db.trip.count(),
      db.trip.count({ where: { createdAt: { gte: since } } }),
      db.itineraryItem.count(),
      db.expense.groupBy({ by: ["tripId"], _sum: { amount: true } }),
      db.aIUsageLog.aggregate({
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _avg: { latencyMs: true },
        _sum: { costUsd: true, promptTokens: true, completionTokens: true },
      }),
      db.aIUsageLog.groupBy({
        by: ["feature"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _avg: { latencyMs: true },
        _sum: { costUsd: true },
      }),
      db.aIUsageLog.groupBy({
        by: ["errorCode"],
        where: { createdAt: { gte: since }, success: false },
        _count: { _all: true },
      }),
      db.trip.groupBy({ by: ["destination"], _count: { _all: true }, orderBy: { _count: { destination: "desc" } }, take: 20 }),
      db.analyticsEvent.findMany({ where: { name: "ai_action_decided", createdAt: { gte: since } }, select: { properties: true } }),
      db.analyticsEvent.count({ where: { name: "ai_suggestion_clicked", createdAt: { gte: since } } }),
      db.analyticsEvent.count({ where: { name: "ask_ai", createdAt: { gte: since } } }),
    ]);

  const funnelCounts = await Promise.all(
    FUNNEL.map(async (step) => {
      const rows = await db.analyticsEvent.findMany({
        where: { name: step.event, createdAt: { gte: since }, userId: { not: null } },
        distinct: ["userId"],
        select: { userId: true },
      });
      return { ...step, users: rows.length };
    }),
  );

  const approved = actionDecisions.filter((e) => (e.properties as { approved?: boolean } | null)?.approved === true).length;
  const tripCosts = expenses.map((e) => Number(e._sum.amount ?? 0));
  const failed = aiErrors.reduce((s, e) => s + e._count._all, 0);

  return {
    windowDays: days,
    users: { total: users, new: newUsers },
    trips: { total: trips, new: newTrips, avgItems: trips ? Math.round((items / trips) * 10) / 10 : 0 },
    avgTripCost: tripCosts.length ? Math.round(tripCosts.reduce((s, n) => s + n, 0) / tripCosts.length) : 0,
    ai: {
      requests: ai._count._all,
      avgLatencyMs: Math.round(ai._avg.latencyMs ?? 0),
      costUsd: Number(ai._sum.costUsd ?? 0),
      tokens: (ai._sum.promptTokens ?? 0) + (ai._sum.completionTokens ?? 0),
      errorRate: ai._count._all ? failed / ai._count._all : 0,
      errors: aiErrors.map((e) => ({ code: e.errorCode ?? "UNKNOWN", count: e._count._all })).sort((a, b) => b.count - a.count),
      byFeature: aiByFeature
        .map((f) => ({ feature: f.feature, requests: f._count._all, avgLatencyMs: Math.round(f._avg.latencyMs ?? 0), costUsd: Number(f._sum.costUsd ?? 0) }))
        .sort((a, b) => b.requests - a.requests),
      actionApprovalRate: actionDecisions.length ? approved / actionDecisions.length : null,
      actionDecisions: actionDecisions.length,
      suggestionClickRate: askAi ? suggestionClicks / askAi : null,
    },
    popularDestinations: destinations
      .filter((d) => d._count._all >= MIN_GROUP)
      .slice(0, 10)
      .map((d) => ({ destination: d.destination, trips: d._count._all })),
    funnel: funnelCounts,
  };
}

export type AdminMetrics = Awaited<ReturnType<typeof getAdminMetrics>>;
