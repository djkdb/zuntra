import { describe, expect, it } from "vitest";
import { computeSettlement } from "@/lib/settlement";

const people = [
  { id: "a", name: "지민" },
  { id: "b", name: "민수" },
  { id: "c", name: "서연" },
];

describe("computeSettlement", () => {
  it("splits evenly and lists who pays whom", () => {
    const s = computeSettlement(people, [{ amount: 90_000, paidById: "a", splitWith: [] }], "KRW");
    expect(s.people.map((p) => p.balance)).toEqual([60_000, -30_000, -30_000]);
    expect(s.transfers).toEqual([
      { fromId: "b", toId: "a", amount: 30_000 },
      { fromId: "c", toId: "a", amount: 30_000 },
    ]);
  });

  it("gives leftover won to the first sharers so shares add up exactly", () => {
    const s = computeSettlement(people, [{ amount: 10_000, paidById: "b", splitWith: [] }], "KRW");
    expect(s.people.map((p) => p.share)).toEqual([3_334, 3_333, 3_333]);
    expect(s.people.reduce((sum, p) => sum + p.balance, 0)).toBe(0);
  });

  it("only charges the people an expense was split with, and nets payments out", () => {
    const s = computeSettlement(
      people,
      [
        { amount: 60_000, paidById: "a", splitWith: ["a", "b"] },
        { amount: 30_000, paidById: "b", splitWith: [] },
      ],
      "KRW",
    );
    // a: paid 60k, share 30k+10k → +20k; b: paid 30k, share 30k+10k → −10k; c: −10k
    expect(s.people.map((p) => p.balance)).toEqual([20_000, -10_000, -10_000]);
    expect(s.transfers).toHaveLength(2);
    expect(s.transfers.every((t) => t.toId === "a" && t.amount === 10_000)).toBe(true);
  });

  it("works in cents for USD and leaves payer-less expenses out", () => {
    const s = computeSettlement(
      people.slice(0, 2),
      [
        { amount: 10.01, paidById: "a", splitWith: [] },
        { amount: 50, paidById: null, splitWith: [] },
      ],
      "USD",
    );
    expect(s.people.map((p) => p.share)).toEqual([5.01, 5]);
    expect(s.transfers).toEqual([{ fromId: "b", toId: "a", amount: 5 }]);
    expect(s.unassigned).toEqual({ count: 1, amount: 50 });
  });
});
