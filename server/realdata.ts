import fs from 'fs';
import os from 'os';
import path from 'path';
import type { StationData } from '../src/types/polaris.ts';
import { stationLocation, type LatLon } from './geo.ts';

/**
 * Real environmental data for the stations, from Open-Meteo (no key needed):
 *  - current conditions and the last days of hourly values (forecast model, updated hourly)
 *  - daily history since 1981 from the ERA5 reanalysis (archive API, ~5 days behind real time)
 * Everything is labelled as model / reanalysis data at the station coordinates, not station instruments.
 */

export const OPEN_METEO_SOURCE = 'Open-Meteo (open-meteo.com), CC BY 4.0';
export const ERA5_SOURCE = 'ERA5 reanalysis (Copernicus / ECMWF) via Open-Meteo, CC BY 4.0';

/** Ships have no fixed position, so they get no location-based data. */
export const fixedStation = (s: StationData) => !/sagar|ship|orv/i.test(`${s.id} ${s.name}`);

// Serverless hosts (Vercel) only allow writes under the temp directory.
const CACHE_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), 'polaris-cache')
  : path.resolve(process.cwd(), process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : 'data', 'cache');

async function getJson(url: string, timeoutMs = 10_000): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}`);
  return res.json();
}

// --- current conditions for all fixed stations (one request) -----------------------------

export interface LiveReading {
  time: string;
  temperature: number;
  apparent: number;
  windSpeedKmh: number;
  windDir: number;
  pressure: number;
  humidity: number;
  cloud: number;
}

let liveCache: { at: number; byId: Record<string, LiveReading> } | null = null;
let liveInFlight: Promise<Record<string, LiveReading>> | null = null;

export async function liveReadings(stations: StationData[]): Promise<Record<string, LiveReading>> {
  if (liveCache && Date.now() - liveCache.at < 10 * 60_000) return liveCache.byId;
  if (liveInFlight) return liveInFlight;
  const pts = stations.filter(fixedStation).map((s) => ({ s, loc: stationLocation(s) })).filter((x): x is { s: StationData; loc: LatLon } => !!x.loc);
  liveInFlight = (async () => {
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${pts.map((p) => p.loc.lat).join(',')}&longitude=${pts.map((p) => p.loc.lon).join(',')}` +
        '&current=temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,surface_pressure,relative_humidity_2m,cloud_cover&timezone=UTC';
      const d = await getJson(url);
      const arr = Array.isArray(d) ? d : [d];
      const byId: Record<string, LiveReading> = {};
      arr.forEach((loc: any, i: number) => {
        const c = loc.current;
        byId[pts[i].s.id] = {
          time: c.time,
          temperature: c.temperature_2m,
          apparent: c.apparent_temperature,
          windSpeedKmh: c.wind_speed_10m,
          windDir: c.wind_direction_10m,
          pressure: c.surface_pressure,
          humidity: c.relative_humidity_2m,
          cloud: c.cloud_cover,
        };
      });
      liveCache = { at: Date.now(), byId };
      return byId;
    } finally {
      liveInFlight = null;
    }
  })();
  return liveInFlight;
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

/** Station card values from a live reading (same fields the UI already shows). */
export function withLive(s: StationData, r: LiveReading | undefined): StationData & { readingsSource?: string; readingsTime?: string } {
  if (!r) return s;
  const kts = r.windSpeedKmh / 1.852;
  return {
    ...s,
    temp: `${r.temperature.toFixed(1)}°C`,
    windChill: `${r.apparent.toFixed(1)}°C`,
    windSpeed: `${kts.toFixed(1)} kts`,
    windDir: `${COMPASS[Math.round(r.windDir / 22.5) % 16]} (${String(Math.round(r.windDir)).padStart(3, '0')}°)`,
    pressure: `${r.pressure.toFixed(1)} hPa`,
    readingsSource: OPEN_METEO_SOURCE,
    readingsTime: r.time,
  };
}

// --- recent hourly values (real replacement for the old synthetic synoptic export) --------------

export async function recentHourlyCsv(s: StationData, days = 3): Promise<string> {
  const loc = stationLocation(s);
  if (!loc) throw new Error('Station has no coordinates');
  const vars = ['temperature_2m', 'apparent_temperature', 'relative_humidity_2m', 'surface_pressure', 'wind_speed_10m', 'wind_direction_10m', 'cloud_cover', 'shortwave_radiation'];
  const d = await getJson(
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&hourly=${vars.join(',')}&past_days=${days}&forecast_days=1&timezone=UTC`
  );
  const now = Date.now();
  const rows: string[] = [];
  d.hourly.time.forEach((t: string, i: number) => {
    if (Date.parse(`${t}Z`) > now) return; // past hours only
    rows.push([`${t}Z`, ...vars.map((v) => d.hourly[v][i] ?? '')].join(','));
  });
  return [
    `# Hourly surface conditions: ${s.name} (${loc.lat}, ${loc.lon}), last ${days} days`,
    `# Source: ${OPEN_METEO_SOURCE}. Numerical weather model at the station coordinates, not station instrument readings.`,
    `# Generated ${new Date().toISOString()}`,
    ['time_utc', ...vars.map((v) => `${v} (${d.hourly_units[v]})`)].join(','),
    ...rows,
  ].join('\n') + '\n';
}

