import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { DatabaseSync } from 'node:sqlite';
import { insertItem, listStations } from './db.ts';
import { nearestStation, regionFor, stationLocation } from './geo.ts';
import { ERA5_SOURCE, fixedStation } from './realdata.ts';

/**
 * Loads real open metadata (server/data/open-data.json, refreshed by scripts/import-open-data.ts)
 * into the archive. Records are marked EXTERNAL: metadata from Crossref / PANGAEA with a DOI;
 * POLARIS neither produced nor verified the underlying science. Idempotent: existing ids are skipped.
 */

const SNAPSHOT = path.resolve(process.cwd(), 'server', 'data', 'open-data.json');

const STATION_WORDS: [RegExp, string][] = [
  [/maitri|schirmacher/i, 'maitri'],
  [/bharati|larsemann/i, 'bharati'],
  [/himadri|ny[- ]?[aå]lesund|kongsfjord/i, 'himadri'],
  [/himansh|chandra basin|spiti/i, 'himansh'],
  [/dakshin gangotri/i, 'dakshin-gangotri'],
];

function domainFor(text: string): string {
  if (/southern ocean|polynya|indian sector/i.test(text)) return 'SOUTHERN OCEAN';
  if (/antarc/i.test(text)) return 'ANTARCTICA';
  if (/arctic|svalbard|spitsbergen|ny[- ]?[aå]lesund|kongsfjord|greenland/i.test(text)) return 'ARCTIC';
  if (/himalay|third pole|glacier.*india|chandra/i.test(text)) return 'HIMALAYAS / THIRD POLE';
  return '';
}

const shortAuthors = (a: string[]) => (a.length > 6 ? `${a.slice(0, 6).join('; ')}; et al.` : a.join('; '));

export function loadOpenData(db: DatabaseSync): number {
  if (!fs.existsSync(SNAPSHOT)) return 0;
  const snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  const stations = listStations();
  const exists = db.prepare('SELECT 1 FROM archive_items WHERE id = ?');
  let added = 0;
  db.exec('BEGIN');
  try {
    for (const p of snap.papers ?? []) {
      const id = `OPEN-CR-${crypto.createHash('sha1').update(p.doi).digest('hex').slice(0, 10).toUpperCase()}`;
      if (exists.get(id)) continue;
      const station = STATION_WORDS.find(([re]) => re.test(p.title))?.[1] ?? null;
      const st = stations.find((s) => s.id === station);
      insertItem(db, {
        id,
        type: 'publication',
        title: p.title,
        summary: `Peer-reviewed article in ${p.journal || 'a journal'}${p.year ? ` (${p.year})` : ''}. NCPOR-affiliated authors listed by Crossref: ${shortAuthors(p.ncporAuthors ?? [])}.`,
        domain: st?.domain || domainFor(p.title),
        stationId: station,
        year: p.year,
        tags: ['open data', 'crossref', ...(p.subjects ?? []).slice(0, 4).map((t: string) => t.replace(/,/g, ' '))],
        url: `https://doi.org/${p.doi}`,
        doi: p.doi,
        meta: { authors: shortAuthors(p.authors ?? []), journal: p.journal, openData: true, registry: 'Crossref' },
        dataStatus: 'EXTERNAL',
        provenance: {
          source: 'Crossref REST API',
          retrievedAt: snap.retrievedAt,
          licence: 'Crossref metadata, CC0',
          method: 'Journal articles with at least one author affiliated to NCPOR / NCAOR, filtered to polar topics',
          note: 'Metadata only. Read the article at its DOI.',
        },
      });
      added++;
    }
    for (const d of snap.datasets ?? []) {
      const id = `OPEN-PG-${d.doi.split('pangaea.').pop()?.toUpperCase()}`;
      if (exists.get(id)) continue;
      const near = d.location ? nearestStation(d.location, stations, 150) : null;
      const station = STATION_WORDS.find(([re]) => re.test(d.title))?.[1] ?? near?.station.id ?? null;
      const st = stations.find((s) => s.id === station);
      insertItem(db, {
        id,
        type: 'dataset',
        title: d.title,
        summary: `Dataset published on PANGAEA${d.year ? ` in ${d.year}` : ''}${d.temporalCoverage ? `, covering ${String(d.temporalCoverage).replace('/', ' to ')}` : ''}. Creators: ${shortAuthors(d.authors ?? [])}.`,
        domain: st?.domain || domainFor(d.title) || (d.location ? regionFor(d.location) : ''),
        stationId: station,
        year: d.year,
        tags: ['open data', 'pangaea', ...(d.keywords ?? []).slice(0, 5).map((t: string) => t.replace(/,/g, ' ').slice(0, 50))],
        url: `https://doi.org/${d.doi}`,
        doi: d.doi,
        meta: {
          authors: shortAuthors(d.authors ?? []),
          publisher: 'PANGAEA',
          license: d.license,
          temporalCoverage: d.temporalCoverage,
          ...(d.location ? { location: d.location } : {}),
          openData: true,
          registry: 'PANGAEA',
        },
        dataStatus: 'EXTERNAL',
        provenance: {
          source: 'PANGAEA Data Publisher',
          retrievedAt: snap.retrievedAt,
          licence: d.license || 'See dataset page',
          method: 'PANGAEA search for Indian polar stations and NCPOR / NCAOR, kept if located in a polar or Himalayan region',
          note: 'Metadata and position only. Download the data from PANGAEA at the DOI.',
        },
      });
      added++;
    }
    // One real climate record per fixed station: daily ERA5 values since 1981, fetched live on download.
    for (const s of stations.filter(fixedStation)) {
      const id = `CLIMATE-${s.id.toUpperCase()}`;
      const loc = stationLocation(s);
      if (exists.get(id) || !loc) continue;
      insertItem(db, {
        id,
        type: 'dataset',
        title: `Daily surface climate at ${s.name}, 1981 to present (ERA5)`,
        summary: `Daily mean, minimum and maximum air temperature, maximum wind speed and precipitation at ${s.name} (${loc.lat}, ${loc.lon}) from 1981 to about a week ago, from the ERA5 reanalysis.`,
        domain: s.domain,
        stationId: s.id,
        year: new Date().getFullYear(),
        tags: ['open data', 'climate', 'era5', 'temperature', 'reanalysis'],
        url: 'https://open-meteo.com/en/docs/historical-weather-api',
        meta: { climateStation: s.id, registry: 'Open-Meteo (ERA5)', publisher: 'Copernicus Climate Change Service / ECMWF', format: 'CSV', license: 'CC BY 4.0', location: loc, openData: true, temporalCoverage: '1981-01-01/present' },
        dataStatus: 'EXTERNAL',
        provenance: {
          source: ERA5_SOURCE,
          method: 'Daily aggregates for the reanalysis grid cell containing the station coordinates',
          note: 'Reanalysis values, not station instrument records. Refreshed on every download.',
        },
      });
      added++;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  if (added) console.log(`[POLARIS] Loaded ${added} open-data records (Crossref + PANGAEA)`);
  return added;
}
