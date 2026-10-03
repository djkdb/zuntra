import "server-only";
import type { LatLng } from "@/lib/geo";
import { findCity } from "@/server/ai/mock/poi-catalog";
import { env } from "@/server/env";
import { fetchJson } from "../http";

export interface GeocodedCity extends LatLng {
  name: string;
  country: string | null;
  timezone: string | null;
}

export interface GeocodedPlace extends LatLng {
  address: string;
}

/**
 * Geocoding behind one interface so the provider can be swapped (OSM today; Google/Mapbox later
 * only need a new implementation of these two functions).
 */
export interface MapsProvider {
  geocodeCity(name: string): Promise<GeocodedCity | null>;
  geocodePlace(query: string, near: LatLng | null): Promise<GeocodedPlace | null>;
}

const mockMaps: MapsProvider = {
  async geocodeCity(name) {
    const city = findCity(name);
    return city ? { name, ...city.center, country: null, timezone: null } : null;
  },
  async geocodePlace(query, near) {
    if (!near) return null;
    // Deterministic jitter around the centre so pins are distinct but stable.
    let hash = 0;
    for (const ch of query) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
    return { lat: near.lat + ((hash % 100) / 100) * 0.02, lng: near.lng + (((hash >> 8) % 100) / 100) * 0.02, address: query };
  },
};

const osmMaps: MapsProvider = {
  async geocodeCity(name) {
    const catalog = findCity(name);
    try {
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=ko&format=json`;
      const data = await fetchJson<{ results?: { name: string; latitude: number; longitude: number; country?: string; timezone?: string }[] }>(url, { timeoutMs: 4000 });
      const r = data.results?.[0];
      if (r) return { name: r.name, lat: r.latitude, lng: r.longitude, country: r.country ?? null, timezone: r.timezone ?? null };
    } catch {
      // fall through to the catalog
    }
    return catalog ? { name, ...catalog.center, country: null, timezone: null } : null;
  },
  async geocodePlace(query, near) {
    const params = new URLSearchParams({ q: query, format: "json", limit: "1", "accept-language": "ko" });
    if (near) {
      const d = 0.5;
      params.set("viewbox", `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
      params.set("bounded", "1");
    }
    try {
      const data = await fetchJson<{ lat: string; lon: string; display_name: string }[]>(
        `https://nominatim.openstreetmap.org/search?${params}`,
        // Nominatim's usage policy requires an identifying User-Agent and low volume.
        { headers: { "User-Agent": "TripMate/1.0 (travel planner)" }, timeoutMs: 4000 },
      );
      const r = data[0];
      return r ? { lat: Number(r.lat), lng: Number(r.lon), address: r.display_name } : null;
    } catch {
      return null;
    }
  },
};

export function getMapsProvider(): MapsProvider {
  return env().MAPS_PROVIDER === "mock" ? mockMaps : osmMaps;
}
