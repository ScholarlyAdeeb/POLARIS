import express, { type Request } from 'express';
import type { Db } from './pg.ts';
import { getItem, listStations, rowToItem, type ArchiveItem } from './db.ts';
import { HttpError, intOrNull, publicBase, rateLimit, sendDownload, wrap } from './http.ts';
import { isReviewer, requireRole } from './auth.ts';
import { itemLocation, stationLocation } from './geo.ts';
import { syntheticSeries } from './files.ts';
import { readUploadText } from './uploads.ts';
import { stationClimate } from './realdata.ts';

// --- usage counters (no personal data: day + kind + key only) -------------------------

/** Fire-and-forget: a failed counter never breaks the request that triggered it. */
export function countUsage(db: Db, kind: string, key: string) {
  if (!key) return;
  const day = new Date().toISOString().slice(0, 10);
  db.run(
    `INSERT INTO usage_counts (day, kind, key, n) VALUES (?, ?, ?, 1)
     ON CONFLICT (day, kind, key) DO UPDATE SET n = usage_counts.n + 1`,
    day,
    kind,
    key.slice(0, 80)
  ).catch((err) => console.warn('[POLARIS] usage counter:', err.message));
}

async function visible(req: Request, id: string): Promise<ArchiveItem | null> {
  const item = await getItem(id);
  if (!item) return null;
  return item.reviewStatus === 'APPROVED' || isReviewer(req.user) || (req.user && item.ownerId === req.user.id) ? item : null;
}

// --- citations ------------------------------------------------------------------------

const TYPE_LABEL: Record<string, string> = {
  expedition: 'Expedition record',
  report: 'Report',
  dataset: 'Data set',
  publication: 'Journal article',
  photo: 'Photograph',
  video: 'Video',
  activity: 'Institutional activity',
};

function authorsOf(item: ArchiveItem): string[] {
  const a = item.meta.authors;
  if (Array.isArray(a)) return a.map(String);
  if (typeof a === 'string' && a.trim()) return a.split(/;|,(?=\s*[A-Z][^,]*\s[A-Z])|\band\b/).map((s) => s.trim()).filter(Boolean);
  if (item.meta.contributor?.name) return [item.meta.contributor.name];
  return ['POLARIS archive'];
}

function recordUrl(base: string, item: ArchiveItem) {
  return item.doi ? `https://doi.org/${item.doi}` : `${base}/?record=${encodeURIComponent(item.id)}`;
}

export function citation(item: ArchiveItem, format: 'apa' | 'bibtex' | 'ris', base: string): string {
  const authors = authorsOf(item);
  const year = item.year ?? 'n.d.';
  const publisher = item.meta.journal || item.meta.publisher || (item.meta.contributor?.institution ?? 'POLARIS polar knowledge archive');
  const url = recordUrl(base, item);
  if (format === 'apa') {
    const who = authors.length > 1 ? `${authors.slice(0, -1).join(', ')}, & ${authors[authors.length - 1]}` : authors[0];
    return `${who} (${year}). ${item.title} [${TYPE_LABEL[item.type] ?? item.type}]. ${publisher}. ${url}`;
  }
  if (format === 'bibtex') {
    const esc = (s: string) => String(s).replace(/[{}]/g, '');
    const kind = item.type === 'publication' ? 'article' : item.type === 'dataset' ? 'dataset' : 'misc';
    return (
      [
        `@${kind}{polaris_${item.id.replace(/[^A-Za-z0-9]/g, '_')},`,
        `  title = {${esc(item.title)}},`,
        `  author = {${esc(authors.join(' and '))}},`,
        item.type === 'publication' ? `  journal = {${esc(publisher)}},` : `  publisher = {${esc(publisher)}},`,
        `  year = {${year}},`,
        item.doi ? `  doi = {${esc(item.doi)}},` : `  howpublished = {\\url{${url}}},`,
        `  note = {${TYPE_LABEL[item.type] ?? item.type}; POLARIS record ${item.id}}`,
        '}',
      ].join('\n') + '\n'
    );
  }
  const ty = { publication: 'JOUR', dataset: 'DATA', photo: 'FIGURE', video: 'VIDEO', report: 'RPRT', expedition: 'GEN', activity: 'GEN' }[item.type] ?? 'GEN';
  return (
    [
      `TY  - ${ty}`,
      ...authors.map((a) => `AU  - ${a}`),
      `TI  - ${item.title}`,
      `PY  - ${year}`,
      `PB  - ${publisher}`,
      item.doi ? `DO  - ${item.doi}` : '',
      `UR  - ${url}`,
      item.summary ? `AB  - ${item.summary.replace(/\s+/g, ' ')}` : '',
      `ER  - `,
    ]
      .filter(Boolean)
      .join('\r\n') + '\r\n'
  );
}

