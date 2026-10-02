import type { ItineraryItemStatus, PlaceCategory, TransportMode } from "@/generated/prisma/enums";

/** Client-safe itinerary item shape shared by the timeline, demo data and (later) the plan API. */
export interface ItineraryItemView {
  id: string;
  title: string;
  category: PlaceCategory;
  startMinute: number;
  durationMinutes: number;
  travelMinutesFromPrev: number | null;
  transportMode: TransportMode | null;
  estimatedCost: number | null;
  address?: string | null;
  note: string | null;
  status: ItineraryItemStatus;
}

export function formatMinute(minute: number): string {
  const h = Math.floor(minute / 60) % 24;
  const m = minute % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

export const CATEGORY_LABELS: Record<PlaceCategory, string> = {
  SIGHTSEEING: "관광",
  FOOD: "식사",
  CAFE: "카페",
  SHOPPING: "쇼핑",
  NATURE: "자연",
  CULTURE: "문화",
  ACTIVITY: "액티비티",
  LODGING: "숙소",
  AIRPORT: "공항",
  TRANSPORT: "이동",
  OTHER: "기타",
};

export const TRANSPORT_LABELS: Record<TransportMode, string> = {
  WALK: "도보",
  TRANSIT: "대중교통",
  BUS: "버스",
  TRAIN: "기차",
  TAXI: "택시",
  CAR: "차량",
  BIKE: "자전거",
  FLIGHT: "항공",
  OTHER: "이동",
};