// --- climate history since 1981 (ERA5) ----------------------------------------------------

export interface ClimateYear {
  year: number;
  tempMean: number;
  tempMin: number;
  tempMax: number;
  windMax: number;
  precip: number;
  days: number;
}

export interface Climate {
  stationId: string;
  location: LatLon;
  from: string;
  to: string;
  annual: ClimateYear[];
  baseline: { period: string; tempMean: number };
  trendPerDecade: number;
  latestYear: ClimateYear | null;
  anomaly: number | null;
  source: string;
  note: string;
  fetchedAt: string;
}

const daily = 'temperature_2m_mean,temperature_2m_min,temperature_2m_max,wind_speed_10m_max,precipitation_sum';

async function era5Daily(loc: LatLon, from: string, to: string) {
  return getJson(
    `https://archive-api.open-meteo.com/v1/archive?latitude=${loc.lat}&longitude=${loc.lon}&start_date=${from}&end_date=${to}&daily=${daily}&timezone=UTC`,
    60_000
  );
}

const endDate = () => new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);

function slope(xs: number[], ys: number[]) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den ? num / den : 0;
}

const round = (v: number, d = 2) => Number(v.toFixed(d));

export async function stationClimate(s: StationData): Promise<Climate> {
  const loc = stationLocation(s);
  if (!loc || !fixedStation(s)) throw new Error('No fixed position for this station');
  const file = path.join(CACHE_DIR, `climate-${s.id}.json`);
  try {
    const cached = JSON.parse(fs.readFileSync(file, 'utf8')) as Climate;
    if (Date.now() - Date.parse(cached.fetchedAt) < 24 * 3600_000) return cached;
  } catch {
    /* no cache yet */
  }
  const from = '1981-01-01';
  const to = endDate();
  const d = await era5Daily(loc, from, to);
  const by = new Map<number, { t: number[]; tn: number[]; tx: number[]; w: number[]; p: number[] }>();
  d.daily.time.forEach((day: string, i: number) => {
    const y = Number(day.slice(0, 4));
    const b = by.get(y) ?? { t: [], tn: [], tx: [], w: [], p: [] };
    const push = (arr: number[], v: any) => v !== null && v !== undefined && arr.push(v);
    push(b.t, d.daily.temperature_2m_mean[i]);
    push(b.tn, d.daily.temperature_2m_min[i]);
    push(b.tx, d.daily.temperature_2m_max[i]);
    push(b.w, d.daily.wind_speed_10m_max[i]);
    push(b.p, d.daily.precipitation_sum[i]);
    by.set(y, b);
  });
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const annual: ClimateYear[] = [...by.entries()]
    .filter(([, b]) => b.t.length >= 300) // complete years only
    .map(([year, b]) => ({
      year,
      tempMean: round(mean(b.t)),
      tempMin: round(Math.min(...b.tn), 1),
      tempMax: round(Math.max(...b.tx), 1),
      windMax: round(Math.max(...b.w), 1),
      precip: round(b.p.reduce((x, y) => x + y, 0), 1),
      days: b.t.length,
    }));
  const base = annual.filter((a) => a.year >= 1981 && a.year <= 2010);
  const baseline = base.length ? round(mean(base.map((a) => a.tempMean))) : NaN;
  const latest = annual[annual.length - 1] ?? null;
  const out: Climate = {
    stationId: s.id,
    location: loc,
    from,
    to,
    annual,
    baseline: { period: '1981–2010', tempMean: baseline },
    trendPerDecade: round(slope(annual.map((a) => a.year), annual.map((a) => a.tempMean)) * 10),
    latestYear: latest,
    anomaly: latest && Number.isFinite(baseline) ? round(latest.tempMean - baseline) : null,
    source: ERA5_SOURCE,
    note: 'Reanalysis values for the grid cell containing the station coordinates (about 25 km), not station instrument records.',
    fetchedAt: new Date().toISOString(),
  };
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out));
  return out;
}

/** Full daily ERA5 series as CSV (the download behind the station climate records). */
export async function climateCsv(s: StationData): Promise<string> {
  const loc = stationLocation(s);
  if (!loc) throw new Error('Station has no coordinates');
  const to = endDate();
  const d = await era5Daily(loc, '1981-01-01', to);
  const cols = daily.split(',');
  return [
    `# Daily surface climate at ${s.name} (${loc.lat}, ${loc.lon}), 1981-01-01 to ${to}`,
    `# Source: ${ERA5_SOURCE}. Reanalysis grid values, not station instrument records.`,
    ['date', ...cols.map((c) => `${c} (${d.daily_units[c]})`)].join(','),
    ...d.daily.time.map((t: string, i: number) => [t, ...cols.map((c) => d.daily[c][i] ?? '')].join(',')),
  ].join('\n') + '\n';
}