// --- dataset series for charts ------------------------------------------------------------

function parseCsv(text: string, maxRows = 1000) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'));
  if (lines.length < 2) return null;
  const split = (l: string) => l.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
  const header = split(lines[0]);
  const rows = lines.slice(1, maxRows + 1).map(split);
  const numeric = header.map((_, i) => rows.filter((r) => r[i] !== undefined && r[i] !== '').every((r) => Number.isFinite(Number(r[i]))));
  const xIndex = numeric.findIndex((n) => !n) >= 0 ? numeric.findIndex((n) => !n) : -1;
  const columns = header.map((name, i) => ({ name, numeric: numeric[i] && i !== xIndex })).filter((c) => c.numeric).slice(0, 6);
  if (!columns.length) return null;
  return {
    x: xIndex >= 0 ? header[xIndex] : 'row',
    columns: columns.map((c) => c.name),
    rows: rows.map((r, n) => ({
      x: xIndex >= 0 ? r[xIndex] : String(n + 1),
      // Blank cells are gaps (NaN -> null in JSON), not zeros.
      values: columns.map((c) => {
        const cell = r[header.indexOf(c.name)];
        return cell === undefined || cell === '' ? NaN : Number(cell);
      }),
    })),
    truncated: lines.length - 1 > maxRows,
  };
}

// --- live conditions (Open-Meteo model data, no key) -------------------------------------------

const weatherCache = new Map<string, { at: number; body: any }>();

async function stationWeather(stationId: string) {
  const st = listStations().find((s) => s.id === stationId);
  if (!st) throw new HttpError(404, 'Station not found');
  const loc = stationLocation(st);
  if (!loc) throw new HttpError(404, 'Station has no coordinates');
  const hit = weatherCache.get(stationId);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.body;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,surface_pressure,cloud_cover' +
    '&hourly=temperature_2m&past_days=2&forecast_days=1&timezone=UTC';
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new HttpError(502, `Open-Meteo returned ${res.status}`);
  const d: any = await res.json();
  const body = {
    stationId,
    location: loc,
    current: d.current,
    units: d.current_units,
    hourly: (d.hourly?.time ?? []).map((t: string, i: number) => ({ time: t, temperature: d.hourly.temperature_2m[i] })),
    source: 'Open-Meteo forecast model (open-meteo.com), CC BY 4.0',
    dataStatus: 'EXTERNAL',
    note: 'Numerical weather model values for the station coordinates, not observations from station instruments.',
    fetchedAt: new Date().toISOString(),
  };
  weatherCache.set(stationId, { at: Date.now(), body });
  return body;
}

// --- learning: lesson packs + a quiz built only from database fields ----------------------------

function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function shuffle<T>(a: T[], r: () => number): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

async function buildQuiz(db: Db, seed: number) {
  const r = seeded(seed);
  const stations = listStations();
  const year = (s: string) => s.match(/(19|20)\d{2}/)?.[0] ?? null;
  const qs: any[] = [];
  const withYear = stations.map((s) => ({ s, y: year(s.commissionYear) })).filter((x) => x.y);
  for (const { s, y } of shuffle(withYear, r).slice(0, 3)) {
    const wrong = shuffle([...new Set(withYear.map((x) => x.y).filter((v) => v !== y))], r).slice(0, 3);
    qs.push({
      question: `In which year did ${s.name} start operating?`,
      options: shuffle([y, ...wrong], r),
      answer: y,
      explain: `${s.name}: ${s.commissionYear}.`,
      sourceId: `station:${s.id}`,
    });
  }
  for (const s of shuffle(stations, r).slice(0, 3)) {
    const wrong = shuffle(stations.filter((x) => x.id !== s.id), r).slice(0, 3).map((x) => x.locationName);
    qs.push({
      question: `Where is ${s.name}?`,
      options: shuffle([s.locationName, ...wrong], r),
      answer: s.locationName,
      explain: `${s.name} (${s.domain}) is at ${s.locationName}, ${s.coordinates}.`,
      sourceId: `station:${s.id}`,
    });
  }
  const milestones = (await db.all(`SELECT * FROM archive_items WHERE type = 'expedition' AND review_status = 'APPROVED' AND year IS NOT NULL ORDER BY year`)).map(rowToItem);
  for (const m of shuffle(milestones, r).slice(0, 4)) {
    const wrong = shuffle([...new Set(milestones.map((x) => String(x.year)).filter((v) => v !== String(m.year)))], r).slice(0, 3);
    if (wrong.length < 3) continue;
    qs.push({
      question: `When did this happen: "${m.title.replace(/^\d{4}[:\s-]*/, '')}"?`,
      options: shuffle([String(m.year), ...wrong], r),
      answer: String(m.year),
      explain: m.summary,
      sourceId: m.id,
    });
  }
  return shuffle(qs, r).slice(0, 8);
}

