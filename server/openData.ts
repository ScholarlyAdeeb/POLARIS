import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Db } from './pg.ts';
import { insertItems, listStations, type ArchiveInput } from './db.ts';
import { nearestStation, regionFor, stationLocation } from './geo.ts';
import { ERA5_SOURCE, fixedStation } from './realdata.ts';

/**
 * Loads real open metadata (server/data/open-data.json, refreshed by scripts/import-open-data.ts)
 * into the archive. Records are marked EXTERNAL: metadata from Crossref / PANGAEA with a DOI;
 * HIMAKSHA neither produced nor verified the underlying science. Idempotent: existing ids are skipped.
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

/** 1 -> "1st", 2 -> "2nd", 11 -> "11th", 23 -> "23rd". */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** A readable title for a Commons photo: the first sentence of its description, else the file name. */
export function photoTitle(p: { title: string; description?: string }): string {
  const desc = decode(String(p.description ?? '')).trim();
  const owner = desc.match(/^from the (?:personal )?collection of ([^,.]+(?:\.\s?[A-Z]{1,2}\.?)?[^,.]*)/i);
  if (owner) return `Antarctic expedition photograph from the collection of ${owner[1].trim()}`;
  if (desc.length >= 25) {
    // First sentence, unless it is cut short by an initial ("M. Rao"); then up to 140 characters.
    let first = desc.split(/(?<=[.!?])\s/)[0].replace(/[.\s]+$/, '');
    if (first.length < 40) first = desc;
    return first.length <= 140 ? first : first.slice(0, 140).replace(/\s+\S*$/, '') + '…';
  }
  return decode(p.title);
}

const shortAuthors = (a: string[]) => (a.length > 6 ? `${a.slice(0, 6).join('; ')}; et al.` : a.join('; '));

