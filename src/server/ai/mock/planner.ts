import "server-only";
import type { PlaceCategory, TravelStyle } from "@/generated/prisma/enums";
import { estimateTravelMinutes, haversineKm, suggestMode } from "@/lib/geo";
import { clashesWithFixed } from "@/lib/schedule";
import { formatMinute } from "@/lib/itinerary";
import type { PlanDraft, PlanItemDraft } from "../schemas/planner";
import type { PlannerContext } from "../trip-planner-context";
import { type City, type Poi, convertCurrency, findCity } from "./poi-catalog";

type SlotKind = "sight" | "lunch" | "dinner" | "cafe" | "evening";
interface Slot {
  at: number;
  kind: SlotKind;
}

const h = (hh: number, mm = 0) => hh * 60 + mm;

const SLOTS: Record<PlannerContext["pace"], Slot[]> = {
  RELAXED: [
    { at: h(10), kind: "sight" },
    { at: h(12, 30), kind: "lunch" },
    { at: h(14, 30), kind: "sight" },
    { at: h(16, 30), kind: "cafe" },
    { at: h(18, 30), kind: "dinner" },
  ],
  MODERATE: [
    { at: h(9, 30), kind: "sight" },
    { at: h(11, 15), kind: "sight" },
    { at: h(12, 45), kind: "lunch" },
    { at: h(14, 30), kind: "sight" },
    { at: h(16, 30), kind: "cafe" },
    { at: h(18, 30), kind: "dinner" },
    { at: h(20, 30), kind: "evening" },
  ],
  PACKED: [
    { at: h(8, 30), kind: "sight" },
    { at: h(10, 15), kind: "sight" },
    { at: h(12), kind: "lunch" },
    { at: h(13, 30), kind: "sight" },
    { at: h(15, 15), kind: "sight" },
    { at: h(17), kind: "cafe" },
    { at: h(18, 30), kind: "dinner" },
    { at: h(20, 30), kind: "evening" },
  ],
};

const STYLE_CATEGORY: Partial<Record<TravelStyle, PlaceCategory[]>> = {
  SIGHTSEEING: ["SIGHTSEEING", "CULTURE"],
  NATURE: ["NATURE"],
  CULTURE: ["CULTURE"],
  SHOPPING: ["SHOPPING"],
  ACTIVITY: ["ACTIVITY"],
  RELAXATION: ["NATURE", "CAFE"],
};

/** Synthetic places for destinations outside the catalog, scattered around the centre. */
function genericCity(ctx: PlannerContext): City {
  const c = ctx.center ?? { lat: 0, lng: 0 };
  const d = ctx.destination;
  const at = (i: number) => ({ lat: c.lat + Math.sin(i * 1.7) * 0.02, lng: c.lng + Math.cos(i * 1.3) * 0.025 });
  const mk = (i: number, name: string, category: PlaceCategory, minutes: number, indoor: boolean, tags?: string[]): Poi => ({
    name,
    category,
    minutes,
    indoor,
    cost: 0,
    address: d,
    tags,
    ...at(i),
  });
  return {
    key: "generic",
    match: /$^/,
    currency: ctx.currency,
    center: c,
    pois: [
      mk(1, `${d} 구시가지 산책`, "SIGHTSEEING", 90, false),
      mk(2, `${d} 대표 박물관`, "CULTURE", 120, true),
      mk(3, `${d} 전망대`, "SIGHTSEEING", 60, false, ["view"]),
      mk(4, `${d} 중앙 공원`, "NATURE", 60, false),
      mk(5, `${d} 전통 시장`, "SHOPPING", 75, false),
      mk(6, `${d} 쇼핑 거리`, "SHOPPING", 90, true),
      mk(7, `${d} 로컬 맛집`, "FOOD", 60, true),
      mk(8, `${d} 현지 식당`, "FOOD", 75, true),
      mk(9, `${d} 야시장`, "FOOD", 90, false, ["night"]),
      mk(10, `${d} 인기 카페`, "CAFE", 45, true),
      mk(11, `${d} 미술관`, "CULTURE", 90, true),
      mk(12, `${d} 해질녘 명소`, "NATURE", 60, false, ["view"]),
    ],
  };
}

