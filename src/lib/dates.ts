import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";

/**
 * Trip dates are calendar dates (no time, no zone) and travel through the app as
 * `YYYY-MM-DD` strings. Postgres stores them as DATE; Prisma hands them back as
 * UTC-midnight Date objects, so conversions always go through UTC.
 */
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function toDbDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function fromDbDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const d = toDbDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromDbDate(d);
}

/** Number of days between two ISO dates (end - start). */
export function diffDaysIso(startIso: string, endIso: string): number {
  return Math.round((toDbDate(endIso).getTime() - toDbDate(startIso).getTime()) / 86_400_000);
}

/** Every date from start to end inclusive. */
export function eachDateIso(startIso: string, endIso: string): string[] {
  const length = diffDaysIso(startIso, endIso) + 1;
  return Array.from({ length: Math.max(length, 0) }, (_, i) => addDaysIso(startIso, i));
}

/** Today's calendar date in an IANA time zone, e.g. the trip destination's. */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export type TripPhase = "upcoming" | "ongoing" | "past" | "completed";

export function getTripPhase(
  trip: { startDate: string; endDate: string; status: string },
  today: string,
): TripPhase {
  if (trip.status === "COMPLETED") return "completed";
  if (today < trip.startDate) return "upcoming";
  if (today > trip.endDate) return "past";
  return "ongoing";
}

/** "4박 5일" (or "당일치기" for single-day trips). */
export function formatTripLength(startIso: string, endIso: string): string {
  const nights = diffDaysIso(startIso, endIso);
  if (nights <= 0) return "당일치기";
  return `${nights}박 ${nights + 1}일`;
}

export function formatDateRange(startIso: string, endIso: string): string {
  const start = parseISO(startIso);
  const end = parseISO(endIso);
  if (startIso === endIso) return format(start, "yyyy년 M월 d일 (EEE)", { locale: ko });
  if (start.getFullYear() !== end.getFullYear()) {
    return `${format(start, "yyyy. M. d.", { locale: ko })} – ${format(end, "yyyy. M. d.", { locale: ko })}`;
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${format(start, "yyyy년 M월 d일", { locale: ko })} – ${format(end, "M월 d일", { locale: ko })}`;
  }
  return `${format(start, "yyyy년 M월 d일", { locale: ko })} – ${format(end, "d일", { locale: ko })}`;
}

export function formatShortDate(iso: string): string {
  return format(parseISO(iso), "M월 d일 (EEE)", { locale: ko });
}

/** Days until the trip starts, relative to `today` (both ISO dates). */
export function daysUntil(startIso: string, today: string): number {
  return differenceInCalendarDays(parseISO(startIso), parseISO(today));
}

/** "D-12", "D-DAY", "D+3" */
export function formatDDay(startIso: string, today: string): string {
  const d = daysUntil(startIso, today);
  if (d === 0) return "D-DAY";
  return d > 0 ? `D-${d}` : `D+${Math.abs(d)}`;
}

/** Minutes after local midnight in an IANA time zone. */
export function nowMinuteInTimeZone(timeZone: string, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}
