import { type TripPhase, getTripPhase, todayInTimeZone } from "@/lib/dates";

interface TripLike {
  id: string;
  startDate: string;
  endDate: string;
  status: string;
  timezone: string;
}

export function phaseOf(trip: TripLike, now: Date = new Date()): TripPhase {
  return getTripPhase(trip, todayInTimeZone(trip.timezone, now));
}

/** The trip the app should open on: the one in progress, else the next upcoming one. */
export function pickFocusTrip<T extends TripLike>(trips: T[], now: Date = new Date()): T | null {
  const ongoing = trips.find((t) => phaseOf(t, now) === "ongoing");
  if (ongoing) return ongoing;
  const upcoming = trips
    .filter((t) => phaseOf(t, now) === "upcoming")
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  return upcoming[0] ?? null;
}

export function groupTripsByPhase<T extends TripLike>(trips: T[], now: Date = new Date()) {
  const groups: Record<"ongoing" | "upcoming" | "past", T[]> = { ongoing: [], upcoming: [], past: [] };
  for (const trip of trips) {
    const phase = phaseOf(trip, now);
    groups[phase === "completed" ? "past" : phase].push(trip);
  }
  groups.past.sort((a, b) => b.startDate.localeCompare(a.startDate));
  return groups;
}

export const PHASE_LABELS: Record<TripPhase, string> = {
  upcoming: "다가오는 여행",
  ongoing: "여행 중",
  past: "지난 여행",
  completed: "여행 완료",
};