export async function loadOpenData(db: Db): Promise<number> {
  if (!fs.existsSync(SNAPSHOT)) return 0;
  const snap = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  const stations = listStations();
  const items: ArchiveInput[] = [];
  {
    for (const p of snap.papers ?? []) {
      const id = `OPEN-CR-${crypto.createHash('sha1').update(p.doi).digest('hex').slice(0, 10).toUpperCase()}`;
      const station = STATION_WORDS.find(([re]) => re.test(p.title))?.[1] ?? null;
      const st = stations.find((s) => s.id === station);
      items.push({
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
    }
    for (const d of snap.datasets ?? []) {
      const id = `OPEN-PG-${d.doi.split('pangaea.').pop()?.toUpperCase()}`;
      const near = d.location ? nearestStation(d.location, stations, 150) : null;
      const station = STATION_WORDS.find(([re]) => re.test(d.title))?.[1] ?? near?.station.id ?? null;
      const st = stations.find((s) => s.id === station);
      items.push({
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
    }
    // Papers in NCPOR's Scientific Reports of the Indian Expeditions to Antarctica (NCPOR DSpace, OAI-PMH).
    // Metadata only: the repository is "All Rights Reserved", so each record links to the paper on NCPOR's site.
    for (const r of snap.ncporReports ?? []) {
      const id = `NCPOR-DS-${String(r.handle).split('/').pop()}`;
      const yearTag = (r.subjects ?? []).map((s: string) => s.match(/^(19[89]\d|20[0-2]\d)$/)?.[1]).find(Boolean);
      // DSpace dates are upload dates (2006); the science belongs to the expedition season (1st ISEA = 1981-82).
      const season = r.expedition ? 1980 + r.expedition : null;
      const year = yearTag ? Number(yearTag) : season;
      const text = `${r.title} ${(r.subjects ?? []).join(' ')} ${r.section ?? ''}`;
      const station = STATION_WORDS.find(([re]) => re.test(text))?.[1] ?? null;
      const nth = r.expedition ? ordinal(r.expedition) : '';
      const subjects = (r.subjects ?? []).filter((s: string) => !/^\d{4}$/.test(s));
      items.push({
        id,
        type: 'report',
        title: r.title,
        summary:
          `${r.report ? `Paper in the ${r.report}` : 'Paper in NCPOR’s expedition scientific reports'}` +
          `${season ? ` (${nth} Indian Scientific Expedition to Antarctica, ${season}–${String((season + 1) % 100).padStart(2, '0')} season)` : ''}` +
          `${r.section ? `, section “${r.section}”` : ''}.` +
          `${r.authors?.length ? ` Authors: ${shortAuthors(r.authors)}.` : ''}` +
          `${subjects.length ? ` Keywords: ${subjects.slice(0, 6).join(', ')}.` : ''}`,
        domain: domainFor(text) || 'ANTARCTICA',
        stationId: station,
        year,
        tags: ['ncpor', 'expedition report', ...(r.expedition ? [`ISEA-${r.expedition}`] : []), ...subjects.slice(0, 5).map((t: string) => t.replace(/,/g, ' ').slice(0, 50))],
        url: r.url,
        meta: {
          authors: shortAuthors(r.authors ?? []),
          expedition: r.expedition ?? null,
          report: r.report ?? null,
          section: r.section ?? null,
          handle: r.handle,
          openData: true,
          registry: 'NCPOR DSpace',
          publisher: 'National Centre for Polar and Ocean Research (NCPOR)',
        },
        dataStatus: 'EXTERNAL',
        provenance: {
          source: 'NCPOR DSpace repository (OAI-PMH)',
          retrievedAt: snap.ncporRetrievedAt ?? snap.retrievedAt,
          licence: 'NCPOR: All rights reserved. HIMAKSHA stores metadata only.',
          method: 'OAI-PMH ListRecords (Dublin Core); expedition and section from the repository’s community structure',
          note: 'Read the paper on NCPOR’s repository at the link.',
        },
      });
    }
    // NSIDC Sea Ice Index: one dataset per hemisphere; the chart is built from the snapshot (seaIceSeries).
    for (const hemi of ['north', 'south'] as const) {
      const rows = snap.seaIce?.[hemi] ?? [];
      if (!rows.length) continue;
      const first = rows[0].year;
      const last = rows[rows.length - 1].year;
      const arctic = hemi === 'north';
      items.push({
        id: `NSIDC-SEAICE-${arctic ? 'N' : 'S'}`,
        type: 'dataset',
        title: `${arctic ? 'Arctic' : 'Antarctic'} sea-ice extent and area, monthly, ${first} to ${last} (NSIDC Sea Ice Index)`,
        summary:
          `Monthly sea-ice extent and area for the ${arctic ? 'Northern' : 'Southern'} Hemisphere from satellite passive-microwave data, ${first} to ${last}. ` +
          `The chart shows each year's minimum, maximum and mean extent in million km².`,
        domain: arctic ? 'ARCTIC' : 'SOUTHERN OCEAN',
        stationId: null,
        year: last,
        tags: ['open data', 'sea ice', 'nsidc', 'climate', 'satellite'],
        url: `https://noaadata.apps.nsidc.org/NOAA/G02135/${hemi}/monthly/data/`,
        doi: '10.7265/a98x-0f50',
        meta: {
          seaIce: hemi,
          registry: 'NSIDC',
          publisher: 'National Snow and Ice Data Center (NSIDC), NOAA',
          authors: 'Fetterer, F.; Knowles, K.; Meier, W. N.; Savoie, M.; Windnagel, A. K.; Stafford, T.',
          format: 'CSV',
          license: 'Public domain (U.S. Government work)',
          temporalCoverage: `${first}-01/${last}`,
          openData: true,
        },
        dataStatus: 'EXTERNAL',
        provenance: {
          source: snap.sources?.nsidc ?? 'NSIDC Sea Ice Index v4',
          retrievedAt: snap.extraRetrievedAt,
          licence: 'Public domain',
          method: 'Monthly extent files N_MM / S_MM for every month; months without data (-9999) dropped',
          note: 'Satellite-derived values as published by NSIDC.',
        },
      });
    }
    // OpenAlex: open-access articles by NCPOR authors, linking to the free full text.
    for (const w of snap.openAlex ?? []) {
      const id = `OPEN-OA-${w.openalexId}`;
      const station = STATION_WORDS.find(([re]) => re.test(w.title))?.[1] ?? null;
      const st = stations.find((s) => s.id === station);
      items.push({
        id,
        type: 'publication',
        title: w.title,
        summary:
          `Open-access article in ${w.journal || 'a journal'}${w.year ? ` (${w.year})` : ''}, cited ${w.citedBy} times. ` +
          `NCPOR authors: ${shortAuthors(w.ncporAuthors ?? [])}.${w.topic ? ` Topic: ${w.topic}.` : ''}`,
        domain: st?.domain || domainFor(`${w.title} ${w.topic ?? ''}`),
        stationId: station,
        year: w.year,
        tags: ['open data', 'openalex', 'open access', ...(w.topic ? [w.topic.replace(/,/g, ' ')] : [])],
        url: w.oaUrl || `https://doi.org/${w.doi}`,
        doi: w.doi,
        meta: { authors: shortAuthors(w.authors ?? []), journal: w.journal, license: w.license, citedBy: w.citedBy, openData: true, registry: 'OpenAlex', fullText: w.oaUrl },
        dataStatus: 'EXTERNAL',
        provenance: {
          source: 'OpenAlex API',
          retrievedAt: snap.extraRetrievedAt,
          licence: `OpenAlex metadata, CC0; article ${w.license ? `under ${w.license}` : 'open access'}`,
          method: 'Open-access articles with an author at NCPOR (OpenAlex I106814784), filtered to polar topics, most cited first',
          note: 'Metadata only. Read the full text at the link.',
        },
      });
    }
    // Wikimedia Commons: photographs of Indian polar stations with per-file licence and author.
    for (const p of snap.commons ?? []) {
      const title = photoTitle(p);
      const loc = p.lat && p.lon ? { lat: p.lat, lon: p.lon } : null;
      const st = stations.find((s) => s.id === p.station);
      const year = Number(String(p.date ?? '').slice(0, 4)) || null;
      items.push({
        id: `WIKI-${p.pageid}`,
        type: 'photo',
        title,
        summary: `${decode(p.description || title).replace(/\.?$/, '.')} Photograph by ${p.author || 'an unnamed author'}, ${p.licence}, via Wikimedia Commons.`,
        domain: st?.domain || 'ANTARCTICA',
        stationId: p.station,
        year,
        date: p.date,
        tags: ['open data', 'wikimedia commons', 'photo', p.category],
        url: p.image,
        thumbnailUrl: p.image,
        meta: {
          author: p.author,
          license: p.licence,
          licenseUrl: p.licenceUrl,
          sourcePage: p.page,
          registry: 'Wikimedia Commons',
          openData: true,
          ...(loc ? { location: loc } : {}),
        },
        dataStatus: 'EXTERNAL',
        provenance: {
          source: 'Wikimedia Commons',
          retrievedAt: snap.extraRetrievedAt,
          licence: `${p.licence}; author ${p.author || 'unknown'}`,
          method: `Files in the Commons category "${p.category}"`,
          note: `Credit the author and licence when reusing. File page: ${p.page}`,
        },
      });
    }
    // One real climate record per fixed station: daily ERA5 values since 1981, fetched live on download.
    for (const s of stations.filter(fixedStation)) {
      const id = `CLIMATE-${s.id.toUpperCase()}`;
      const loc = stationLocation(s);
      if (!loc) continue;
      items.push({
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
    }
  }
  const added = await insertItems(db, items);
  if (added) console.log(`[HIMAKSHA] Loaded ${added} open-data records (Crossref, PANGAEA, NCPOR DSpace, NSIDC, OpenAlex, Wikimedia Commons)`);
  return added;
}

let seaIceCache: Record<string, { year: number; month: number; extent: number; area: number }[]> | null = null;

/** Yearly minimum, maximum and mean sea-ice extent for one hemisphere, from the snapshot. */
export function seaIceSeries(hemi: 'north' | 'south') {
  seaIceCache ??= fs.existsSync(SNAPSHOT) ? JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')).seaIce ?? {} : {};
  const byYear = new Map<number, number[]>();
  for (const r of seaIceCache![hemi] ?? []) byYear.set(r.year, [...(byYear.get(r.year) ?? []), r.extent]);
  const round = (n: number) => Math.round(n * 100) / 100;
  return [...byYear.entries()]
    .filter(([, v]) => v.length === 12) // complete years only (skips the 1987-88 gap and the current year)
    .map(([year, v]) => ({ x: String(year), values: [round(Math.min(...v)), round(Math.max(...v)), round(v.reduce((a, b) => a + b, 0) / v.length)] }));
}
