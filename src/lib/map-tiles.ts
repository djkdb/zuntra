/**
 * Map tile provider, swappable by environment. Mapbox (raster styles) when a public token is
 * configured, otherwise OpenStreetMap's standard tiles — fine for development and low traffic,
 * but production traffic should use a commercial provider per OSM's tile usage policy.
 */
export interface TileConfig {
  url: string;
  attribution: string;
  maxZoom: number;
  tileSize?: number;
  zoomOffset?: number;
}

export function getTileConfig(): TileConfig {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (token) {
    return {
      url: `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/512/{z}/{x}/{y}@2x?access_token=${token}`,
      attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
      tileSize: 512,
      zoomOffset: -1,
    };
  }
  return {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  };
}
