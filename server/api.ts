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
import { answerQuestion } from './rag.ts';
import { providerStatus } from './llm.ts';
import { embedTexts, mlStatus } from './ml.ts';
import { HttpError, intOrNull, publicBase, rateLimit, sendDownload, str, tag, wrap } from './http.ts';
import { attachUser, createAuthRouter, createUsersRouter, isReviewer, requireRole } from './auth.ts';
import { checkAgainst, createContributorRouter, createDraft, createPublicContentRouter } from './contrib.ts';
import { countUsage, createExtrasRouter } from './extras.ts';
import { rawBody, saveUpload } from './uploads.ts';

export { UPLOAD_DIR } from './uploads.ts';


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

/** Records are public once a reviewer approved them (seeded records start approved). */
export const PUBLIC_SQL = "a.review_status = 'APPROVED'";

/** A record the caller may see: approved, their own, or any record for reviewers. */
function visibleItem(req: Request, id: string): ArchiveItem | null {
  const item = getItem(id);
  if (!item) return null;
  if (item.reviewStatus === 'APPROVED' || isReviewer(req.user) || (req.user && item.ownerId === req.user.id)) return item;
  return null;
}

/** Links including unapproved records, for reviewers looking at a submission. */
function linksForAll(id: string) {
  return getDb()
    .prepare(
      `SELECT a.id, a.type, a.title, l.relation, 'out' AS direction FROM item_links l JOIN archive_items a ON a.id = l.to_id WHERE l.from_id = ?
       UNION ALL
       SELECT a.id, a.type, a.title, l.relation, 'in' AS direction FROM item_links l JOIN archive_items a ON a.id = l.from_id WHERE l.to_id = ?`
    )
    .all(id, id);
}

function linksFor(id: string) {
  return getDb()
    .prepare(
      `SELECT a.id, a.type, a.title, l.relation, 'out' AS direction FROM item_links l JOIN archive_items a ON a.id = l.to_id WHERE l.from_id = ? AND ${PUBLIC_SQL}
       UNION ALL
       SELECT a.id, a.type, a.title, l.relation, 'in' AS direction FROM item_links l JOIN archive_items a ON a.id = l.from_id WHERE l.to_id = ? AND ${PUBLIC_SQL}`
    )
    .all(id, id) as { id: string; type: string; title: string; relation: string; direction: string }[];
}

