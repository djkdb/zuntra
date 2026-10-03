import type { ItineraryItemView } from "@/lib/itinerary";

/**
 * Fixed sample trip for the landing page and Demo Mode.
 * Lives entirely in code — never written to or read from the user database.
 */
export interface DemoDay {
  dayNumber: number;
  date: string;
  title: string;
  weather: { condition: "sunny" | "cloudy" | "rain"; tempMax: number; tempMin: number; precipitation: number };
  items: ItineraryItemView[];
}

let seq = 0;
const item = (
  startMinute: number,
  title: string,
  category: ItineraryItemView["category"],
  durationMinutes: number,
  travel: [number, ItineraryItemView["transportMode"]] | null,
  extra: Partial<ItineraryItemView> = {},
): ItineraryItemView => ({
  id: `demo-${++seq}`,
  title,
  category,
  startMinute,
  durationMinutes,
  travelMinutesFromPrev: travel?.[0] ?? null,
  transportMode: travel?.[1] ?? null,
  estimatedCost: null,
  note: null,
  status: "PLANNED",
  ...extra,
});

const h = (hh: number, mm = 0) => hh * 60 + mm;

/**
 * The demo runs on a fixed clock (Day 2, 15:50 in Tokyo) so it always shows the most
 * interesting moment of the day, whatever time the visitor opens it.
 */
export const DEMO_NOW_MINUTE = 15 * 60 + 50;

export const DEMO_TRIP = {
  id: "demo-tokyo",
  title: "Tokyo 5 Days",
  destination: "도쿄",
  timezone: "Asia/Tokyo",
  startDate: "2026-11-03",
  endDate: "2026-11-07",
  travelerCount: 2,
  currency: "JPY",
  budgetAmount: 300_000,
  spentAmount: 128_400,
  styles: ["FOOD", "PHOTO", "RELAXATION"] as const,
  days: [
    {
      dayNumber: 1,
      date: "2026-11-03",
      title: "도착 · 시부야",
      weather: { condition: "sunny", tempMax: 19, tempMin: 11, precipitation: 10 },
      items: [
        item(h(9), "하네다 공항 도착", "AIRPORT", 60, null),
        item(h(12), "호텔 체크인 · 시부야", "LODGING", 45, [40, "TRANSIT"], { address: "Shibuya, Tokyo" }),
        item(h(13), "점심 · 이치란 라멘", "FOOD", 60, [8, "WALK"], { estimatedCost: 1_400 }),
        item(h(15), "시부야 스크램블 & 스카이", "SIGHTSEEING", 120, [6, "WALK"], { estimatedCost: 2_500 }),
        item(h(17, 30), "카페 · 푸글렌", "CAFE", 60, [15, "WALK"], { estimatedCost: 900 }),
        item(h(19), "저녁 · 이자카야", "FOOD", 90, [12, "TRANSIT"], { estimatedCost: 4_500 }),
        item(h(21), "호텔 휴식", "LODGING", 0, [10, "WALK"]),
      ],
    },
    {
      dayNumber: 2,
      date: "2026-11-04",
      title: "아사쿠사 · 우에노",
      weather: { condition: "cloudy", tempMax: 17, tempMin: 10, precipitation: 30 },
      items: [
        item(h(9), "아사쿠사 센소지", "CULTURE", 90, null, { status: "DONE" }),
        item(h(11, 30), "점심 · 텐동", "FOOD", 60, [5, "WALK"], { status: "DONE", estimatedCost: 1_800 }),
        item(h(14), "우에노 공원 산책", "NATURE", 90, [18, "TRANSIT"], { status: "IN_PROGRESS" }),
        item(h(16), "아메요코 시장", "SHOPPING", 90, [8, "WALK"]),
        item(h(19), "저녁 · 야키토리", "FOOD", 90, [20, "TRANSIT"], { estimatedCost: 3_800 }),
      ],
    },
    {
      dayNumber: 3,
      date: "2026-11-05",
      title: "오다이바",
      weather: { condition: "rain", tempMax: 15, tempMin: 11, precipitation: 80 },
      items: [
        item(h(10), "츠키지 장외시장 브런치", "FOOD", 90, null, { estimatedCost: 3_000 }),
        item(h(13), "팀랩 플래닛", "CULTURE", 120, [25, "TRANSIT"], { estimatedCost: 3_800 }),
        item(h(16), "오다이바 해변공원", "NATURE", 60, [15, "TRANSIT"]),
        item(h(18, 30), "저녁 · 몬자야키", "FOOD", 90, [30, "TRANSIT"], { estimatedCost: 3_200 }),
      ],
    },
    {
      dayNumber: 4,
      date: "2026-11-06",
      title: "하라주쿠 · 오모테산도",
      weather: { condition: "sunny", tempMax: 20, tempMin: 12, precipitation: 0 },
      items: [
        item(h(10), "메이지 신궁", "CULTURE", 75, null),
        item(h(11, 30), "다케시타 거리", "SHOPPING", 60, [7, "WALK"]),
        item(h(13), "점심 · 규카츠", "FOOD", 60, [10, "WALK"], { estimatedCost: 2_000 }),
        item(h(15), "오모테산도 카페 투어", "CAFE", 120, [8, "WALK"], { estimatedCost: 1_600 }),
        item(h(19), "저녁 · 스시 오마카세", "FOOD", 120, [20, "TRANSIT"], { estimatedCost: 12_000 }),
      ],
    },
    {
      dayNumber: 5,
      date: "2026-11-07",
      title: "귀국",
      weather: { condition: "cloudy", tempMax: 18, tempMin: 11, precipitation: 20 },
      items: [
        item(h(9), "체크아웃", "LODGING", 30, null),
        item(h(10), "긴자 기념품 쇼핑", "SHOPPING", 90, [20, "TRANSIT"]),
        item(h(13), "하네다 공항", "AIRPORT", 120, [35, "TRANSIT"]),
      ],
    },
  ] satisfies DemoDay[],
};