function matchesAny(text: string, words: string[]) {
  const t = text.toLowerCase();
  return words.some((w) => w && (t.includes(w.toLowerCase()) || w.toLowerCase().includes(t)));
}

function score(poi: Poi, kind: SlotKind, ctx: PlannerContext, prev: Poi | null, rainy: boolean): number {
  let s = 0;
  const preferredCats = ctx.styles.flatMap((st) => STYLE_CATEGORY[st] ?? []);
  if (preferredCats.includes(poi.category)) s += 4;
  if (ctx.styles.includes("PHOTO") && poi.tags?.some((t) => t === "photo" || t === "view")) s += 3;
  if (matchesAny(poi.name, ctx.preferredPlaces)) s += 12;
  if ((kind === "lunch" || kind === "dinner") && poi.tags && matchesAny(poi.tags.join(" "), ctx.preferredFoods)) s += 6;
  if (kind === "evening" && poi.tags?.some((t) => ["night", "view", "izakaya"].includes(t))) s += 4;
  if (rainy && !poi.indoor) s -= 6;
  if (ctx.budgetLevel === "BUDGET") s -= poi.cost > 3000 ? 1 : 0;
  if (prev) s -= haversineKm(prev, poi) * 0.8;
  return s;
}

function categoriesFor(kind: SlotKind): PlaceCategory[] {
  switch (kind) {
    case "lunch":
    case "dinner":
      return ["FOOD"];
    case "cafe":
      return ["CAFE"];
    case "evening":
      return ["SIGHTSEEING", "SHOPPING", "FOOD", "NATURE"];
    default:
      return ["SIGHTSEEING", "CULTURE", "NATURE", "SHOPPING", "ACTIVITY"];
  }
}

function reasonFor(poi: Poi, kind: SlotKind, ctx: PlannerContext, rainy: boolean): string | null {
  if (matchesAny(poi.name, ctx.preferredPlaces)) return "가고 싶다고 한 곳이에요.";
  if ((kind === "lunch" || kind === "dinner") && poi.tags && matchesAny(poi.tags.join(" "), ctx.preferredFoods)) {
    return "좋아하는 음식을 반영했어요.";
  }
  if (rainy && poi.indoor && kind === "sight") return "비 예보가 있어 실내 장소로 골랐어요.";
  if (ctx.styles.includes("PHOTO") && poi.tags?.includes("photo")) return "사진 찍기 좋은 곳이에요.";
  if (poi.tags?.includes("view")) return "전망이 좋은 곳이에요.";
  return null;
}

