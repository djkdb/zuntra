import "server-only";
import { nowMinuteInTimeZone, todayInTimeZone } from "@/lib/dates";
import { phaseOf } from "@/lib/trips";
import { getItinerary } from "./itinerary-service";
import { getTripWeather } from "./weather-service";

/** Everything the TODAY screen needs, loaded in parallel. Weather failures never block it. */
export async function getTodayData(tripId: string, userId: string) {
  const [itinerary, weather] = await Promise.all([
    getItinerary(tripId, userId),
    getTripWeather(tripId, userId).catch(() => null),
  ]);
  const { trip } = itinerary;
  const today = todayInTimeZone(trip.timezone);
  const todayDay = itinerary.days.find((d) => d.date === today) ?? null;
  const w = todayDay ? weather?.days.find((d) => d.dayId === todayDay.id && d.available) : undefined;
  return {
    itinerary,
    weather,
    phase: phaseOf({ ...trip, startDate: trip.startDate, endDate: trip.endDate }),
    todayDayId: todayDay?.id ?? null,
    nowMinute: nowMinuteInTimeZone(trip.timezone),
    todayWeather:
      w && w.tempMax !== null && w.tempMin !== null
        ? { condition: w.condition, label: w.label, tempMax: w.tempMax, tempMin: w.tempMin, precipitation: w.precipitation }
        : null,
  };
}
