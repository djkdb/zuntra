import type { TransportMode } from "@/generated/prisma/enums";

export interface LatLng {
  lat: number;
  lng: number;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Average door-to-door speeds (km/h) and fixed overhead (waiting, parking) per mode.
const SPEED: Record<TransportMode, [number, number]> = {
  WALK: [4.5, 0],
  BIKE: [13, 2],
  TRANSIT: [22, 8],
  BUS: [18, 8],
  TRAIN: [45, 10],
  TAXI: [24, 5],
  CAR: [30, 8],
  FLIGHT: [600, 90],
  OTHER: [20, 5],
};

/** Rough travel time when no routing provider is available (streets are ~1.3× straight line). */
export function estimateTravelMinutes(from: LatLng, to: LatLng, mode: TransportMode = "TRANSIT"): number {
  const km = haversineKm(from, to) * 1.3;
  const [speed, overhead] = SPEED[mode];
  return Math.max(1, Math.round((km / speed) * 60 + overhead));
}

/** Walking for short hops, transit beyond ~1.2km. */
export function suggestMode(from: LatLng, to: LatLng): TransportMode {
  return haversineKm(from, to) <= 1.2 ? "WALK" : "TRANSIT";
}
