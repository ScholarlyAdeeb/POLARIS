import express, { type Request, type Response, type NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { ScientificPaper, StationData, SimulationMission, HotspotInfo, ExpeditionMilestone } from '../src/types/polaris.ts';
import { getDb, getItem, insertItem, rowToItem, ARCHIVE_TYPES, type ArchiveItem, type ArchiveType } from './db.ts';
import { bibtex, datasetDownload, datasetHeader, metadataRecord, proposalTemplate, synopticCsv } from './files.ts';
import { CHANNELS, generateContent, type Channel } from './outreach.ts';

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

const STOPWORDS = new Set(
  ('a an and are as at be by conducted did do does done for from how in into is it of on or show ' +
    'that the their there these this to was were what when where which who why with me find about any all')
    .split(' ')
);

/** Split a natural-language query into search terms and year filters ("... at Maitri in 2023?"). */
function parseQuery(q: string): { terms: string[]; years: number[] } {
  const terms: string[] = [];
  const years: number[] = [];
  for (const t of q.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (/^(19[5-9]\d|20\d\d)$/.test(t)) years.push(Number(t));
    else if (t.length >= 2 && !STOPWORDS.has(t)) terms.push(t);
  }
  return { terms: terms.slice(0, 12), years: [...new Set(years)] };
}

/** Turn search terms into a safe FTS5 query: every token quoted, prefix-matched. */
function ftsQuery(q: string, mode: 'AND' | 'OR'): string | null {
  const { terms } = parseQuery(q);
  if (!terms.length) return null;
  return terms.map((t) => `"${t}"*`).join(mode === 'AND' ? ' ' : ' OR ');
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
      const row = db.prepare('SELECT data FROM stations WHERE id = ?').get(req.params.id) as any;
      if (!row) throw new HttpError(404, 'Station not found');
      const counts = Object.fromEntries(
        (db.prepare('SELECT type, COUNT(*) AS n FROM archive_items WHERE station_id = ? GROUP BY type').all(req.params.id) as any[]).map(
          (r) => [r.type, r.n]
        )
      );
      res.json({ ...JSON.parse(row.data), archiveCounts: counts });
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
      const where: string[] = [];
      const params: any[] = [];
      const types = String(req.query.type || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      for (const t of types) if (!ARCHIVE_TYPES.includes(t as ArchiveType)) throw new HttpError(400, `Unknown type: ${t}`);
      if (types.length) {
        where.push(`a.type IN (${types.map(() => '?').join(',')})`);
        params.push(...types);
      }
      if (req.query.domain) {
        where.push('a.domain = ?');
        params.push(String(req.query.domain));
      }
      if (req.query.station) {
        where.push('a.station_id = ?');
        params.push(String(req.query.station));
      }
      const year = intOrNull(req.query.year, 'year');
      if (year !== null) {
        where.push('a.year = ?');
        params.push(year);
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
    wrap((req, res) => {
      const q = str(req.query.q, 'q', { max: 200 });
      if (!q) return res.json({ query: q, results: [], stations: [], total: 0 });
      const limit = Math.min(Math.max(intOrNull(req.query.limit, 'limit') ?? 20, 1), 50);
      const { terms, years } = parseQuery(q);
      const yearSql = years.length ? `AND a.year IN (${years.map(() => '?').join(',')})` : '';
      const run = (mode: 'AND' | 'OR', withYears: boolean) => {
        const fts = ftsQuery(q, mode);
        if (!fts) {
          // Year-only query ("2023"): list that year's records
          if (!withYears || !years.length) return [];
          return db
            .prepare(`SELECT a.*, a.summary AS snippet FROM archive_items a WHERE 1=1 ${yearSql} ORDER BY a.rowid DESC LIMIT ?`)
            .all(...years, limit) as any[];
        }
        return db
          .prepare(
            `SELECT a.*, snippet(archive_fts, -1, '[', ']', '…', 18) AS snippet,
                    bm25(archive_fts, 8.0, 3.0, 1.0, 4.0, 1.0) AS score
             FROM archive_fts JOIN archive_items a ON a.rowid = archive_fts.rowid
             WHERE archive_fts MATCH ? ${withYears ? yearSql : ''} ORDER BY score LIMIT ?`
          )
          .all(fts, ...(withYears ? years : []), limit) as any[];
      };
      // Strictest first: all terms + year, then all terms, then any term.
      let rows = run('AND', true);
      let matchedAll = true;
      if (!rows.length && years.length && terms.length) rows = run('AND', false);
      if (!rows.length && terms.length > 1) {
        rows = run('OR', true);
        if (!rows.length && years.length) rows = run('OR', false);
        matchedAll = false;
      }
      const generic = new Set(['station', 'stations', 'research', 'base', 'observatory', 'polar']);
      const stations = listStations().filter((s) =>
        terms.some(
          (w) => w.length >= 4 && !generic.has(w) && [s.id, s.name, s.locationName, s.domain].some((f) => f.toLowerCase().includes(w))
        )
      );
      res.json({
        query: q,
        matchedAllTerms: matchedAll,
        total: rows.length,
        results: rows.map((r) => ({ ...rowToItem(r), snippet: r.snippet })),
        stations: stations.map((s) => ({ id: s.id, name: s.name, domain: s.domain, locationName: s.locationName })),
      });
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

  // Save generated outreach copy as drafts, then move them through review.
  admin.post(
    '/outreach',
    wrap((req, res) => {
      const itemId = str(req.body?.itemId, 'itemId', { required: true, max: 120 });
      if (!getItem(itemId)) throw new HttpError(404, 'Record not found');
      const channel = str(req.body?.channel, 'channel', { required: true }) as Channel;
      if (!CHANNELS.includes(channel)) throw new HttpError(400, `channel must be one of: ${CHANNELS.join(', ')}`);
      const content = str(req.body?.content, 'content', { required: true, max: 20000 });
      const { lastInsertRowid } = db
        .prepare('INSERT INTO outreach_posts (item_id, channel, content) VALUES (?, ?, ?)')
        .run(itemId, channel, content);
      res.status(201).json(db.prepare('SELECT * FROM outreach_posts WHERE id = ?').get(lastInsertRowid));
    })
  );

  admin.get('/outreach', (req, res) => {
    const status = req.query.status ? String(req.query.status) : null;
    res.json(
      status
        ? db.prepare('SELECT * FROM outreach_posts WHERE status = ? ORDER BY id DESC').all(status)
        : db.prepare('SELECT * FROM outreach_posts ORDER BY id DESC').all()
    );
  });

  admin.patch(
    '/outreach/:id',
    wrap((req, res) => {
      const id = intOrNull(req.params.id, 'id');
      const post = db.prepare('SELECT * FROM outreach_posts WHERE id = ?').get(id) as any;
      if (!post) throw new HttpError(404, 'Post not found');
      const status = req.body?.status !== undefined ? str(req.body.status, 'status') : post.status;
      if (!['DRAFT', 'APPROVED', 'PUBLISHED', 'ARCHIVED'].includes(status)) throw new HttpError(400, 'Invalid status');
      const content = req.body?.content !== undefined ? str(req.body.content, 'content', { required: true, max: 20000 }) : post.content;
      db.prepare(`UPDATE outreach_posts SET status = ?, content = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(
        status,
        content,
        id
      );
      res.json(db.prepare('SELECT * FROM outreach_posts WHERE id = ?').get(id));
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
