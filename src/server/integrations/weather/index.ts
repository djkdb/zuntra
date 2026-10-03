import "server-only";
import { addDaysIso, diffDaysIso, eachDateIso } from "@/lib/dates";
import type { LatLng } from "@/lib/geo";
import { type WeatherCondition, conditionFromWmo } from "@/lib/weather";
import { env } from "@/server/env";
import { fetchJson } from "../http";

export interface DailyWeather {
  date: string;
  condition: WeatherCondition;
  tempMaxC: number;
  tempMinC: number;
  precipitationProbability: number | null;
}

export interface WeatherProvider {
  readonly name: string;
  /** Forecast for dates within the provider's window; dates outside it are simply absent. */
  getDaily(center: LatLng, startDate: string, endDate: string, timezone: string, today: string): Promise<DailyWeather[]>;
}

export const FORECAST_DAYS = 16;

const openMeteo: WeatherProvider = {
  name: "open-meteo",
  async getDaily(center, startDate, endDate, timezone, today) {
    const lastAvailable = addDaysIso(today, FORECAST_DAYS - 1);
    const from = startDate < today ? today : startDate;
    const to = endDate > lastAvailable ? lastAvailable : endDate;
    if (diffDaysIso(from, to) < 0) return [];
    const params = new URLSearchParams({
      latitude: center.lat.toFixed(4),
      longitude: center.lng.toFixed(4),
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      timezone,
      start_date: from,
      end_date: to,
    });
    const data = await fetchJson<{
      daily?: {
        time: string[];
        weather_code: number[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_probability_max: (number | null)[];
      };
    }>(`https://api.open-meteo.com/v1/forecast?${params}`, { timeoutMs: 5000 });
    const d = data.daily;
    if (!d) return [];
    return d.time.map((date, i) => ({
      date,
      condition: conditionFromWmo(d.weather_code[i] ?? 3),
      tempMaxC: Math.round((d.temperature_2m_max[i] ?? 0) * 10) / 10,
      tempMinC: Math.round((d.temperature_2m_min[i] ?? 0) * 10) / 10,
      precipitationProbability: d.precipitation_probability_max[i] ?? null,
    }));
  },
};

/** Deterministic weather for tests, demo and offline development (every 3rd day is rainy). */
const mockWeather: WeatherProvider = {
  name: "mock",
  async getDaily(center, startDate, endDate) {
    return eachDateIso(startDate, endDate).map((date, i) => {
      const seed = (Number(date.replaceAll("-", "")) + Math.round(center.lat * 10)) % 7;
      const rainy = i % 3 === 2;
      const base = 18 + (seed % 5);
      return {
        date,
        condition: rainy ? "rain" : seed % 2 === 0 ? "clear" : "partly_cloudy",
        tempMaxC: base + 4,
        tempMinC: base - 5,
        precipitationProbability: rainy ? 80 : seed * 5,
      };
    });
  },
};

export function getWeatherProvider(): WeatherProvider {
  return env().WEATHER_PROVIDER === "mock" ? mockWeather : openMeteo;
}
