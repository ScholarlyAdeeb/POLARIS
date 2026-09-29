import express, { type Request, type Response, type NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { ScientificPaper, StationData, SimulationMission, HotspotInfo, ExpeditionMilestone } from '../src/types/polaris.ts';
import { getDb, getItem, insertItem, rowToItem, ARCHIVE_TYPES, type ArchiveItem, type ArchiveType } from './db.ts';
import { bibtex, datasetDownload, datasetHeader, metadataRecord, proposalTemplate, synopticCsv } from './files.ts';
import { CHANNELS, generateContent, type Channel } from './outreach.ts';
import { DATA_STATUSES, REVIEW_STATUSES } from './migrations.ts';
import { facets, ftsQuery, hybridSearch, parseQuery, type SearchFilters } from './search.ts';
import { answerQuestion, draftOutreachWithLlm, toSource, verifyClaims } from './rag.ts';
import { providerStatus } from './llm.ts';
import { embedTexts, mlStatus } from './ml.ts';

export const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || crypto.randomBytes(18).toString('base64url');
if (!process.env.ADMIN_TOKEN) {
  console.log(`[POLARIS] ADMIN_TOKEN not set; generated one for this run: ${ADMIN_TOKEN}`);
}

// --- helpers ------------------------------------------------------------------

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const wrap =
  (fn: (req: Request, res: Response) => unknown) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const out = fn(req, res);
      if (out instanceof Promise) out.catch(next);
    } catch (err) {
      next(err);
    }
  };

function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(token);
  const b = Buffer.from(ADMIN_TOKEN);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return next(new HttpError(401, 'Admin token required'));
  next();
}

function str(v: unknown, field: string, { required = false, max = 5000 } = {}): string {
  if (v === undefined || v === null || v === '') {
    if (required) throw new HttpError(400, `${field} is required`);
    return '';
  }
  if (typeof v !== 'string') throw new HttpError(400, `${field} must be a string`);
  const s = v.trim();
  if (required && !s) throw new HttpError(400, `${field} is required`);
  if (s.length > max) throw new HttpError(400, `${field} must be at most ${max} characters`);
  return s;
}

/** Tags are stored comma-separated, so a tag may not contain a comma. */
function tag(v: unknown): string {
  const t = str(v, 'tag', { max: 60 });
  if (t.includes(',')) throw new HttpError(400, `tag "${t}" must not contain a comma`);
  return t;
}

function intOrNull(v: unknown, field: string): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n)) throw new HttpError(400, `${field} must be an integer`);
  return n;
}

function publicBase(req: Request): string {
  const configured = process.env.APP_URL;
  if (configured && /^https?:\/\//.test(configured)) return configured.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function sendDownload(res: Response, filename: string, contentType: string, body: string | Buffer) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '')}"`);
  res.send(body);
}

// Tiny fixed-window limiter for public write endpoints.
function rateLimit(max: number, windowMs: number) {
  const hits = new Map<string, { n: number; reset: number }>();
  return (req: Request, _res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.reset < now) hits.set(key, { n: 1, reset: now + windowMs });
    else if (++h.n > max) return next(new HttpError(429, 'Too many requests, try again later'));
    next();
  };
}

// --- mappers --------------------------------------------------------------------

function toPaper(item: ArchiveItem): ScientificPaper {
  return {
    id: item.id,
    title: item.title,
    domain: item.domain,
    journal: item.meta.journal ?? '',
    acceptedDate: item.meta.acceptedDate ?? (item.year ? String(item.year) : ''),
    abstract: item.summary,
    authors: item.meta.authors ?? '',
    doi: item.doi ?? '',
    dataFile: item.meta.dataFile ?? '',
    fileSize: item.meta.fileSize ?? '',
  };
}

function toMilestone(item: ArchiveItem): ExpeditionMilestone {
  return {
    year: item.year ?? 0,
    title: item.title,
    leader: item.meta.leader ?? undefined,
    description: item.summary,
    highlights: item.meta.highlights ?? [],
    latLng: item.meta.latLng ?? [0, 0],
    badge: item.meta.badge ?? String(item.year ?? ''),
  };
}

function listStations(): StationData[] {
  return getDb()
    .prepare('SELECT data FROM stations ORDER BY sort')
    .all()
    .map((r: any) => JSON.parse(r.data));
}

function linksFor(id: string) {
  return getDb()
    .prepare(
      `SELECT a.id, a.type, a.title, l.relation, 'out' AS direction FROM item_links l JOIN archive_items a ON a.id = l.to_id WHERE l.from_id = ?
       UNION ALL
       SELECT a.id, a.type, a.title, l.relation, 'in' AS direction FROM item_links l JOIN archive_items a ON a.id = l.from_id WHERE l.to_id = ?`
    )
    .all(id, id) as { id: string; type: string; title: string; relation: string; direction: string }[];
}