/** Resolve a dataset by id, file name, or title (the UI passes whichever it has). */
function findDataset(ref: string): ArchiveItem | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM archive_items a WHERE type = 'dataset' AND ${PUBLIC_SQL}
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
  const rawUpload = (p: string) => p === '/admin/uploads' || p === '/me/uploads';
  api.use((req, res, next) => (rawUpload(req.path) ? next() : json(req, res, next)));
  api.use(attachUser(db));
  api.use('/auth', createAuthRouter(db));
  api.use('/me', createContributorRouter(db));
  api.use(createPublicContentRouter(db));
  api.use(createExtrasRouter(db));

  api.get('/health', (_req, res) => {
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM archive_items').get() as { n: number };
    res.json({ status: 'ok', archiveItems: n, time: new Date().toISOString() });
  });

  // Everything the SPA needs for first paint, in the shapes of src/types/polaris.ts.
  api.get('/bootstrap', (_req, res) => {
    const hotspots: Record<number, HotspotInfo> = {};
    for (const r of db.prepare('SELECT id, data FROM hotspots ORDER BY id').all() as any[]) hotspots[r.id] = JSON.parse(r.data);
    const milestones = (db.prepare(
      `SELECT * FROM archive_items a WHERE type = 'expedition' AND json_extract(meta, '$.milestone') = 1 AND ${PUBLIC_SQL} ORDER BY year`
    ).all() as any[]).map((r) => toMilestone(rowToItem(r)));
    const papers = (db.prepare(`SELECT * FROM archive_items a WHERE type = 'publication' AND ${PUBLIC_SQL} AND json_extract(meta, '$.openData') IS NULL ORDER BY rowid`).all() as any[]).map((r) =>
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
      (db.prepare(`SELECT type, COUNT(*) AS n FROM archive_items a WHERE ${PUBLIC_SQL} GROUP BY type`).all() as any[]).map((r) => [r.type, r.n])
    );
    const { downloads } = db.prepare(`SELECT COALESCE(SUM(downloads), 0) AS downloads FROM archive_items a WHERE ${PUBLIC_SQL}`).get() as any;
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
        (db.prepare(`SELECT type, COUNT(*) AS n FROM archive_items a WHERE station_id = ? AND ${PUBLIC_SQL} GROUP BY type`).all(req.params.id) as any[]).map(
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
        .prepare(`SELECT * FROM archive_items a WHERE station_id = ? AND type IN ('dataset','report','publication') AND ${PUBLIC_SQL} ORDER BY year DESC, rowid LIMIT 40`)
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
      const where: string[] = [PUBLIC_SQL];
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
      const item = visibleItem(req, req.params.id);
      if (!item) throw new HttpError(404, 'Record not found');
      res.json({ ...item, links: linksFor(item.id) });
    })
  );

  api.get(
    '/archive/:id/metadata.json',
    wrap((req, res) => {
      const item = visibleItem(req, req.params.id);
      if (!item) throw new HttpError(404, 'Record not found');
      sendDownload(res, `${item.id}.metadata.json`, 'application/json', JSON.stringify(metadataRecord(item, linksFor(item.id)), null, 2));
    })
  );

  api.get(
    '/publications/:id/citation.bib',
    wrap((req, res) => {
      const item = visibleItem(req, req.params.id);
      if (!item || item.type !== 'publication') throw new HttpError(404, 'Publication not found');
      sendDownload(res, `citation-${item.id}.bib`, 'application/x-bibtex; charset=utf-8', bibtex(item));
    })
  );

  api.get(
    '/datasets/:ref',
    wrap((req, res) => {
      const item = findDataset(req.params.ref);
      if (!item) throw new HttpError(404, 'Dataset not found');
      // Only POLARIS sample records get a generated CF header; real datasets are described by their own metadata.
      res.json({ ...item, header: item.meta.sample ? datasetHeader(item) : '', links: linksFor(item.id) });
    })
  );

  api.get(
    '/datasets/:ref/download',
    wrap((req, res) => {
      const item = findDataset(req.params.ref);
      if (!item) throw new HttpError(404, 'Dataset not found');
      db.prepare('UPDATE archive_items SET downloads = downloads + 1 WHERE id = ?').run(item.id);
      countUsage(db, 'download', item.id);
      // Real datasets: the contributor's uploaded file, or the publisher's landing page. Never generated values.
      if (!item.meta.sample) {
        if (item.url) return res.redirect(item.url);
        throw new HttpError(404, 'No downloadable file is stored for this dataset');
      }
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
      countUsage(db, 'search', q.toLowerCase().slice(0, 60));
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
      let items = (db.prepare(`SELECT * FROM archive_items a WHERE ${PUBLIC_SQL} ORDER BY year, rowid`).all() as any[]).map(rowToItem);
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
      countUsage(db, 'ask', 'assistant');
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
      const item = visibleItem(req, itemId) ?? findDataset(itemId);
      if (!item) throw new HttpError(404, 'Record not found');
      const requested: Channel[] = Array.isArray(req.body?.channels) && req.body.channels.length ? req.body.channels : CHANNELS;
      for (const c of requested) if (!CHANNELS.includes(c)) throw new HttpError(400, `Unknown channel: ${c}`);
      const link = `${publicBase(req)}/?record=${encodeURIComponent(item.id)}`;
      res.json({ itemId: item.id, link, content: generateContent(item, link, requested) });
    })
  );

  // --- admin ----------------------------------------------------------------------
  const admin = express.Router();
  admin.use(requireRole('reviewer', 'admin'));
  admin.use('/users', createUsersRouter(db));

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

  admin.post('/uploads', rawBody, wrap((req, res) => res.status(201).json(saveUpload(req))));

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

  // ---- contributor submissions: approve before anything becomes public -------------
  admin.get('/submissions', (req, res) => {
    const status = String(req.query.review || 'PENDING_REVIEW');
    if (!(REVIEW_STATUSES as readonly string[]).includes(status)) throw new HttpError(400, 'Unknown review status');
    const rows = db
      .prepare(
        `SELECT a.*, u.name AS owner_name, u.institution AS owner_institution FROM archive_items a
         JOIN users u ON u.id = a.owner_id WHERE a.review_status = ? ORDER BY a.rowid DESC`
      )
      .all(status) as any[];
    res.json(rows.map((r) => ({ ...rowToItem(r), ownerName: r.owner_name, ownerInstitution: r.owner_institution, links: linksForAll(r.id) })));
  });

  admin.post(
    '/archive/:id/review',
    wrap((req, res) => {
      const item = getItem(req.params.id);
      if (!item) throw new HttpError(404, 'Record not found');
      const action = str(req.body?.action, 'action', { required: true });
      const note = str(req.body?.note, 'note', { max: 1000 });
      const reviewer = req.user && req.user.id > 0 ? req.user.name : str(req.body?.reviewer, 'reviewer', { max: 80 });
      if (!reviewer) throw new HttpError(400, 'reviewer is required');
      const next = { approve: 'APPROVED', request_changes: 'CHANGES_REQUESTED', reject: 'REJECTED' }[action];
      if (!next) throw new HttpError(400, 'action must be one of: approve, request_changes, reject');
      if (next !== 'APPROVED' && !note) throw new HttpError(400, 'Add a note so the contributor knows what to change');
      const dataStatus = req.body?.dataStatus ? str(req.body.dataStatus, 'dataStatus') : item.dataStatus;
      if (!(DATA_STATUSES as readonly string[]).includes(dataStatus)) throw new HttpError(400, 'Invalid dataStatus');
      const provenance = { ...item.provenance, reviewedBy: reviewer, reviewedAt: new Date().toISOString(), reviewDecision: next };
      db.prepare(
        `UPDATE archive_items SET review_status = ?, review_note = ?, data_status = ?, provenance = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`
      ).run(next, note || null, dataStatus, JSON.stringify(provenance), item.id);
      res.json(getItem(item.id));
    })
  );

  // ---- outreach studio: draft -> claim check -> human review -> publish -------------
  const postRow = (id: unknown) => {
    const p = db.prepare('SELECT * FROM outreach_posts WHERE id = ?').get(id as any) as any;
    return p ? { ...p, claim_check: JSON.parse(p.claim_check || '{}') } : null;
  };

  admin.post(
    '/outreach/draft',
    wrap(async (req, res) => {
      const itemId = str(req.body?.itemId, 'itemId', { required: true, max: 120 });
      const item = getItem(itemId) ?? findDataset(itemId);
      if (!item) throw new HttpError(404, 'Record not found');
      const channel = str(req.body?.channel, 'channel', { required: true }) as Channel;
      if (!CHANNELS.includes(channel)) throw new HttpError(400, `channel must be one of: ${CHANNELS.join(', ')}`);
      const by = req.user && req.user.id > 0 ? req.user.id : null;
      res.status(201).json(await createDraft(db, item, channel, req.body?.mode !== 'template', publicBase(req), by));
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
        `SELECT p.*, a.title AS item_title, a.data_status AS item_data_status, a.review_status AS item_review_status,
                u.name AS author_name, u.institution AS author_institution
         FROM outreach_posts p JOIN archive_items a ON a.id = p.item_id
         LEFT JOIN users u ON u.id = COALESCE(p.created_by, a.owner_id)
         ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY p.id DESC`
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
      // Signed-in reviewers sign with their account name; the shared admin token must type one.
      const reviewer = str(b.reviewer, 'reviewer', { max: 80 }) || (req.user && req.user.id > 0 ? req.user.name : '');
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
        if (getItem(post.item_id)?.reviewStatus !== 'APPROVED') throw new HttpError(409, 'Approve the source record before publishing content about it');
        set({ status: 'PUBLISHED', published_at: now });
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
