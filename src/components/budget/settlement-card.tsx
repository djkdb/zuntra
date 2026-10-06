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
export function SettlementCard({
  tripId,
  settlement,
  currency,
  meId,
}: {
  tripId: string;
  settlement: Settlement;
  currency: string;
  meId?: string;
}) {
  const name = (id: string) => settlement.people.find((p) => p.id === id)?.name ?? "?";
  // What concerns me comes first.
  const transfers = [...settlement.transfers].sort(
    (a, b) => Number(b.fromId === meId || b.toId === meId) - Number(a.fromId === meId || a.toId === meId),
  );
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

      <div className="grid border-t lg:grid-cols-2 lg:items-start">
        {settlement.transfers.length > 0 ? (
          <ul className="space-y-2 p-5 lg:border-r">
            {transfers.map((t) => {
              const mine = t.fromId === meId || t.toId === meId;
              return (
                <li
                  key={`${t.fromId}-${t.toId}`}
                  className={cn("flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm", mine ? "bg-primary/10" : "bg-muted/60")}
                >
                  {/* Read as one sentence so the direction of the money is unambiguous. */}
                  <span className="sr-only">{`${t.fromId === meId ? "내가" : withJosa(name(t.fromId), "이/가")} ${t.toId === meId ? "나" : name(t.toId)}에게 ${money(t.amount)} 보내기`}</span>
                  <span aria-hidden className="font-medium">{t.fromId === meId ? "나" : name(t.fromId)}</span>
                  <ArrowRightIcon className="size-4 text-muted-foreground" aria-hidden />
                  <span aria-hidden className="font-medium">{t.toId === meId ? "나" : name(t.toId)}</span>
                  <span aria-hidden className="ml-auto font-semibold tabular-nums">{money(t.amount)}</span>
                </li>
              );
            })}
          </ul>
        ) : null}

        <table className="w-full text-sm max-lg:border-t">
          <caption className="sr-only">사람별 낸 돈과 부담할 몫</caption>
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th scope="col" className="px-5 py-2 text-left font-medium">
                이름
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium">
                낸 돈
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium">
                몫
              </th>
              <th scope="col" className="px-5 py-2 text-right font-medium">
                차액
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {settlement.people.map((p) => (
              <tr key={p.id} className={cn(p.id === meId && "bg-primary/5")}>
                <th scope="row" className="px-5 py-2.5 text-left font-medium">
                  {p.name}
                  {p.id === meId ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">나</span> : null}
                </th>
                <td className="px-2 py-2.5 text-right tabular-nums">{money(p.paid)}</td>
                <td className="px-2 py-2.5 text-right tabular-nums">{money(p.share)}</td>
                <td
                  className={cn(
                    "px-5 py-2.5 text-right font-medium tabular-nums",
                    p.balance > 0 ? "text-success" : p.balance < 0 ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {p.balance > 0 ? `+${money(p.balance)}` : p.balance < 0 ? `−${money(-p.balance)}` : "0"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {settlement.unassigned.count > 0 ? (
        <p className="border-t px-5 py-3 text-xs text-muted-foreground">
          {`개인 지출 ${settlement.unassigned.count}건(${money(settlement.unassigned.amount)})은 나누지 않았어요.`}
        </p>
      ) : null}
    </section>
  );
}
