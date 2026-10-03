"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { LatLng } from "@/lib/geo";
import { getTileConfig } from "@/lib/map-tiles";

export interface MapMarker {
  id: string;
  position: LatLng;
  label: string;
  title: string;
  kind: "stop" | "lodging" | "airport" | "food" | "done";
  selected?: boolean;
}

const COLORS: Record<MapMarker["kind"], string> = {
  stop: "var(--primary)",
  food: "var(--sunset)",
  lodging: "oklch(0.45 0.12 290)",
  airport: "oklch(0.4 0.02 250)",
  done: "oklch(0.7 0.01 250)",
};

function icon(m: MapMarker) {
  const size = m.selected ? 38 : 30;
  // Text content is set via textContent-safe escaping below; labels are short numbers/symbols.
  const label = m.label.replace(/[<>&"']/g, "");
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:${COLORS[m.kind]};color:white;font:600 ${m.selected ? 15 : 13}px/1 var(--font-sans);box-shadow:0 0 0 2px var(--background),0 2px 8px rgb(0 0 0/.25)">${label}</span>`,
  });
}

/**
 * Thin imperative wrapper around Leaflet. The rest of the app only knows MapMarker/route props,
 * so swapping to Google Maps or Mapbox GL means replacing this one component.
 */
export function LeafletMap({
  markers,
  route,
  center,
  me,
  onSelect,
}: {
  markers: MapMarker[];
  route: LatLng[];
  center: LatLng;
  me: LatLng | null;
  onSelect: (id: string) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!el.current || map.current) return;
    const tiles = getTileConfig();
    map.current = L.map(el.current, { zoomControl: true, attributionControl: true }).setView([center.lat, center.lng], 12);
    L.tileLayer(tiles.url, {
      attribution: tiles.attribution,
      maxZoom: tiles.maxZoom,
      tileSize: tiles.tileSize ?? 256,
      zoomOffset: tiles.zoomOffset ?? 0,
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
    };
    // The map is created once; markers update below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    if (route.length > 1) {
      // SVG presentation attributes cannot resolve CSS variables, so pass the computed color.
      const primary = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() || "#2b6b77";
      L.polyline(route.map((p) => [p.lat, p.lng] as [number, number]), {
        color: primary,
        weight: 3,
        opacity: 0.7,
        dashArray: "6 8",
      }).addTo(g);
    }
    for (const marker of markers) {
      L.marker([marker.position.lat, marker.position.lng], { icon: icon(marker), title: marker.title, keyboard: true, zIndexOffset: marker.selected ? 1000 : 0 })
        .on("click", () => onSelectRef.current(marker.id))
        .addTo(g);
    }
    if (me) {
      L.circleMarker([me.lat, me.lng], { radius: 8, color: "white", weight: 3, fillColor: "oklch(0.6 0.2 250)", fillOpacity: 1 })
        .bindTooltip("현재 위치")
        .addTo(g);
    }
    const points = [...markers.map((m) => m.position), ...(me ? [me] : [])];
    if (points.length > 1) m.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 15 });
    else if (points.length === 1) m.setView([points[0]!.lat, points[0]!.lng], 14);
  }, [markers, route, me]);

  return <div ref={el} className="h-full w-full" role="application" aria-label="여행 지도" />;
}
