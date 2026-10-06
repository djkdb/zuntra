import { roundForCurrency } from "@/lib/fx";

export interface SettlementExpense {
  amount: number;
  paidById: string | null;
  /** Who shares it; empty = everyone. */
  splitWith: string[];
}

export interface SettlementPerson {
  id: string;
  name: string;
  /** What they paid for the group. */
  paid: number;
  /** Their share of everything they took part in. */
  share: number;
  /** paid − share: positive = gets money back. */
  balance: number;
}

export interface Transfer {
  fromId: string;
  toId: string;
  amount: number;
}

export interface Settlement {
  people: SettlementPerson[];
  transfers: Transfer[];
  /** Expenses with no payer are left out of the split. */
  unassigned: { count: number; amount: number };
}

/** Smallest unit the currency is written in (₩1, ¥1, $0.01). */
const unitOf = (currency: string) => (roundForCurrency(0.4, currency) === 0 ? 1 : 0.01);

/**
 * Splits each expense evenly among the people who shared it and works out who pays whom.
 * Shares are whole currency units; the leftover units go to the first sharers (in the trip's
 * participant order), so every expense's shares add up to exactly what was paid.
 * Transfers settle the largest debt against the largest credit first, which keeps the list
 * to at most n − 1 payments.
 */
export function computeSettlement(
  participants: { id: string; name: string }[],
  expenses: SettlementExpense[],
  currency: string,
): Settlement {
  const unit = unitOf(currency);
  const toUnits = (n: number) => Math.round(n / unit);
  const order = new Map(participants.map((p, i) => [p.id, i]));
  const paid = new Map(participants.map((p) => [p.id, 0]));
  const share = new Map(participants.map((p) => [p.id, 0]));
  const unassigned = { count: 0, amount: 0 };

  for (const e of expenses) {
    const total = toUnits(e.amount);
    const sharers = (e.splitWith.length > 0 ? e.splitWith : participants.map((p) => p.id))
      .filter((id) => order.has(id))
      .sort((a, b) => order.get(a)! - order.get(b)!);
    if (!e.paidById || !order.has(e.paidById) || sharers.length === 0) {
      unassigned.count += 1;
      unassigned.amount += e.amount;
      continue;
    }
    paid.set(e.paidById, paid.get(e.paidById)! + total);
    const base = Math.floor(total / sharers.length);
    const extra = total - base * sharers.length;
    sharers.forEach((id, i) => share.set(id, share.get(id)! + base + (i < extra ? 1 : 0)));
  }

  const people = participants.map((p) => {
    const paidUnits = paid.get(p.id)!;
    const shareUnits = share.get(p.id)!;
    return { id: p.id, name: p.name, paidUnits, shareUnits, balanceUnits: paidUnits - shareUnits };
  });

  const creditors = people.filter((p) => p.balanceUnits > 0).map((p) => ({ id: p.id, left: p.balanceUnits }));
  const debtors = people.filter((p) => p.balanceUnits < 0).map((p) => ({ id: p.id, left: -p.balanceUnits }));
  const transfers: Transfer[] = [];
  while (creditors.length > 0 && debtors.length > 0) {
    creditors.sort((a, b) => b.left - a.left || order.get(a.id)! - order.get(b.id)!);
    debtors.sort((a, b) => b.left - a.left || order.get(a.id)! - order.get(b.id)!);
    const c = creditors[0]!;
    const d = debtors[0]!;
    const amount = Math.min(c.left, d.left);
    transfers.push({ fromId: d.id, toId: c.id, amount: roundForCurrency(amount * unit, currency) });
    c.left -= amount;
    d.left -= amount;
    if (c.left === 0) creditors.shift();
    if (d.left === 0) debtors.shift();
  }

  const money = (units: number) => roundForCurrency(units * unit, currency);
  return {
    people: people.map((p) => ({ id: p.id, name: p.name, paid: money(p.paidUnits), share: money(p.shareUnits), balance: money(p.balanceUnits) })),
    transfers,
    unassigned: { count: unassigned.count, amount: roundForCurrency(unassigned.amount, currency) },
  };
}
