import "server-only";
import type { PlaceCategory, TransportMode, TravelPace } from "@/generated/prisma/enums";
import { estimateTravelMinutes, haversineKm, suggestMode } from "@/lib/geo";
import { DAY_START, minuteFromTime, reflowDay } from "@/lib/schedule";
import type { PlanDraft } from "./schemas/planner";

export interface ValidPlanItem {
  title: string;
  category: PlaceCategory;
  startMinute: number;
  durationMinutes: number;
  transportMode: TransportMode | null;
  travelMinutesFromPrev: number | null;
  estimatedCost: number | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  isIndoor: boolean | null;
  note: string | null;
}

export interface ValidPlanDay {
  dayNumber: number;
  title: string;
  items: ValidPlanItem[];
}

const MAX_ITEMS: Record<TravelPace, number> = { RELAXED: 6, MODERATE: 8, PACKED: 10 };
const LATEST_END = 23 * 60 + 30;
const MAX_DISTANCE_KM = 150;

/**
 * The validation layer between any planner (model or mock) and the database. It never trusts
 * the draft: unknown days are dropped, times are parsed and sorted, coordinates far from the
 * destination are discarded, travel time is re-estimated when it looks too optimistic, the
 * pace limit is enforced, overlaps are pushed apart, and stops that would end too late are cut.
 */
export function validatePlan(
  draft: PlanDraft,
  options: {
    dayNumbers: number[];
    pace: TravelPace;
    center: { lat: number; lng: number } | null;
    /** Per-day base (a multi-city trip's Kyoto day is checked against Kyoto, not Osaka). */
    centers?: Map<number, { lat: number; lng: number }>;
  },
): { days: ValidPlanDay[]; warnings: string[] } {
  const warnings: string[] = [];
  const wanted = new Set(options.dayNumbers);
  const seenDays = new Set<number>();
  const seenTitles = new Set<string>();
  const days: ValidPlanDay[] = [];

  for (const day of draft.days) {
    if (!wanted.has(day.dayNumber) || seenDays.has(day.dayNumber)) continue;
    seenDays.add(day.dayNumber);

    const center = options.centers?.get(day.dayNumber) ?? options.center;
    let items: ValidPlanItem[] = [];
    for (const raw of day.items) {
      const startMinute = minuteFromTime(raw.startTime);
      if (startMinute === null) continue;
      const title = raw.title.trim();
      if (!title || seenTitles.has(title)) continue;
      seenTitles.add(title);

      let { latitude, longitude } = raw;
      if (latitude === null || longitude === null) {
        latitude = null;
        longitude = null;
      } else if (center && haversineKm(center, { lat: latitude, lng: longitude }) > MAX_DISTANCE_KM) {
        latitude = null;
        longitude = null;
        warnings.push(`'${title}'의 위치가 여행지와 멀어 좌표를 제외했어요.`);
      }

      items.push({
        title,
        category: raw.category,
        startMinute: Math.max(startMinute, DAY_START),
        durationMinutes: Math.min(Math.max(raw.durationMinutes, 0), 480),
        transportMode: raw.transportMode,
        travelMinutesFromPrev: raw.travelMinutesFromPrev,
        estimatedCost: raw.estimatedCost !== null && raw.estimatedCost >= 0 ? Math.round(raw.estimatedCost) : null,
        address: raw.address?.trim() || null,
        latitude,
        longitude,
        isIndoor: raw.isIndoor,
        note: raw.note?.trim() || null,
      });
    }

    items.sort((a, b) => a.startMinute - b.startMinute);

    if (items.length > MAX_ITEMS[options.pace]) {
      warnings.push(`${day.dayNumber}일차: 여행 속도에 맞춰 일정을 ${MAX_ITEMS[options.pace]}개로 줄였어요.`);
      items = items.slice(0, MAX_ITEMS[options.pace]);
    }

    // Travel times: estimate when missing, and don't accept times far below a straight-line estimate.
    items.forEach((item, i) => {
      if (i === 0) {
        item.travelMinutesFromPrev = null;
        return;
      }
      const prev = items[i - 1]!;
      if (prev.latitude !== null && item.latitude !== null) {
        const from = { lat: prev.latitude, lng: prev.longitude! };
        const to = { lat: item.latitude, lng: item.longitude! };
        const mode = item.transportMode ?? suggestMode(from, to);
        const estimate = estimateTravelMinutes(from, to, mode);
        if (item.travelMinutesFromPrev === null || item.travelMinutesFromPrev < estimate * 0.5) {
          item.travelMinutesFromPrev = estimate;
          item.transportMode = mode;
        }
      }
    });

    // Remove impossible overlaps, then drop stops that end too late.
    const reflowed = reflowDay(items.map((it, i) => ({ ...it, id: String(i) })));
    if (reflowed.changes.length > 0) {
      warnings.push(`${day.dayNumber}일차: 이동시간을 고려해 ${reflowed.changes.length}개 일정의 시간을 조정했어요.`);
    }
    const adjusted: ValidPlanItem[] = reflowed.items.map((it) => {
      const { id, ...rest } = it;
      void id;
      return rest as ValidPlanItem;
    });
    const kept = adjusted.filter((it) => it.startMinute + it.durationMinutes <= LATEST_END);
    if (kept.length < adjusted.length) {
      warnings.push(`${day.dayNumber}일차: 늦은 시간까지 이어지는 일정 ${adjusted.length - kept.length}개를 제외했어요.`);
    }

    days.push({ dayNumber: day.dayNumber, title: day.title.trim().slice(0, 40), items: kept });
  }

  for (const n of options.dayNumbers) {
    if (!seenDays.has(n)) warnings.push(`${n}일차 일정이 만들어지지 않았어요.`);
  }
  return { days: days.sort((a, b) => a.dayNumber - b.dayNumber), warnings };
}
