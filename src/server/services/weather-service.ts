import "server-only";
import { addDaysIso, fromDbDate, todayInTimeZone, toDbDate } from "@/lib/dates";
import { isOutdoor } from "@/lib/itinerary";
import { type DayWeatherView, type RainSuggestion, isRainy, weatherLabel } from "@/lib/weather";
import { db } from "@/server/db";
import { FORECAST_DAYS, getWeatherProvider } from "@/server/integrations/weather";
import { assertTripAccess, ensureTripCenter } from "./trip-service";

const FRESH_MS = 3 * 60 * 60 * 1000;

/**
 * Trip weather, cached in WeatherSnapshot for 3 hours. Days beyond the 16-day forecast window
 * come back as unavailable. If the provider fails, the last snapshot is served instead.
 */
export async function getTripWeather(tripId: string, userId: string) {
  await assertTripAccess(tripId, userId);
  const trip = await db.trip.findUniqueOrThrow({
    where: { id: tripId },
    select: {
      timezone: true,
      startDate: true,
      endDate: true,
      days: {
        orderBy: { dayNumber: "asc" },
        select: {
          id: true,
          dayNumber: true,
          date: true,
          items: { select: { title: true, category: true, startMinute: true, status: true, place: { select: { isIndoor: true } } } },
        },
      },
    },
  });
  const provider = getWeatherProvider();
  const today = todayInTimeZone(trip.timezone);
  const startDate = fromDbDate(trip.startDate);
  const endDate = fromDbDate(trip.endDate);

  let snapshots = await db.weatherSnapshot.findMany({ where: { tripId, provider: provider.name } });
  const newest = snapshots.reduce((m, s) => Math.max(m, s.fetchedAt.getTime()), 0);
  const inWindow = endDate >= today && startDate <= addDaysIso(today, FORECAST_DAYS - 1);
  let stale = false;

  if (inWindow && Date.now() - newest > FRESH_MS) {
    try {
      const center = await ensureTripCenter(tripId);
      if (center) {
        const daily = await provider.getDaily(center, startDate, endDate, trip.timezone, today);
        await db.$transaction(
          daily.map((w) =>
            db.weatherSnapshot.upsert({
              where: { tripId_date_provider: { tripId, date: toDbDate(w.date), provider: provider.name } },
              create: {
                tripId,
                date: toDbDate(w.date),
                provider: provider.name,
                condition: w.condition,
                tempMaxC: w.tempMaxC,
                tempMinC: w.tempMinC,
                precipitationProbability: w.precipitationProbability,
              },
              update: {
                condition: w.condition,
                tempMaxC: w.tempMaxC,
                tempMinC: w.tempMinC,
                precipitationProbability: w.precipitationProbability,
                fetchedAt: new Date(),
              },
            }),
          ),
        );
        snapshots = await db.weatherSnapshot.findMany({ where: { tripId, provider: provider.name } });
      }
    } catch {
      stale = true; // serve what we have
    }
  }

  const byDate = new Map(snapshots.map((s) => [fromDbDate(s.date), s]));
  const days: DayWeatherView[] = trip.days.map((d) => {
    const date = fromDbDate(d.date);
    const s = byDate.get(date);
    return {
      dayId: d.id,
      dayNumber: d.dayNumber,
      date,
      available: Boolean(s),
      condition: s?.condition ?? "unknown",
      label: s ? weatherLabel(s.condition) : "예보 전",
      tempMax: s?.tempMaxC ?? null,
      tempMin: s?.tempMinC ?? null,
      precipitation: s?.precipitationProbability ?? null,
    };
  });

  const suggestions: RainSuggestion[] = [];
  for (const d of trip.days) {
    const w = days.find((x) => x.dayId === d.id)!;
    if (!w.available || !isRainy(w) || fromDbDate(d.date) < today) continue;
    const outdoor = d.items.filter(
      (i) => i.status !== "DONE" && i.startMinute >= 12 * 60 && isOutdoor({ category: i.category, isIndoor: i.place?.isIndoor ?? null }),
    );
    if (outdoor.length === 0) continue;
    suggestions.push({
      dayId: d.id,
      dayNumber: d.dayNumber,
      message: `${d.dayNumber}일차 오후에 비 소식이 있어요.`,
      outdoorTitles: outdoor.map((i) => i.title),
    });
  }

  return { provider: provider.name, stale, today, days, suggestions };
}

export type TripWeather = Awaited<ReturnType<typeof getTripWeather>>;
