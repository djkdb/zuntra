import "server-only";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/budget";
import { CATEGORY_LABELS, TRANSPORT_LABELS, formatMinute } from "@/lib/itinerary";
import type { BudgetData } from "@/server/services/budget-service";
import type { Itinerary } from "@/server/services/itinerary-service";

/** UTC instant for a wall-clock time in `timeZone` (DST-safe to the minute). */
function zonedToUtc(dateIso: string, minute: number, timeZone: string): Date {
  const [y, m, d] = dateIso.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(y, m - 1, d, Math.floor(minute / 60), minute % 60);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(guess))
      .map((p) => [p.type, p.value]),
  );
  const asLocal = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return new Date(guess - (asLocal - guess));
}

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
// RFC 5545 text: escape \ ; , and newlines, then fold long lines at 75 octets.
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  for (const ch of line) {
    if (new TextEncoder().encode(current + ch).length > (out.length ? 74 : 75)) {
      out.push(current);
      current = ch;
    } else current += ch;
  }
  out.push(current);
  return out.join("\r\n ");
}

/** The itinerary as an iCalendar file: one event per stop, in the destination's time zone. */
export function itineraryToIcs(itinerary: Itinerary): string {
  const { trip } = itinerary;
  const stamp = icsDate(new Date());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TripMate//KO", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${icsText(trip.title)}`];
  for (const day of itinerary.days) {
    for (const item of day.items) {
      const start = zonedToUtc(day.date, item.startMinute, trip.timezone);
      const end = new Date(start.getTime() + Math.max(item.durationMinutes, 15) * 60_000);
      const details = [
        CATEGORY_LABELS[item.category],
        item.transportMode && item.travelMinutesFromPrev !== null ? `${TRANSPORT_LABELS[item.transportMode]}로 ${item.travelMinutesFromPrev}분` : null,
        item.note,
      ].filter(Boolean);
      lines.push(
        "BEGIN:VEVENT",
        `UID:${item.id}@tripmate`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${icsDate(start)}`,
        `DTEND:${icsDate(end)}`,
        `SUMMARY:${icsText(item.title)}`,
        ...(item.address ? [`LOCATION:${icsText(item.address)}`] : []),
        ...(item.latitude != null && item.longitude != null ? [`GEO:${item.latitude};${item.longitude}`] : []),
        ...(details.length ? [`DESCRIPTION:${icsText(details.join("\n"))}`] : []),
        "END:VEVENT",
      );
    }
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

function csv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    // Quote when needed; neutralise spreadsheet formulas (=, +, -, @) in user text.
    const safe = /^[=+\-@]/.test(s) && typeof v === "string" ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  // BOM so Excel opens Korean text as UTF-8.
  return "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export function itineraryToCsv(itinerary: Itinerary): string {
  const rows: (string | number | null)[][] = [["DAY", "날짜", "시작", "끝", "일정", "분류", "이동", "이동(분)", "예상 비용", "주소", "메모", "상태"]];
  for (const day of itinerary.days) {
    for (const i of day.items) {
      rows.push([
        day.dayNumber,
        day.date,
        formatMinute(i.startMinute),
        formatMinute(Math.min(i.startMinute + i.durationMinutes, 1439)),
        i.title,
        CATEGORY_LABELS[i.category],
        i.transportMode ? TRANSPORT_LABELS[i.transportMode] : null,
        i.travelMinutesFromPrev,
        i.estimatedCost,
        i.address ?? null,
        i.note,
        i.status === "DONE" ? "완료" : "",
      ]);
    }
  }
  return csv(rows);
}

export function expensesToCsv(budget: BudgetData): string {
  const currency = budget.summary.currency;
  const group = budget.participants.length >= 2;
  const name = (id: string) => budget.participants.find((p) => p.id === id)?.name ?? "";
  const rows: (string | number | null)[][] = [
    ["날짜", "DAY", "내용", "카테고리", `금액(${currency})`, "낸 금액", "낸 통화", "환율", ...(group ? ["낸 사람", "나눈 사람"] : []), "메모"],
  ];
  for (const e of [...budget.expenses].sort((a, b) => a.date.localeCompare(b.date))) {
    const split = group ? [e.paidById ? name(e.paidById) : "정산 제외", e.paidById ? (e.splitWith.length ? e.splitWith.map(name).join(", ") : "모두") : ""] : [];
    rows.push([e.date, e.dayNumber, e.title, EXPENSE_CATEGORY_LABELS[e.category], e.amount, e.originalAmount, e.originalCurrency, e.fxRate, ...split, e.note]);
  }
  if (group && budget.settlement) {
    rows.push([], ["정산"], ["보내는 사람", "받는 사람", `금액(${currency})`]);
    for (const t of budget.settlement.transfers) rows.push([name(t.fromId), name(t.toId), t.amount]);
  }
  return csv(rows);
}

/** Safe ASCII-ish file name plus RFC 5987 UTF-8 name for the Content-Disposition header. */
export function attachment(name: string, ext: string): string {
  const ascii = `trip.${ext}`;
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(`${name}.${ext}`)}`;
}

