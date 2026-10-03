export type WeatherCondition = "clear" | "partly_cloudy" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm";

export const WEATHER_LABELS: Record<WeatherCondition, string> = {
  clear: "맑음",
  partly_cloudy: "구름 조금",
  cloudy: "흐림",
  fog: "안개",
  drizzle: "이슬비",
  rain: "비",
  snow: "눈",
  storm: "뇌우",
};

export function weatherLabel(condition: string): string {
  return WEATHER_LABELS[condition as WeatherCondition] ?? condition;
}

/** WMO weather interpretation codes (used by Open-Meteo). */
export function conditionFromWmo(code: number): WeatherCondition {
  if (code === 0) return "clear";
  if (code <= 2) return "partly_cloudy";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "cloudy";
}

export const RAIN_THRESHOLD = 60;

export function isRainy(w: { condition: string; precipitation: number | null }): boolean {
  return (w.precipitation ?? 0) >= RAIN_THRESHOLD || ["rain", "storm"].includes(w.condition);
}

export interface DayWeatherView {
  dayId: string;
  dayNumber: number;
  date: string;
  available: boolean;
  condition: string;
  label: string;
  tempMax: number | null;
  tempMin: number | null;
  precipitation: number | null;
}

export interface RainSuggestion {
  dayId: string;
  dayNumber: number;
  message: string;
  outdoorTitles: string[];
}