/** Resolve a dataset by id, file name, or title (the UI passes whichever it has). */
function findDataset(ref: string): ArchiveItem | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM archive_items WHERE type = 'dataset'
         AND (id = ?1 OR json_extract(meta, '$.fileName') = ?1 OR title = ?1)
       LIMIT 1`
    )
    .get(ref);
  return row ? rowToItem(row) : null;
}


function listParam(v: unknown): string[] {
  return String(v ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function readFilters(q: Record<string, any>): SearchFilters {
  const types = listParam(q.type);
  for (const t of types) if (!ARCHIVE_TYPES.includes(t as ArchiveType)) throw new HttpError(400, `Unknown type: ${t}`);
  const dataStatus = listParam(q.status);
  for (const t of dataStatus) if (!(DATA_STATUSES as readonly string[]).includes(t)) throw new HttpError(400, `Unknown data status: ${t}`);
  return {
    types,
    dataStatus,
    domain: q.domain ? String(q.domain) : undefined,
    station: q.station ? String(q.station) : undefined,
    yearFrom: intOrNull(q.yearFrom, 'yearFrom'),
    yearTo: intOrNull(q.yearTo, 'yearTo'),
    theme: q.theme ? String(q.theme).slice(0, 60) : undefined,
  };
}

function stationRow(id: string) {
  return getDb().prepare('SELECT data, data_status, readings_status FROM stations WHERE id = ?').get(id) as any;
}

// --- router -------------------------------------------------------------------

export function createApiRouter() {
  const api = express.Router();
  const db = getDb();

  // Parse JSON here (not app-wide) so parse errors reach the JSON error handler below.
  // Uploads carry raw bytes and are parsed by their own route.
  const json = express.json({ limit: '1mb' });
  api.use((req, res, next) => (req.path === '/admin/uploads' ? next() : json(req, res, next)));

  api.get('/health', (_req, res) => {
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM archive_items').get() as { n: number };
    res.json({ status: 'ok', archiveItems: n, time: new Date().toISOString() });
  });

  // Everything the SPA needs for first paint, in the shapes of src/types/polaris.ts.
  api.get('/bootstrap', (_req, res) => {
    const hotspots: Record<number, HotspotInfo> = {};
    for (const r of db.prepare('SELECT id, data FROM hotspots ORDER BY id').all() as any[]) hotspots[r.id] = JSON.parse(r.data);
    const milestones = (db.prepare(
      `SELECT * FROM archive_items WHERE type = 'expedition' AND json_extract(meta, '$.milestone') = 1 ORDER BY year`
    ).all() as any[]).map((r) => toMilestone(rowToItem(r)));
    const papers = (db.prepare(`SELECT * FROM archive_items WHERE type = 'publication' ORDER BY rowid`).all() as any[]).map((r) =>
      toPaper(rowToItem(r))
    );
    const simulations: SimulationMission[] = (db.prepare('SELECT data FROM simulations ORDER BY sort').all() as any[]).map((r) =>
      JSON.parse(r.data)
    );
    const valueGraph = (db.prepare('SELECT data FROM value_graph_steps ORDER BY step').all() as any[]).map((r) => JSON.parse(r.data));
    res.json({ stations: listStations(), hotspots, milestones, papers, simulations, valueGraph });
  });

  api.get('/stats', (_req, res) => {
    const byType = Object.fromEntries(
      (db.prepare('SELECT type, COUNT(*) AS n FROM archive_items GROUP BY type').all() as any[]).map((r) => [r.type, r.n])
    );
    const { downloads } = db.prepare('SELECT COALESCE(SUM(downloads), 0) AS downloads FROM archive_items').get() as any;
    const { proposals } = db.prepare('SELECT COUNT(*) AS proposals FROM proposals').get() as any;
    const { posts } = db.prepare('SELECT COUNT(*) AS posts FROM outreach_posts').get() as any;
    res.json({ byType, downloads, proposals, outreachPosts: posts, stations: listStations().length });
  });

  // --- stations ---------------------------------------------------------------
  api.get('/stations', (_req, res) => res.json(listStations()));

  api.get(
    '/stations/:id',
    wrap((req, res) => {
      const row = stationRow(req.params.id);
      if (!row) throw new HttpError(404, 'Station not found');
      const counts = Object.fromEntries(
        (db.prepare('SELECT type, COUNT(*) AS n FROM archive_items WHERE station_id = ? GROUP BY type').all(req.params.id) as any[]).map(
          (r) => [r.type, r.n]
        )
      );
      res.json({ ...JSON.parse(row.data), archiveCounts: counts, dataStatus: row.data_status, readingsStatus: row.readings_status });
    })
  );

  // Hotspots for the station's 3D scene: curated instrument hotspots (hotspots table)
  // plus one hotspot per dataset/report/publication recorded at the station.
  api.get(
    '/stations/:id/hotspots',
    wrap((req, res) => {
      if (!stationRow(req.params.id)) throw new HttpError(404, 'Station not found');
      const out: any[] = [];
      const linked = new Set<string>();
      for (const r of db.prepare('SELECT id, data, data_status FROM hotspots WHERE station_id = ? ORDER BY id').all(req.params.id) as any[]) {
        const info: HotspotInfo = JSON.parse(r.data);
        const itemId = info.datasetTitle.split(':')[0].trim();
        const item = getItem(itemId);
        if (item) linked.add(item.id);
        out.push({ key: `hs-${r.id}`, kind: 'instrument', label: info.id, title: info.title, dataStatus: r.data_status, itemId: item?.id ?? null, itemType: item?.type ?? null, info });
      }
      const recs = db
        .prepare(`SELECT * FROM archive_items WHERE station_id = ? AND type IN ('dataset','report','publication') ORDER BY year DESC, rowid`)
        .all(req.params.id) as any[];
      for (const r of recs.map(rowToItem)) {
        if (linked.has(r.id)) continue;
        out.push({ key: `rec-${r.id}`, kind: 'record', label: r.type, title: r.title, dataStatus: r.dataStatus, itemId: r.id, itemType: r.type, summary: r.summary });
      }
      res.json({ stationId: req.params.id, hotspots: out });
    })
  );

  api.get(
    '/stations/:id/synoptic.csv',
    wrap((req, res) => {
      const row = db.prepare('SELECT data FROM stations WHERE id = ?').get(req.params.id) as any;
      if (!row) throw new HttpError(404, 'Station not found');
      const st: StationData = JSON.parse(row.data);
      sendDownload(res, `${st.id}-synoptic-72h.csv`, 'text/csv; charset=utf-8', synopticCsv(st));
    })
  );

  // --- archive (knowledge repository) -------------------------------------------
  api.get(
    '/archive',
    wrap((req, res) => {
      const f = readFilters(req.query);
      const where: string[] = [];
      const params: any[] = [];
      if (f.types?.length) {
        where.push(`a.type IN (${f.types.map(() => '?').join(',')})`);
        params.push(...f.types);
      }
      if (f.dataStatus?.length) {
        where.push(`a.data_status IN (${f.dataStatus.map(() => '?').join(',')})`);
        params.push(...f.dataStatus);
      }
      if (f.domain) {
        where.push('a.domain = ?');
        params.push(f.domain);
      }
      if (f.station) {
        where.push('a.station_id = ?');
        params.push(f.station);
      }
      const year = intOrNull(req.query.year, 'year');
      if (year !== null) {
        where.push('a.year = ?');
        params.push(year);
      }
      if (f.yearFrom != null) {
        where.push('a.year >= ?');
        params.push(f.yearFrom);
      }
      if (f.yearTo != null) {
        where.push('a.year <= ?');
        params.push(f.yearTo);
      }
      if (f.theme) {
        where.push("(',' || lower(a.tags) || ',') LIKE ?");
        params.push(`%${f.theme.toLowerCase()}%`);
      }
      let join = '';
      const q = String(req.query.q || '').trim();
      const fts = q ? ftsQuery(q, 'AND') : null;
      if (fts) {
        join = 'JOIN archive_fts f ON f.rowid = a.rowid';
        where.push('archive_fts MATCH ?');
        params.push(fts);
      }
      const sort =
        req.query.sort === 'downloads'
          ? 'a.downloads DESC'
          : req.query.sort === 'title'
          ? 'a.title COLLATE NOCASE'
          : req.query.sort === 'oldest'
          ? 'a.year ASC, a.rowid ASC'
          : 'a.year DESC, a.rowid DESC';
      const limit = Math.min(Math.max(intOrNull(req.query.limit, 'limit') ?? 24, 1), 100);
      const offset = Math.max(intOrNull(req.query.offset, 'offset') ?? 0, 0);
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const { total } = db.prepare(`SELECT COUNT(*) AS total FROM archive_items a ${join} ${whereSql}`).get(...params) as any;
      const rows = db
        .prepare(`SELECT a.* FROM archive_items a ${join} ${whereSql} ORDER BY ${sort} LIMIT ? OFFSET ?`)
        .all(...params, limit, offset);
      res.json({ items: rows.map(rowToItem), total, limit, offset });
    })
  );

  api.get(
    '/archive/:id',
    wrap((req, res) => {
      const item = getItem(req.params.id);
      if (!item) throw new HttpError(404, 'Record not found');
      res.json({ ...item, links: linksFor(item.id) });
    })
  );

  api.get(
    '/archive/:id/metadata.json',
    wrap((req, res) => {
      const item = getItem(req.params.id);
      if (!item) throw new HttpError(404, 'Record not found');
      sendDownload(res, `${item.id}.metadata.json`, 'application/json', JSON.stringify(metadataRecord(item, linksFor(item.id)), null, 2));
    })
  );

  api.get(
    '/publications/:id/citation.bib',
    wrap((req, res) => {
      const item = getItem(req.params.id);
      if (!item || item.type !== 'publication') throw new HttpError(404, 'Publication not found');
      sendDownload(res, `citation-${item.id}.bib`, 'application/x-bibtex; charset=utf-8', bibtex(item));
    })
  );

  api.get(
    '/datasets/:ref',
    wrap((req, res) => {
      const item = findDataset(req.params.ref);
      if (!item) throw new HttpError(404, 'Dataset not found');
      res.json({ ...item, header: datasetHeader(item), links: linksFor(item.id) });
    })
  );

  api.get(
    '/datasets/:ref/download',
    wrap((req, res) => {
      const item = findDataset(req.params.ref);
      if (!item) throw new HttpError(404, 'Dataset not found');
      db.prepare('UPDATE archive_items SET downloads = downloads + 1 WHERE id = ?').run(item.id);
      const file = datasetDownload(item);
      sendDownload(res, file.filename, file.contentType, file.body);
    })
  );

  // --- search -----------------------------------------------------------------
  api.get(
    '/search',
    wrap(async (req, res) => {
      const q = str(req.query.q, 'q', { max: 200 });
      const filters = readFilters(req.query);
      if (!q) return res.json({ query: q, mode: 'lexical', semanticNote: null, matchedAllTerms: true, results: [], stations: [], total: 0 });
      const limit = Math.min(Math.max(intOrNull(req.query.limit, 'limit') ?? 20, 1), 50);
      const result = await hybridSearch(db, q, filters, limit);
      const { terms } = parseQuery(q);
      const generic = new Set(['station', 'stations', 'research', 'base', 'observatory', 'polar']);
      const stations = listStations().filter((s) =>
        terms.some((w) => w.length >= 4 && !generic.has(w) && [s.id, s.name, s.locationName, s.domain].some((v) => v.toLowerCase().includes(w)))
      );
      res.json({
        ...result,
        stations: stations.map((s) => ({ id: s.id, name: s.name, domain: s.domain, locationName: s.locationName })),
      });
    })
  );

  api.get('/facets', (_req, res) => res.json(facets(db)));

  // --- knowledge graph: nodes and edges straight from the database -------------------
  api.get(
    '/graph',
    wrap((req, res) => {
      const station = req.query.station ? String(req.query.station) : null;
      const types = listParam(req.query.type);
      for (const t of types) if (!ARCHIVE_TYPES.includes(t as ArchiveType)) throw new HttpError(400, `Unknown type: ${t}`);
      const stations = listStations().filter((s) => !station || s.id === station);
      let items = (db.prepare('SELECT * FROM archive_items ORDER BY year, rowid').all() as any[]).map(rowToItem);
      const links = db.prepare('SELECT from_id, to_id, relation FROM item_links').all() as any[];
      if (station) {
        const seed = new Set(items.filter((i) => i.stationId === station).map((i) => i.id));
        for (const l of links) {
          if (seed.has(l.from_id)) seed.add(l.to_id);
          if (seed.has(l.to_id)) seed.add(l.from_id);
        }
        items = items.filter((i) => seed.has(i.id));
      }
      if (types.length) items = items.filter((i) => types.includes(i.type));
      const ids = new Set(items.map((i) => i.id));
      const stationIds = new Set(stations.map((s) => s.id));
      const nodes = [
        ...stations.map((s) => ({ id: `station:${s.id}`, kind: 'station', label: s.name, domain: s.domain, dataStatus: stationRow(s.id)?.data_status ?? 'UNVERIFIED' })),
        ...items.map((i) => ({ id: i.id, kind: i.type, label: i.title, year: i.year, stationId: i.stationId, dataStatus: i.dataStatus })),
      ];
      const edges = [
        ...links.filter((l) => ids.has(l.from_id) && ids.has(l.to_id)).map((l) => ({ id: `${l.from_id}>${l.relation}>${l.to_id}`, source: l.from_id, target: l.to_id, relation: l.relation, origin: 'item_links' })),
        ...items
          .filter((i) => i.stationId && stationIds.has(i.stationId))
          .map((i) => ({ id: `${i.id}>located_at>${i.stationId}`, source: i.id, target: `station:${i.stationId}`, relation: 'located_at', origin: 'archive_items.station_id' })),
      ];
      res.json({ nodes, edges });
    })
  );

  // --- Polar AI (retrieval-augmented, claim-verified) ---------------------------------
  api.get(
    '/ai/status',
    wrap(async (_req, res) => {
      const [llm, ml] = await Promise.all([providerStatus(), mlStatus()]);
      const { n } = db.prepare('SELECT COUNT(*) AS n FROM item_embeddings').get() as any;
      res.json({ llm, ml, embeddings: n });
    })
  );

  api.post(
    '/ai/ask',
    rateLimit(60, 10 * 60 * 1000),
    wrap(async (req, res) => {
      const question = str(req.body?.question, 'question', { required: true, max: 500 });
      res.json(await answerQuestion(db, question, readFilters(req.body?.filters ?? {})));
    })
  );

  // --- education ----------------------------------------------------------------
  api.get('/simulations', (_req, res) => {
    res.json((db.prepare('SELECT data FROM simulations ORDER BY sort').all() as any[]).map((r) => JSON.parse(r.data)));
  });

  // --- proposals ----------------------------------------------------------------
  api.get('/proposals/template', (_req, res) =>
    sendDownload(res, 'NCPOR_46th_ISEA_Proposal_Template.txt', 'text/plain; charset=utf-8', proposalTemplate())
  );

  const PLATFORMS = ['bharati', 'maitri', 'himadri', 'himansh', 'sagar-kanya', 'sagar-nidhi'];

  api.post(
    '/proposals',
    rateLimit(10, 60 * 60 * 1000),
    wrap((req, res) => {
      const b = req.body ?? {};
      const title = str(b.title, 'title', { required: true, max: 200 });
      const piName = str(b.piName, 'piName', { required: true, max: 120 });
      const affiliation = str(b.affiliation, 'affiliation', { required: true, max: 200 });
      const email = str(b.email, 'email', { required: true, max: 200 });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'email is not valid');
      const platform = str(b.platform, 'platform', { required: true, max: 40 });
      if (!PLATFORMS.includes(platform)) throw new HttpError(400, `platform must be one of: ${PLATFORMS.join(', ')}`);
      const domain = str(b.domain, 'domain', { max: 80 });
      const summary = str(b.summary, 'summary', { required: true, max: 2500 });
      const words = summary.split(/\s+/).filter(Boolean).length;
      if (words > 300) throw new HttpError(400, `summary must be at most 300 words (got ${words})`);
      const berths = intOrNull(b.berths, 'berths');
      if (berths !== null && (berths < 1 || berths > 20)) throw new HttpError(400, 'berths must be between 1 and 20');

      const year = new Date().getUTCFullYear();
      const reference = `NCPOR-PRP-${year}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      db.prepare(
        `INSERT INTO proposals (reference, title, pi_name, affiliation, email, platform, domain, summary, berths)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(reference, title, piName, affiliation, email, platform, domain, summary, berths);
      res.status(201).json({ reference, status: 'SUBMITTED' });
    })
  );

  // --- outreach content generation ------------------------------------------------
  api.post(
    '/outreach/generate',
    wrap((req, res) => {
      const itemId = str(req.body?.itemId, 'itemId', { required: true, max: 120 });
      const item = getItem(itemId) ?? findDataset(itemId);
      if (!item) throw new HttpError(404, 'Record not found');
      const requested: Channel[] = Array.isArray(req.body?.channels) && req.body.channels.length ? req.body.channels : CHANNELS;
      for (const c of requested) if (!CHANNELS.includes(c)) throw new HttpError(400, `Unknown channel: ${c}`);
      const link = `${publicBase(req)}/?record=${encodeURIComponent(item.id)}`;
      res.json({ itemId: item.id, link, content: generateContent(item, link, requested) });
    })
  );

  // --- admin ----------------------------------------------------------------------
  const admin = express.Router();
  admin.use(requireAdmin);

  admin.post(
    '/archive',
    wrap((req, res) => {
      const b = req.body ?? {};
      const type = str(b.type, 'type', { required: true }) as ArchiveType;
      if (!ARCHIVE_TYPES.includes(type)) throw new HttpError(400, `type must be one of: ${ARCHIVE_TYPES.join(', ')}`);
      const title = str(b.title, 'title', { required: true, max: 300 });
      const id = str(b.id, 'id', { max: 120 }) || `${type.toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      if (!/^[A-Za-z0-9._-]+$/.test(id)) throw new HttpError(400, 'id may only contain letters, digits, . _ -');
      if (getItem(id)) throw new HttpError(409, `A record with id ${id} already exists`);
      if (b.tags !== undefined && !Array.isArray(b.tags)) throw new HttpError(400, 'tags must be an array of strings');
      if (b.meta !== undefined && (typeof b.meta !== 'object' || Array.isArray(b.meta))) throw new HttpError(400, 'meta must be an object');
      insertItem(db, {
        id,
        type,
        title,
        summary: str(b.summary, 'summary', { max: 5000 }),
        body: str(b.body, 'body', { max: 50000 }),
        domain: str(b.domain, 'domain', { max: 80 }),
        stationId: str(b.stationId, 'stationId', { max: 60 }) || null,
        year: intOrNull(b.year, 'year'),
        date: str(b.date, 'date', { max: 40 }) || null,
        tags: (b.tags ?? []).map(tag).filter(Boolean),
        url: str(b.url, 'url', { max: 2000 }) || null,
        thumbnailUrl: str(b.thumbnailUrl, 'thumbnailUrl', { max: 2000 }) || null,
        doi: str(b.doi, 'doi', { max: 200 }) || null,
        meta: b.meta ?? {},
        ...(b.dataStatus ? { dataStatus: (DATA_STATUSES as readonly string[]).includes(b.dataStatus) ? b.dataStatus : (() => { throw new HttpError(400, 'Invalid dataStatus'); })() } : {}),
        ...(b.provenance && typeof b.provenance === 'object' ? { provenance: b.provenance } : {}),
      });
      if (Array.isArray(b.links)) {
        const ins = db.prepare('INSERT OR IGNORE INTO item_links (from_id, to_id, relation) VALUES (?, ?, ?)');
        for (const l of b.links) {
          const to = str(l?.to, 'links[].to', { required: true, max: 120 });
          if (!getItem(to)) throw new HttpError(400, `Linked record ${to} does not exist`);
          ins.run(id, to, str(l?.relation, 'links[].relation', { max: 40 }) || 'related');
        }
      }
      res.status(201).json(getItem(id));
    })
  );

  admin.patch(
    '/archive/:id',
    wrap((req, res) => {
      const item = getItem(req.params.id);
      if (!item) throw new HttpError(404, 'Record not found');
      const b = req.body ?? {};
      const cols: Record<string, [string, (v: unknown) => unknown]> = {
        title: ['title', (v) => str(v, 'title', { required: true, max: 300 })],
        summary: ['summary', (v) => str(v, 'summary', { max: 5000 })],
        body: ['body', (v) => str(v, 'body', { max: 50000 })],
        domain: ['domain', (v) => str(v, 'domain', { max: 80 })],
        stationId: ['station_id', (v) => str(v, 'stationId', { max: 60 }) || null],
        year: ['year', (v) => intOrNull(v, 'year')],
        date: ['date', (v) => str(v, 'date', { max: 40 }) || null],
        url: ['url', (v) => str(v, 'url', { max: 2000 }) || null],
        thumbnailUrl: ['thumbnail_url', (v) => str(v, 'thumbnailUrl', { max: 2000 }) || null],
        doi: ['doi', (v) => str(v, 'doi', { max: 200 }) || null],
        dataStatus: [
          'data_status',
          (v) => {
            const st = str(v, 'dataStatus', { required: true });
            if (!(DATA_STATUSES as readonly string[]).includes(st)) throw new HttpError(400, `dataStatus must be one of: ${DATA_STATUSES.join(', ')}`);
            return st;
          },
        ],
        reviewStatus: [
          'review_status',
          (v) => {
            const st = str(v, 'reviewStatus', { required: true });
            if (!(REVIEW_STATUSES as readonly string[]).includes(st)) throw new HttpError(400, `reviewStatus must be one of: ${REVIEW_STATUSES.join(', ')}`);
            return st;
          },
        ],
        provenance: [
          'provenance',
          (v) => {
            if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new HttpError(400, 'provenance must be an object');
            return JSON.stringify({ ...item.provenance, ...v });
          },
        ],
        tags: [
          'tags',
          (v) => {
            if (!Array.isArray(v)) throw new HttpError(400, 'tags must be an array of strings');
            return v.map(tag).filter(Boolean).join(', ');
          },
        ],
        meta: [
          'meta',
          (v) => {
            if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new HttpError(400, 'meta must be an object');
            return JSON.stringify({ ...item.meta, ...v });
          },
        ],
      };
      const sets: string[] = [];
      const params: any[] = [];
      for (const [key, [col, parse]] of Object.entries(cols)) {
        if (key in b) {
          sets.push(`${col} = ?`);
          params.push(parse(b[key]));
        }
      }
      if (!sets.length) throw new HttpError(400, 'Nothing to update');
      sets.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`);
      db.prepare(`UPDATE archive_items SET ${sets.join(', ')} WHERE id = ?`).run(...params, item.id);
      res.json(getItem(item.id));
    })
  );

  admin.delete(
    '/archive/:id',
    wrap((req, res) => {
      const { changes } = db.prepare('DELETE FROM archive_items WHERE id = ?').run(req.params.id);
      if (!changes) throw new HttpError(404, 'Record not found');
      res.status(204).end();
    })
  );

  const UPLOAD_TYPES: Record<string, string> = {
    '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.webp': 'image', '.gif': 'image',
    '.mp4': 'video', '.webm': 'video',
    '.pdf': 'document', '.csv': 'data', '.nc': 'data', '.txt': 'document', '.json': 'data',
  };

  admin.post(
    '/uploads',
    express.raw({ type: () => true, limit: process.env.MAX_UPLOAD || '100mb' }),
    wrap((req, res) => {
      const original = str(req.get('x-filename'), 'X-Filename header', { required: true, max: 200 });
      const ext = path.extname(original).toLowerCase();
      if (!UPLOAD_TYPES[ext]) throw new HttpError(400, `File type ${ext || '(none)'} is not allowed`);
      if (!Buffer.isBuffer(req.body) || !req.body.length) throw new HttpError(400, 'Empty upload');
      const safeBase = path.basename(original, ext).replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 60) || 'file';
      const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeBase}${ext}`;
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      fs.writeFileSync(path.join(UPLOAD_DIR, name), req.body);
      res.status(201).json({ url: `/uploads/${name}`, kind: UPLOAD_TYPES[ext], bytes: req.body.length });
    })
  );

  admin.get('/proposals', (_req, res) => {
    res.json(db.prepare('SELECT * FROM proposals ORDER BY id DESC').all());
  });

  admin.patch(
    '/proposals/:reference',
    wrap((req, res) => {
      const status = str(req.body?.status, 'status', { required: true });
      const allowed = ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'ACCEPTED', 'DECLINED'];
      if (!allowed.includes(status)) throw new HttpError(400, `status must be one of: ${allowed.join(', ')}`);
      const { changes } = db.prepare('UPDATE proposals SET status = ? WHERE reference = ?').run(status, req.params.reference);
      if (!changes) throw new HttpError(404, 'Proposal not found');
      res.json(db.prepare('SELECT * FROM proposals WHERE reference = ?').get(req.params.reference));
    })
  );

  admin.get(
    '/overview',
    wrap(async (_req, res) => {
      const group = (sql: string) => Object.fromEntries((db.prepare(sql).all() as any[]).map((r) => [r.k, r.n]));
      const [llm, ml] = await Promise.all([providerStatus(), mlStatus(true)]);
      res.json({
        archiveByStatus: group('SELECT data_status AS k, COUNT(*) AS n FROM archive_items GROUP BY data_status'),
        outreachByReview: group('SELECT review_status AS k, COUNT(*) AS n FROM outreach_posts GROUP BY review_status'),
        proposalsByStatus: group('SELECT status AS k, COUNT(*) AS n FROM proposals GROUP BY status'),
        embeddings: (db.prepare('SELECT COUNT(*) AS n FROM item_embeddings').get() as any).n,
        aiQueries: (db.prepare('SELECT COUNT(*) AS n FROM ai_queries').get() as any).n,
        migrations: db.prepare('SELECT version, name, applied_at FROM schema_migrations ORDER BY version').all(),
        llm,
        ml,
      });
    })
  );

  admin.post(
    '/embeddings/rebuild',
    wrap(async (_req, res) => {
      const items = (db.prepare('SELECT * FROM archive_items ORDER BY rowid').all() as any[]).map(rowToItem);
      const texts = items.map((i) => [i.title, i.summary, i.tags.join(', '), i.body].filter(Boolean).join('. ').slice(0, 2000));
      const out = await embedTexts(texts);
      if (!out || out.vectors.length !== items.length) throw new HttpError(503, 'ML embedding service is not reachable (see ml/README.md)');
      const up = db.prepare(
        `INSERT INTO item_embeddings (item_id, model, dim, vector) VALUES (?, ?, ?, ?)
         ON CONFLICT(item_id) DO UPDATE SET model = excluded.model, dim = excluded.dim, vector = excluded.vector, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`
      );
      db.exec('BEGIN');
      items.forEach((it, i) => up.run(it.id, out.model, out.vectors[i].length, JSON.stringify(out.vectors[i])));
      db.exec('COMMIT');
      res.json({ embedded: items.length, model: out.model, dim: out.vectors[0]?.length ?? 0 });
    })
  );

  // ---- outreach studio: draft -> claim check -> human review -> publish -------------
  const postRow = (id: unknown) => {
    const p = db.prepare('SELECT * FROM outreach_posts WHERE id = ?').get(id as any) as any;
    return p ? { ...p, claim_check: JSON.parse(p.claim_check || '{}') } : null;
  };
  const checkAgainst = (itemId: string, content: string) => {
    const item = getItem(itemId);
    return item ? verifyClaims(content, [toSource(item, 0)]) : null;
  };

  admin.post(
    '/outreach/draft',
    wrap(async (req, res) => {
      const itemId = str(req.body?.itemId, 'itemId', { required: true, max: 120 });
      const item = getItem(itemId) ?? findDataset(itemId);
      if (!item) throw new HttpError(404, 'Record not found');
      const channel = str(req.body?.channel, 'channel', { required: true }) as Channel;
      if (!CHANNELS.includes(channel)) throw new HttpError(400, `channel must be one of: ${CHANNELS.join(', ')}`);
      const wantAi = req.body?.mode !== 'template';
      let content = '';
      let provider = 'template';
      let dataStatus = 'TEMPLATE';
      if (wantAi) {
        const { gen } = await draftOutreachWithLlm(item, channel);
        if (gen) {
          content = gen.text.replace(/\[S1\]/g, '').replace(/[ \t]+\n/g, '\n').trim();
          provider = `${gen.provider}:${gen.model}`;
          dataStatus = 'AI_GENERATED';
        }
      }
      if (!content) {
        const link = `${publicBase(req)}/?record=${encodeURIComponent(item.id)}`;
        const t = generateContent(item, link, [channel])[0];
        content = [t.title, t.text].filter(Boolean).join('\n\n');
      }
      const check = checkAgainst(item.id, content);
      const { lastInsertRowid } = db
        .prepare(
          `INSERT INTO outreach_posts (item_id, channel, content, status, data_status, review_status, provider, claim_check)
           VALUES (?, ?, ?, 'DRAFT', ?, 'PENDING_REVIEW', ?, ?)`
        )
        .run(item.id, channel, content, dataStatus, provider, JSON.stringify(check ?? {}));
      res.status(201).json({ ...postRow(lastInsertRowid), aiRequested: wantAi, aiUsed: dataStatus === 'AI_GENERATED' });
    })
  );

  // Save hand-written/edited copy as a draft (always needs review).
  admin.post(
    '/outreach',
    wrap((req, res) => {
      const itemId = str(req.body?.itemId, 'itemId', { required: true, max: 120 });
      if (!getItem(itemId)) throw new HttpError(404, 'Record not found');
      const channel = str(req.body?.channel, 'channel', { required: true }) as Channel;
      if (!CHANNELS.includes(channel)) throw new HttpError(400, `channel must be one of: ${CHANNELS.join(', ')}`);
      const content = str(req.body?.content, 'content', { required: true, max: 20000 });
      const { lastInsertRowid } = db
        .prepare(`INSERT INTO outreach_posts (item_id, channel, content, data_status, provider, claim_check) VALUES (?, ?, ?, 'TEMPLATE', 'template', ?)`)
        .run(itemId, channel, content, JSON.stringify(checkAgainst(itemId, content) ?? {}));
      res.status(201).json(postRow(lastInsertRowid));
    })
  );

  admin.get('/outreach', (req, res) => {
    const where: string[] = [];
    const params: any[] = [];
    if (req.query.status) {
      where.push('p.status = ?');
      params.push(String(req.query.status));
    }
    if (req.query.review) {
      where.push('p.review_status = ?');
      params.push(String(req.query.review));
    }
    const rows = db
      .prepare(
        `SELECT p.*, a.title AS item_title, a.data_status AS item_data_status FROM outreach_posts p
         JOIN archive_items a ON a.id = p.item_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.id DESC`
      )
      .all(...params) as any[];
    res.json(rows.map((p) => ({ ...p, claim_check: JSON.parse(p.claim_check || '{}') })));
  });

  /**
   * Review actions. Rules enforced here, not just in the UI:
   *  - editing content re-runs the claim check and sends the post back to PENDING_REVIEW;
   *  - approval needs a named reviewer, and an explicit override note if any claim is unsupported;
   *  - only APPROVED posts can be published. Nothing is ever auto-published.
   */
  admin.patch(
    '/outreach/:id',
    wrap((req, res) => {
      const id = intOrNull(req.params.id, 'id');
      const post = postRow(id);
      if (!post) throw new HttpError(404, 'Post not found');
      const b = req.body ?? {};
      const action = str(b.action, 'action', { max: 30 }) || (b.status ? 'status' : b.content !== undefined ? 'edit' : '');
      const reviewer = str(b.reviewer, 'reviewer', { max: 80 });
      const note = str(b.note, 'note', { max: 1000 });
      const set = (fields: Record<string, unknown>) => {
        const keys = Object.keys(fields);
        db.prepare(`UPDATE outreach_posts SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(
          ...keys.map((k) => fields[k] as any),
          id
        );
      };
      const now = new Date().toISOString();
      if (action === 'edit') {
        const content = str(b.content, 'content', { required: true, max: 20000 });
        set({ content, claim_check: JSON.stringify(checkAgainst(post.item_id, content) ?? {}), review_status: 'PENDING_REVIEW', status: 'DRAFT' });
      } else if (action === 'approve') {
        if (!reviewer) throw new HttpError(400, 'reviewer is required to approve');
        if ((post.claim_check?.unsupported ?? 0) > 0 && !note)
          throw new HttpError(409, 'This draft has unsupported claims. Fix them, or approve with a note explaining why.');
        set({ review_status: 'APPROVED', status: 'APPROVED', reviewer, review_note: note || null, reviewed_at: now });
      } else if (action === 'request_changes' || action === 'reject') {
        if (!reviewer) throw new HttpError(400, 'reviewer is required');
        set({ review_status: action === 'reject' ? 'REJECTED' : 'CHANGES_REQUESTED', status: action === 'reject' ? 'ARCHIVED' : 'DRAFT', reviewer, review_note: note || null, reviewed_at: now });
      } else if (action === 'publish' || (action === 'status' && b.status === 'PUBLISHED')) {
        if (post.review_status !== 'APPROVED') throw new HttpError(409, 'Only human-approved posts can be published');
        set({ status: 'PUBLISHED' });
      } else if (action === 'status') {
        const status = str(b.status, 'status');
        if (!['DRAFT', 'APPROVED', 'ARCHIVED'].includes(status)) throw new HttpError(400, 'Invalid status');
        if (status === 'APPROVED' && post.review_status !== 'APPROVED') throw new HttpError(409, 'Use action "approve" with a reviewer name');
        set({ status });
      } else throw new HttpError(400, 'action must be one of: edit, approve, request_changes, reject, publish');
      res.json(postRow(id));
    })
  );

  api.use('/admin', admin);

  api.use((_req, _res, next) => next(new HttpError(404, 'Not found')));

  api.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Payload too large' });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body' });
    console.error('[POLARIS API]', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return api;
}
