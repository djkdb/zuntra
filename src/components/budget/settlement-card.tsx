"use client";

import { ArrowRightIcon, CopyIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { withJosa } from "@/lib/korean";
import type { Settlement } from "@/lib/settlement";
import { cn } from "@/lib/utils";

/** N빵: what each person paid vs. their share, and the fewest transfers that even it out. */
export function SettlementCard({ tripId, settlement, currency }: { tripId: string; settlement: Settlement; currency: string }) {
  const name = (id: string) => settlement.people.find((p) => p.id === id)?.name ?? "?";
  const money = (n: number) => formatMoney(n, currency);
  const text = [
    "[여행 정산]",
    ...settlement.people.map((p) => `${p.name}: 낸 돈 ${money(p.paid)} / 몫 ${money(p.share)}`),
    "",
    ...(settlement.transfers.length > 0
      ? settlement.transfers.map((t) => `${name(t.fromId)} → ${name(t.toId)} ${money(t.amount)}`)
      : ["주고받을 돈이 없어요."]),
  ].join("\n");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("정산 내용을 복사했어요. 단톡방에 붙여 넣어 보세요.");
    } catch {
      toast.error("복사하지 못했어요.");
    }
  };

  return (
    <section aria-labelledby="settle-title" className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-4">
        <div>
          <h2 id="settle-title" className="text-base font-semibold">
            N빵 정산
          </h2>
          <p className="text-sm text-muted-foreground">
            {settlement.transfers.length > 0 ? `${settlement.transfers.length}번만 보내면 끝나요.` : "지금은 주고받을 돈이 없어요."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href={`/trips/${tripId}/members`}>
              <UsersIcon data-icon="inline-start" aria-hidden />
              사람 관리
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={copy}>
            <CopyIcon data-icon="inline-start" aria-hidden />
            복사
          </Button>
        </div>
      </div>

      {settlement.transfers.length > 0 ? (
        <ul className="space-y-2 px-5 pb-4">
          {settlement.transfers.map((t) => (
            <li key={`${t.fromId}-${t.toId}`} className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-sm">
              <span className="font-medium">{name(t.fromId)}</span>
              <ArrowRightIcon className="size-4 text-muted-foreground" aria-label="에게" />
              <span className="font-medium">{name(t.toId)}</span>
              <span className="ml-auto font-semibold tabular-nums">{money(t.amount)}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <table className="w-full border-t text-sm">
        <caption className="sr-only">사람별 낸 돈과 부담할 몫</caption>
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th scope="col" className="px-5 py-2 text-left font-medium">이름</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">낸 돈</th>
            <th scope="col" className="px-2 py-2 text-right font-medium">몫</th>
            <th scope="col" className="px-5 py-2 text-right font-medium">차액</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {settlement.people.map((p) => (
            <tr key={p.id}>
              <th scope="row" className="px-5 py-2.5 text-left font-medium">{p.name}</th>
              <td className="px-2 py-2.5 text-right tabular-nums">{money(p.paid)}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{money(p.share)}</td>
              <td className={cn("px-5 py-2.5 text-right font-medium tabular-nums", p.balance > 0 ? "text-success" : p.balance < 0 ? "text-destructive" : "text-muted-foreground")}>
                {p.balance > 0 ? `+${money(p.balance)}` : p.balance < 0 ? `−${money(-p.balance)}` : "0"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {settlement.unassigned.count > 0 ? (
        <p className="border-t px-5 py-3 text-xs text-muted-foreground">
          낸 사람이 없는 지출 {settlement.unassigned.count}건({withJosa(money(settlement.unassigned.amount), "은/는")})은 정산에서 뺐어요.
        </p>
      ) : null}
    </section>
  );
}
