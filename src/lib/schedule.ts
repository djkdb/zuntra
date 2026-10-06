/**
 * Pure scheduling engine shared by the plan editor, the AI validation layer and the
 * rescheduler. A day's order is its `position` order; times must follow that order with
 * enough travel time between stops.
 */
export interface ScheduleItem {
  id: string;
  title?: string;
  startMinute: number;
  durationMinutes: number;
  /** Travel from the previous stop; ignored for the first item. */
  travelMinutesFromPrev: number | null;
  status?: string;
  /** Booked time (flight, reservation): never moved automatically. */
  isFixed?: boolean;
}

export const DAY_START = 6 * 60;
export const DAY_END = 24 * 60 - 1;
export const DEFAULT_TRAVEL_MINUTES = 15;

export type ScheduleIssueType = "OVERLAP" | "PAST_MIDNIGHT";

export interface ScheduleIssue {
  type: ScheduleIssueType;
  itemId: string;
  /** How many minutes short (overlap) or over (past midnight). */
  minutes: number;
}

export interface ScheduleChange {
  id: string;
  from: number;
  to: number;
  /** Set when the stop was shortened to finish before a booking. */
  durationTo?: number;
}

/** Shortest a stop is cut to before it is moved past a booking instead. */
const MIN_STAY = 15;

export function travelOf(item: ScheduleItem, index: number): number {
  if (index === 0) return 0;
  return item.travelMinutesFromPrev ?? DEFAULT_TRAVEL_MINUTES;
}

export function endOf(item: ScheduleItem): number {
  return item.startMinute + item.durationMinutes;
}

/** Overlaps (not enough time to finish + travel) and stops running past midnight. */
export function analyzeDay(items: ScheduleItem[]): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];
  items.forEach((item, i) => {
    if (i > 0) {
      const earliest = endOf(items[i - 1]!) + travelOf(item, i);
      if (item.startMinute < earliest) issues.push({ type: "OVERLAP", itemId: item.id, minutes: earliest - item.startMinute });
    }
    if (endOf(item) > DAY_END + 1) issues.push({ type: "PAST_MIDNIGHT", itemId: item.id, minutes: endOf(item) - (DAY_END + 1) });
  });
  return issues;
}

/**
 * Pushes stops later (never earlier) so each one starts after the previous stop ends plus
 * travel. Items before `fromIndex`, finished items and fixed bookings keep their times. A stop
 * that would run into a booking goes after it instead (so the returned order can change; sort
 * `items` by time). `blocked` lists bookings that still clash with something that cannot move.
 */
export function reflowDay(items: ScheduleItem[], fromIndex = 0) {
  const result = items.map((i) => ({ ...i }));
  const changes: ScheduleChange[] = [];
  const blocked: string[] = [];
  const bookings = result.filter((i) => i.isFixed);
  let clock = -Infinity; // end of everything placed so far
  let pinned = -Infinity; // end of what cannot move (done, before fromIndex, bookings)
  for (let i = 0; i < result.length; i++) {
    const item = result[i]!;
    const travel = travelOf(item, i);
    if (i < fromIndex || item.status === "DONE" || item.isFixed) {
      if (item.isFixed && item.startMinute < pinned + travel) blocked.push(item.id);
      clock = Math.max(clock, endOf(item));
      pinned = Math.max(pinned, endOf(item));
      continue;
    }
    let start = Math.max(item.startMinute, clock + travel);
    let duration = item.durationMinutes;
    // A stop running into a booking is shortened to end in time (plus the trip to the booking);
    // only when too little would be left does it move to after the booking.
    for (let guard = 0; guard < bookings.length; guard++) {
      // Ending right at a booking's start still leaves no time to get there.
      const hit = bookings.find(
        (b) => start < endOf(b) && start + duration + (b.startMinute >= start ? (b.travelMinutesFromPrev ?? DEFAULT_TRAVEL_MINUTES) : 0) > b.startMinute,
      );
      if (!hit) break;
      const room = hit.startMinute - (hit.travelMinutesFromPrev ?? DEFAULT_TRAVEL_MINUTES) - start;
      if (room >= Math.min(MIN_STAY, duration)) {
        duration = room;
        break;
      }
      start = endOf(hit) + DEFAULT_TRAVEL_MINUTES;
    }
    if (start !== item.startMinute || duration !== item.durationMinutes) {
      changes.push({
        id: item.id,
        from: item.startMinute,
        to: start,
        ...(duration !== item.durationMinutes ? { durationTo: duration } : {}),
      });
      item.startMinute = start;
      item.durationMinutes = duration;
    }
    clock = Math.max(clock, endOf(item));
  }
  const maxDelay = changes.reduce((m, c) => Math.max(m, c.to - c.from), 0);
  const overflow = result.filter((i) => endOf(i) > DAY_END + 1).map((i) => i.id);
  return { items: result, changes, maxDelay, overflow, blocked };
}

/** Whether [start, end) comes within `slack` minutes of any fixed window. */
export function clashesWithFixed(start: number, end: number, fixed: { start: number; end: number }[], slack = 15): boolean {
  return fixed.some((f) => start < f.end + slack && end > f.start - slack);
}

/**
 * Moves an item to `toIndex` within a list. The moved stop takes over the time slot of the
 * stop it displaced, which matches what people expect when dragging ("put this at 11:00").
 */
export function moveWithinDay<T extends ScheduleItem>(items: T[], itemId: string, toIndex: number): T[] {
  const from = items.findIndex((i) => i.id === itemId);
  if (from === -1) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  const index = Math.min(Math.max(toIndex, 0), next.length);
  const slotOwner = items[index];
  // A booking keeps its slot; the moved stop keeps its own time and gets sorted out by reflow.
  const takeSlot = slotOwner && index !== from && !slotOwner.isFixed;
  next.splice(index, 0, { ...moved!, startMinute: takeSlot ? slotOwner.startMinute : moved!.startMinute });
  return next;
}

export function minuteFromTime(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** "1시간 20분" style for delay messages. */
export function formatDelay(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}