export function mockPlan(ctx: PlannerContext): PlanDraft {
  const tripCity = findCity(ctx.destination) ?? genericCity(ctx);
  const used = new Set(ctx.existing.map((t) => t.trim()));
  const days: PlanDraft["days"] = [];

  for (const day of ctx.days) {
    // A day the traveller titled with a city ("교토 · 아라시야마") is planned in that city.
    const city = (day.hint ? findCity(day.hint) : undefined) ?? tripCity;
    let slots = SLOTS[ctx.pace];
    const items: PlanItemDraft[] = [];
    let prev: Poi | null = null;
    let clock = slots[0]!.at;
    const fixed = day.fixed ?? [];
    // A booked flight replaces the guessed airport times.
    const arrival = day.isFirst ? fixed.find((f) => f.category === "AIRPORT") : undefined;
    const departure = day.isLast ? fixed.filter((f) => f.category === "AIRPORT").at(-1) : undefined;
    const cutoff = departure ? departure.start - 60 : h(13);
    const checkIn = arrival ? Math.ceil((arrival.end + 60) / 5) * 5 : h(13);

    if (day.isFirst && (ctx.totalDays > 1 || arrival)) {
      slots = slots.filter((s) => s.at >= checkIn);
      // Arrival: from the airport into town, then drop the bags.
      if (city.airport && !arrival) {
        items.push({
          title: `${city.airport.name} 도착 · 시내로 이동`,
          category: "AIRPORT",
          startTime: "11:30",
          durationMinutes: 60,
          transportMode: "TRANSIT",
          travelMinutesFromPrev: null,
          estimatedCost: null,
          address: city.airport.address,
          latitude: city.airport.lat,
          longitude: city.airport.lng,
          isIndoor: true,
          note: "입국 심사와 짐 찾기 후 공항철도나 리무진 버스로 시내에 들어가요. 항공편 시간에 맞춰 조정해 주세요.",
        });
      }
      items.push({
        title: "숙소 체크인 · 짐 맡기기",
        category: "LODGING",
        startTime: formatMinute(checkIn),
        durationMinutes: 30,
        transportMode: null,
        travelMinutesFromPrev: null,
        estimatedCost: null,
        address: null,
        latitude: null,
        longitude: null,
        isIndoor: true,
        note: "도착 후 가볍게 시작해요.",
      });
      clock = checkIn + 30;
    }
    const leaving = day.isLast && (ctx.totalDays > 1 || Boolean(departure));
    if (leaving) slots = slots.filter((s) => s.at < cutoff);

    for (const slot of slots) {
      const cats = categoriesFor(slot.kind);
      const candidates = city.pois.filter(
        (poi) => cats.includes(poi.category) && !used.has(poi.name) && !(leaving && poi.minutes > 150),
      );
      if (candidates.length === 0) continue;
      const best = candidates
        .map((poi) => ({ poi, s: score(poi, slot.kind, ctx, prev, day.rainy && slot.at >= h(12)) }))
        .sort((a, b) => b.s - a.s)[0]!.poi;

      const travel = prev ? estimateTravelMinutes(prev, best, suggestMode(prev, best)) : null;
      const start = Math.max(slot.at, clock + (travel ?? 0));
      const rounded = Math.ceil(start / 5) * 5;
      if (rounded + best.minutes > h(22, 30)) break;
      // Departure day: only what fits before heading to the airport.
      if (leaving && rounded + best.minutes > cutoff) continue;
      if (clashesWithFixed(rounded, rounded + best.minutes, fixed)) continue;

      used.add(best.name);
      const perPerson = convertCurrency(best.cost, city.currency, ctx.currency);
      items.push({
        title: best.name,
        category: best.category,
        startTime: formatMinute(rounded),
        durationMinutes: best.minutes,
        transportMode: prev ? suggestMode(prev, best) : null,
        travelMinutesFromPrev: travel,
        estimatedCost: perPerson > 0 ? perPerson * ctx.travelerCount : null,
        address: best.address,
        latitude: best.lat,
        longitude: best.lng,
        isIndoor: best.indoor,
        note: reasonFor(best, slot.kind, ctx, day.rainy),
      });
      prev = best;
      clock = rounded + best.minutes;
    }

    if (day.isLast && ctx.totalDays > 1 && city.airport && !departure) {
      const travel = prev ? estimateTravelMinutes(prev, city.airport, "TRANSIT") : null;
      const start = Math.ceil(Math.max(clock + (travel ?? 0), h(13)) / 5) * 5;
      items.push({
        // The ride itself is the travel leg before this item; this is the time at the airport.
        title: `${city.airport.name} 도착 · 출국 수속`,
        category: "AIRPORT",
        startTime: formatMinute(start),
        durationMinutes: 120,
        transportMode: "TRANSIT",
        travelMinutesFromPrev: travel,
        estimatedCost: null,
        address: city.airport.address,
        latitude: city.airport.lat,
        longitude: city.airport.lng,
        isIndoor: true,
        note: "국제선은 출발 2시간 전 도착이 기본이에요. 항공편 시간에 맞춰 조정해 주세요.",
      });
    }

    const highlights = items.filter((i) => !["FOOD", "CAFE", "LODGING", "AIRPORT"].includes(i.category)).slice(0, 2);
    days.push({
      dayNumber: day.dayNumber,
      title: day.isLast && ctx.totalDays > 1 ? "마무리 · 귀국" : highlights.map((i) => i.title.split(" ")[0]).join(" · ") || "자유 일정",
      items,
    });
  }

  const paceLabel = { RELAXED: "여유로운", MODERATE: "적당한", PACKED: "알찬" }[ctx.pace];
  return {
    summary: `${ctx.destination}에서 ${paceLabel} 속도로 ${ctx.days.length}일 일정을 만들었어요. 가까운 곳끼리 묶어 이동을 줄였어요.`,
    days,
  };
}
