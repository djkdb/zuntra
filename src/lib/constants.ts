import {
  BudgetLevel,
  CompanionType,
  TravelPace,
  TravelStyle,
  TripMemberRole,
} from "@/generated/prisma/enums";

export const APP_NAME = "TripMate";

export const MAX_TRIP_DAYS = 30;
export const MAX_TRAVELERS = 50;

export const TRAVEL_STYLE_LABELS: Record<TravelStyle, string> = {
  SIGHTSEEING: "관광 중심",
  FOOD: "맛집 중심",
  RELAXATION: "휴식 중심",
  NATURE: "자연",
  SHOPPING: "쇼핑",
  PHOTO: "사진",
  ACTIVITY: "액티비티",
  CULTURE: "문화",
};

export const TRAVEL_PACE_LABELS: Record<TravelPace, { label: string; description: string }> = {
  RELAXED: { label: "느긋하게", description: "하루 2–3곳, 여유 시간 넉넉히" },
  MODERATE: { label: "보통", description: "하루 3–5곳, 적당한 휴식" },
  PACKED: { label: "빡빡하게", description: "최대한 많이 보고 경험하기" },
};

export const BUDGET_LEVEL_LABELS: Record<BudgetLevel, { label: string; description: string }> = {
  BUDGET: { label: "가성비", description: "아낄 곳은 확실히 아끼기" },
  STANDARD: { label: "보통", description: "균형 잡힌 소비" },
  LUXURY: { label: "여유롭게", description: "경험에 아낌없이" },
};

export const COMPANION_TYPE_LABELS: Record<CompanionType, string> = {
  SOLO: "혼자",
  FRIENDS: "친구",
  PARTNER: "연인",
  FAMILY: "가족",
  GROUP: "단체",
};

export const TRIP_MEMBER_ROLE_LABELS: Record<TripMemberRole, string> = {
  OWNER: "소유자",
  EDITOR: "편집자",
  VIEWER: "보기 전용",
};

export const TRAVEL_STYLES = Object.values(TravelStyle);
export const TRAVEL_PACES = Object.values(TravelPace);
export const BUDGET_LEVELS = Object.values(BudgetLevel);
export const COMPANION_TYPES = Object.values(CompanionType);

export const CURRENCIES = [
  { code: "KRW", label: "원 (KRW)" },
  { code: "JPY", label: "엔 (JPY)" },
  { code: "USD", label: "달러 (USD)" },
  { code: "EUR", label: "유로 (EUR)" },
  { code: "CNY", label: "위안 (CNY)" },
  { code: "TWD", label: "대만 달러 (TWD)" },
  { code: "THB", label: "바트 (THB)" },
  { code: "VND", label: "동 (VND)" },
  { code: "GBP", label: "파운드 (GBP)" },
  { code: "AUD", label: "호주 달러 (AUD)" },
] as const;

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as [string, ...string[]];

/** Destination-local time zones offered in the trip form. */
export const TIME_ZONES = [
  { id: "Asia/Seoul", label: "서울 (UTC+9)" },
  { id: "Asia/Tokyo", label: "도쿄 (UTC+9)" },
  { id: "Asia/Shanghai", label: "상하이·베이징 (UTC+8)" },
  { id: "Asia/Taipei", label: "타이베이 (UTC+8)" },
  { id: "Asia/Hong_Kong", label: "홍콩 (UTC+8)" },
  { id: "Asia/Singapore", label: "싱가포르 (UTC+8)" },
  { id: "Asia/Manila", label: "마닐라·세부 (UTC+8)" },
  { id: "Asia/Bangkok", label: "방콕 (UTC+7)" },
  { id: "Asia/Ho_Chi_Minh", label: "호찌민·다낭 (UTC+7)" },
  { id: "Asia/Makassar", label: "발리 (UTC+8)" },
  { id: "Pacific/Guam", label: "괌·사이판 (UTC+10)" },
  { id: "Australia/Sydney", label: "시드니" },
  { id: "Europe/London", label: "런던" },
  { id: "Europe/Paris", label: "파리·로마·바르셀로나" },
  { id: "America/New_York", label: "뉴욕" },
  { id: "America/Los_Angeles", label: "로스앤젤레스" },
  { id: "Pacific/Honolulu", label: "하와이" },
] as const;
