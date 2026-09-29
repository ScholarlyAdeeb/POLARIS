import type { StationData } from '../src/types/polaris.ts';
import type { ArchiveItem } from './db.ts';

export interface LatLon {
  lat: number;
  lon: number;
}

/** Parses "69°24′29″ S, 76°11′14″ E" or "78°55′N, 11°56′E" into decimal degrees. */
export function parseCoordinates(s: string): LatLon | null {
  const parts = s.split(',').map((p) => p.trim());
  if (parts.length !== 2) return null;
  const one = (p: string) => {
    const m = p.match(/(\d+(?:\.\d+)?)\s*°\s*(?:(\d+(?:\.\d+)?)\s*[′']\s*)?(?:(\d+(?:\.\d+)?)\s*[″"]\s*)?([NSEW])/i);
    if (!m) return null;
    const v = Number(m[1]) + Number(m[2] ?? 0) / 60 + Number(m[3] ?? 0) / 3600;
    return /[SW]/i.test(m[4]) ? -v : v;
  };
  const lat = one(parts[0]);
  const lon = one(parts[1]);
  return lat === null || lon === null ? null : { lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)) };
}

export function stationLocation(s: StationData): LatLon | null {
  return parseCoordinates(s.coordinates);
}

/** Great-circle distance in km. */
export function distanceKm(a: LatLon, b: LatLon): number {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function nearestStation(p: LatLon, stations: StationData[], maxKm = 400): { station: StationData; km: number } | null {
  let best: { station: StationData; km: number } | null = null;
  for (const s of stations) {
    const loc = stationLocation(s);
    if (!loc) continue;
    const km = distanceKm(p, loc);
    if (!best || km < best.km) best = { station: s, km };
  }
  return best && best.km <= maxKm ? { station: best.station, km: Math.round(best.km) } : null;
}

/** Broad region for a point, used when a contributor gives coordinates but no domain. */
export function regionFor(p: LatLon): string {
  if (p.lat <= -60) return 'ANTARCTICA';
  if (p.lat < -40) return 'SOUTHERN OCEAN';
  if (p.lat >= 60) return 'ARCTIC';
  if (p.lat >= 26 && p.lat <= 40 && p.lon >= 70 && p.lon <= 100) return 'HIMALAYAS / THIRD POLE';
  return '';
}

export function validLatLon(lat: unknown, lon: unknown): LatLon | null {
  if (lat === undefined || lat === null || lat === '' || lon === undefined || lon === null || lon === '') return null;
  const a = Number(lat);
  const o = Number(lon);
  if (!Number.isFinite(a) || !Number.isFinite(o) || a < -90 || a > 90 || o < -180 || o > 180) return null;
  return { lat: Number(a.toFixed(5)), lon: Number(o.toFixed(5)) };
}

/**
 * Where a record sits on the map, and how we know:
 * its own coordinates, else the station it belongs to, else an expedition milestone position.
 */
export function itemLocation(item: ArchiveItem, stations: StationData[]): (LatLon & { basis: 'record' | 'station' }) | null {
  const own = validLatLon(item.meta?.location?.lat, item.meta?.location?.lon);
  if (own) return { ...own, basis: 'record' };
  if (Array.isArray(item.meta?.latLng)) {
    const m = validLatLon(item.meta.latLng[0], item.meta.latLng[1]);
    if (m) return { ...m, basis: 'record' };
  }
  const st = item.stationId ? stations.find((s) => s.id === item.stationId) : null;
  const loc = st ? stationLocation(st) : null;
  return loc ? { ...loc, basis: 'station' } : null;
}
