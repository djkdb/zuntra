import "server-only";
import { formatMinute } from "@/lib/itinerary";
import { endOf, reflowDay } from "@/lib/schedule";
import type { RescheduleContext } from "../prompts/rescheduler";
import type { RescheduleProposalDraft } from "../schemas/rescheduler";

const DROP_PRIORITY = ["SHOPPING", "CAFE", "ACTIVITY", "SIGHTSEEING", "NATURE", "CULTURE", "OTHER"];

/** Rule-based rescheduling: move to now, reflow, then drop low-priority stops until the day fits. */
export function mockReschedule(ctx: RescheduleContext): RescheduleProposalDraft {
  const tired = /피곤|힘들|지쳤|쉬고|tired/i.test(ctx.reason ?? "");
  let items = ctx.items.map((i) => ({ ...i, id: i.ref }));
  const changes = new Map<string, RescheduleProposalDraft["changes"][number]>();
  const set = (ref: string, change: Omit<RescheduleProposalDraft["changes"][number], "ref">) =>
    changes.set(ref, { ref, ...(changes.get(ref) ?? {}), ...change });

  // Nothing pending may start in the past.
  if (ctx.nowMinute !== null) {
    const firstPending = items.find((i) => i.status !== "DONE" && !i.isFixed);
    if (firstPending && firstPending.startMinute < ctx.nowMinute) {
      const to = Math.ceil((ctx.nowMinute + 10) / 5) * 5;
      set(firstPending.ref, { action: "MOVE", newStartTime: formatMinute(to), newDurationMinutes: null, reason: "현재 시간에 맞춰 옮겼어요." });
      firstPending.startMinute = to;
    }
  }

  // Fatigue: drop one optional stop first.
  const removable = () =>
    items
      .filter((i) => i.status !== "DONE" && !i.isFixed && !["FOOD", "LODGING", "AIRPORT"].includes(i.category))
      .sort((a, b) => DROP_PRIORITY.indexOf(a.category) - DROP_PRIORITY.indexOf(b.category));
  if (tired) {
    const victim = removable()[0];
    if (victim) {
      set(victim.ref, { action: "REMOVE", newStartTime: null, newDurationMinutes: null, reason: "피로를 고려해 일정 하나를 줄였어요." });
      items = items.filter((i) => i.ref !== victim.ref);
    }
  }

  // Rain: shorten outdoor afternoon stops.
  if (ctx.rainy) {
    for (const i of items) {
      if (i.status !== "DONE" && !i.isFixed && i.isIndoor === false && i.startMinute >= 12 * 60 && i.durationMinutes > 45) {
        const to = Math.round(i.durationMinutes * 0.6);
        set(i.ref, { action: "SHORTEN", newStartTime: null, newDurationMinutes: to, reason: "비 예보로 야외 체류를 줄였어요." });
        i.durationMinutes = to;
      }
    }
  }

  let flowed = reflowDay(items);
  while (flowed.items.some((i) => endOf(i) > ctx.latestEnd)) {
    const victim = removable().filter((i) => !changes.get(i.ref) || changes.get(i.ref)!.action !== "REMOVE").pop();
    if (!victim) break;
    set(victim.ref, { action: "REMOVE", newStartTime: null, newDurationMinutes: null, reason: "시간이 부족해 제외했어요." });
    items = items.filter((i) => i.ref !== victim.ref);
    flowed = reflowDay(items);
  }
  for (const c of flowed.changes) {
    const existing = changes.get(c.id);
    set(c.id, {
      action: existing?.action === "SHORTEN" ? "SHORTEN" : "MOVE",
      newStartTime: formatMinute(c.to),
      newDurationMinutes: existing?.newDurationMinutes ?? null,
      reason: existing?.reason ?? "앞 일정이 길어져 뒤로 미뤘어요.",
    });
  }

  const list = [...changes.values()];
  const removed = list.filter((c) => c.action === "REMOVE").length;
  const moved = list.length - removed;
  return {
    summary:
      list.length === 0
        ? "지금 일정은 무리 없이 진행할 수 있어요."
        : `${moved > 0 ? `일정 ${moved}개의 시간을 조정하고` : ""}${removed > 0 ? `${moved > 0 ? " " : ""}${removed}개를 줄여` : ""} 일정을 다시 맞췄어요.`,
    changes: list,
  };
}
