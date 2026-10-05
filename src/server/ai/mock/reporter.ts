import "server-only";
import { formatMoney } from "@/lib/format";
import type { ReporterContext } from "../prompts/reporter";
import type { ReportNarrative } from "../schemas/reporter";
import { withJosa } from "@/lib/korean";

export function mockReport(ctx: ReporterContext): ReportNarrative {
  const s = ctx.stats;
  const h = ctx.highlights;
  const focus =
    h.topCategory && ["FOOD", "CAFE"].includes(h.topCategory.category)
      ? "관광보다 카페와 맛집을 중심으로"
      : h.topCategory
        ? `${h.topCategory.label} 위주로`
        : "여유롭게";
  const sentences = [
    `이번 ${ctx.trip.destination} 여행은 ${focus} ${s.days}일 동안 ${s.places}곳을 둘러본 여행이었어요.`,
    h.memorablePlace ? `가장 기억에 남은 곳은 ‘${h.memorablePlace}’였어요.` : null,
    h.favoriteFood ? `특히 ‘${h.favoriteFood}’에서의 식사가 인상 깊었네요.` : null,
    s.totalSpent > 0
      ? `총 ${formatMoney(s.totalSpent, s.currency)}, 1인당 ${withJosa(formatMoney(s.perPerson, s.currency), "을/를")} 썼어요${
          s.budget ? (s.totalSpent <= s.budget ? " — 예산 안에서 알차게 다녀왔어요." : " — 예산보다 조금 더 썼지만 그만큼 즐거웠던 여행이에요.") : "."
        }`
      : null,
    s.journalEntries > 0 ? `${s.journalEntries}개의 기록과 ${s.photos}장의 사진이 이 여행을 오래 기억하게 해 줄 거예요.` : null,
  ].filter(Boolean);
  const highlights = [
    ...ctx.journal
      .filter((j) => (j.rating ?? 0) >= 4)
      .slice(0, 3)
      .map((j) => `${j.place ? `${j.place}: ` : ""}${j.content.slice(0, 80)}`),
  ];
  if (highlights.length === 0) highlights.push(`${s.days}일 동안 ${s.places}곳을 다녀왔어요.`);
  const byCat = [...s.byCategory].sort((a, b) => b.amount - a.amount)[0];
  return {
    title: `${ctx.trip.destination}, ${focus.replace(/으로$|로$/, "")}의 ${s.days}일`.slice(0, 60),
    retrospective: sentences.join(" "),
    highlights,
    nextTripTip:
      s.budget && s.totalSpent > s.budget
        ? `다음 여행에서는 ${byCat ? "가장 많이 쓴 항목" : "지출"}의 예산을 미리 넉넉히 잡아 보세요.`
        : "이번처럼 여유 있는 일정에 좋아하는 맛집을 미리 담아 두면 더 즐거울 거예요.",
  };
}