async function lessonPacks(db: Db) {
  const stations = listStations();
  const regions = [...new Set(stations.map((s) => s.domain))];
  return Promise.all(regions.map(async (region) => {
    const ids = stations.filter((s) => s.domain === region).map((s) => s.id);
    const rows = (await db.all(
      `SELECT * FROM archive_items WHERE review_status = 'APPROVED' AND (domain = ? OR station_id IN (${ids.map(() => '?').join(',') || "''"}))
       ORDER BY CASE type WHEN 'photo' THEN 0 WHEN 'video' THEN 1 WHEN 'expedition' THEN 2 WHEN 'dataset' THEN 3 ELSE 4 END, year DESC NULLS LAST LIMIT 8`,
      region,
      ...ids
    )).map(rowToItem);
    return {
      region,
      stations: stations.filter((s) => s.domain === region).map((s) => ({ id: s.id, name: s.name, locationName: s.locationName, description: s.description })),
      records: rows.map((i) => ({ id: i.id, type: i.type, title: i.title, summary: i.summary, year: i.year, thumbnailUrl: i.thumbnailUrl, dataStatus: i.dataStatus })),
    };
  }));
}

export function createExtrasRouter(db: Db) {
  const r = express.Router();

  r.post('/events', rateLimit(600, 10 * 60 * 1000), (req, res) => {
    const path = typeof req.body?.path === 'string' ? req.body.path : '';
    if (/^\/[\w\-/]*$/.test(path)) countUsage(db, 'page', path.replace(/\/(USR|OPEN)-[\w-]+/g, '/:id').slice(0, 60));
    res.status(204).end();
  });

  r.get(
    '/stations/:id/weather',
    wrap(async (req, res) => res.json(await stationWeather(req.params.id)))
  );

  r.get(
    '/archive/:id/cite',
    wrap(async (req, res) => {
      const item = await visible(req, req.params.id);
      if (!item) throw new HttpError(404, 'Record not found');
      const format = String(req.query.format || 'apa') as 'apa' | 'bibtex' | 'ris';
      if (!['apa', 'bibtex', 'ris'].includes(format)) throw new HttpError(400, 'format must be apa, bibtex or ris');
      const text = citation(item, format, publicBase(req));
      if (req.query.download) {
        const ext = { apa: 'txt', bibtex: 'bib', ris: 'ris' }[format];
        const type = { apa: 'text/plain', bibtex: 'application/x-bibtex', ris: 'application/x-research-info-systems' }[format];
        return sendDownload(res, `${item.id}.${ext}`, `${type}; charset=utf-8`, text);
      }
      res.json({ format, text });
    })
  );

  r.get(
    '/stations/:id/climate',
    wrap(async (req, res) => {
      const st = listStations().find((s) => s.id === req.params.id);
      if (!st) throw new HttpError(404, 'Station not found');
      try {
        res.json(await stationClimate(st));
      } catch (e) {
        throw new HttpError(502, `Climate history unavailable: ${(e as Error).message}`);
      }
    })
  );

  r.get(
    '/archive/:id/series',
    wrap(async (req, res) => {
      const item = await visible(req, req.params.id);
      if (!item) throw new HttpError(404, 'Record not found');
      if (item.meta.climateStation) {
        const st = listStations().find((s) => s.id === item.meta.climateStation);
        if (!st) throw new HttpError(404, 'Station not found');
        const c = await stationClimate(st);
        return res.json({
          x: 'year',
          columns: ['Annual mean air temperature (°C)', 'Coldest day minimum (°C)', 'Annual precipitation (mm)', 'Strongest daily wind (km/h)'],
          rows: c.annual.map((a) => ({ x: String(a.year), values: [a.tempMean, a.tempMin, a.precip, a.windMax] })),
          truncated: false,
          source: c.source,
          dataStatus: 'EXTERNAL',
        });
      }
      const text = /\.csv$/i.test(item.url || '') ? await readUploadText(item.url) : null;
      if (text !== null) {
        const parsed = parseCsv(text);
        if (!parsed) throw new HttpError(422, 'The uploaded CSV has no numeric columns to chart');
        return res.json({ ...parsed, source: 'Uploaded file', dataStatus: item.dataStatus });
      }
      if (item.type === 'dataset' && item.meta.sample) {
        const { vars, rows } = syntheticSeries(item, 168);
        return res.json({
          x: 'time_utc',
          columns: vars.map((v) => `${v.name} (${v.units})`),
          rows: rows.map((row) => ({ x: row.time, values: row.values })),
          truncated: false,
          source: 'Synthetic sample extract generated by POLARIS',
          dataStatus: 'SYNTHETIC',
        });
      }
      throw new HttpError(404, 'No chartable data is stored for this record');
    })
  );

  r.get('/atlas', wrap(async (_req, res) => {
    const stations = listStations();
    const items = (await db.all(`SELECT * FROM archive_items WHERE review_status = 'APPROVED' ORDER BY year DESC NULLS LAST LIMIT 3000`)).map(rowToItem);
    const points = [];
    for (const i of items) {
      const loc = itemLocation(i, stations);
      if (!loc) continue;
      points.push({
        id: i.id,
        type: i.type,
        title: i.title,
        year: i.year,
        stationId: i.stationId,
        dataStatus: i.dataStatus,
        lat: loc.lat,
        lon: loc.lon,
        basis: loc.basis,
        contributor: i.meta.contributor?.name ?? null,
      });
    }
    res.json({
      stations: stations.map((s) => ({ id: s.id, name: s.name, domain: s.domain, status: s.status, ...stationLocation(s) })),
      points,
      unmapped: items.length - points.length,
    });
  }));

  r.get(
    '/learn',
    wrap(async (req, res) => {
      const seed = intOrNull(req.query.seed, 'seed') ?? Math.floor(Date.now() / 86400_000);
      res.json({ packs: await lessonPacks(db), quiz: await buildQuiz(db, seed), seed });
    })
  );

  r.get(
    '/admin/analytics',
    requireRole('reviewer', 'admin'),
    wrap(async (req, res) => {
      const days = Math.min(Math.max(intOrNull(req.query.days, 'days') ?? 30, 1), 365);
      const since = new Date(Date.now() - (days - 1) * 86400_000).toISOString().slice(0, 10);
      const top = (kind: string, n = 10) =>
        db.all(`SELECT key, SUM(n) AS n FROM usage_counts WHERE kind = ? AND day >= ? GROUP BY key ORDER BY n DESC LIMIT ?`, kind, since, n);
      res.json({
        days,
        daily: await db.all(`SELECT day, kind, SUM(n) AS n FROM usage_counts WHERE day >= ? GROUP BY day, kind ORDER BY day`, since),
        totals: Object.fromEntries(
          (await db.all(`SELECT kind, SUM(n) AS n FROM usage_counts WHERE day >= ? GROUP BY kind`, since)).map((r) => [r.kind, r.n])
        ),
        topPages: await top('page'),
        topSearches: await top('search'),
        topDownloads: await top('download'),
        contributors: await db.all(
          `SELECT u.id, u.name, u.institution,
                  COUNT(*) FILTER (WHERE a.review_status = 'APPROVED') AS approved,
                  COUNT(*) FILTER (WHERE a.review_status = 'PENDING_REVIEW') AS pending
           FROM users u JOIN archive_items a ON a.owner_id = u.id GROUP BY u.id ORDER BY approved DESC LIMIT 10`
        ),
      });
    })
  );

  return r;
}

