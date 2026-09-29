import type { DatabaseSync } from 'node:sqlite';
import { rowToItem, type ArchiveItem } from './db.ts';
import { cosine, embedTexts, mlStatus } from './ml.ts';

/**
 * Hybrid retrieval: lexical BM25 (SQLite FTS5) + optional semantic embeddings
 * from ml/service.py, merged with reciprocal-rank fusion (RRF). With no ML
 * service or no stored embeddings, results are lexical only and say so.
 */

export interface SearchFilters {
  types?: string[];
  domain?: string;
  station?: string;
  yearFrom?: number | null;
  yearTo?: number | null;
  theme?: string;
  dataStatus?: string[];
}

export interface HybridHit extends ArchiveItem {
  snippet: string;
  score: number;
  lexicalRank: number | null;
  semanticRank: number | null;
  semanticScore: number | null;
}

export interface HybridResult {
  query: string;
  mode: 'hybrid' | 'lexical';
  semanticNote: string | null;
  matchedAllTerms: boolean;
  total: number;
  results: HybridHit[];
}

const STOPWORDS = new Set(
  ('a an and are as at be by conducted did do does done for from how in into is it of on or show ' +
    'that the their there these this to was were what when where which who why with me find about any all tell')
    .split(' ')
);

/** Split a natural-language query into search terms and year filters ("... at Maitri in 2023?"). */
export function parseQuery(q: string): { terms: string[]; years: number[] } {
  const terms: string[] = [];
  const years: number[] = [];
  for (const t of q.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (/^(19[5-9]\d|20\d\d)$/.test(t)) years.push(Number(t));
    else if (t.length >= 2 && !STOPWORDS.has(t)) terms.push(t);
  }
  return { terms: terms.slice(0, 12), years: [...new Set(years)] };
}

/** Turn search terms into a safe FTS5 query: every token quoted, prefix-matched. */
export function ftsQuery(q: string, mode: 'AND' | 'OR'): string | null {
  const { terms } = parseQuery(q);
  if (!terms.length) return null;
  return terms.map((t) => `"${t}"*`).join(mode === 'AND' ? ' ' : ' OR ');
}

function filterSql(f: SearchFilters): { sql: string; params: any[] } {
  // Only reviewer-approved records are searchable (contributor uploads wait for review).
  const where: string[] = ["a.review_status = 'APPROVED'"];
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
  return { sql: where.length ? ' AND ' + where.join(' AND ') : '', params };
}

function lexical(db: DatabaseSync, q: string, f: SearchFilters, limit: number) {
  const { terms, years } = parseQuery(q);
  const flt = filterSql(f);
  const yearSql = years.length ? ` AND a.year IN (${years.map(() => '?').join(',')})` : '';
  const run = (mode: 'AND' | 'OR', withYears: boolean): any[] => {
    const fts = ftsQuery(q, mode);
    const yp = withYears ? years : [];
    if (!fts) {
      if (!withYears || !years.length) return [];
      return db
        .prepare(`SELECT a.*, a.summary AS snippet, 0 AS bm25 FROM archive_items a WHERE 1=1 ${yearSql}${flt.sql} ORDER BY a.rowid DESC LIMIT ?`)
        .all(...yp, ...flt.params, limit) as any[];
    }
    return db
      .prepare(
        `SELECT a.*, snippet(archive_fts, -1, '[', ']', '…', 18) AS snippet,
                bm25(archive_fts, 8.0, 3.0, 1.0, 4.0, 1.0) AS bm25
         FROM archive_fts JOIN archive_items a ON a.rowid = archive_fts.rowid
         WHERE archive_fts MATCH ? ${withYears ? yearSql : ''}${flt.sql} ORDER BY bm25 LIMIT ?`
      )
      .all(fts, ...yp, ...flt.params, limit) as any[];
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
  return { rows, matchedAll };
}

async function semantic(db: DatabaseSync, q: string, f: SearchFilters, limit: number) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM item_embeddings').get() as any;
  if (!n) return { rows: [] as any[], note: 'No stored embeddings yet. Rebuild them from the admin page once the ML service is running.' };
  const status = await mlStatus();
  if (!status.available) return { rows: [] as any[], note: 'ML embedding service not reachable; showing lexical BM25 results only.' };
  const emb = await embedTexts([q]);
  if (!emb?.vectors?.[0]) return { rows: [] as any[], note: 'ML service did not return a query embedding; showing lexical results only.' };
  const flt = filterSql(f);
  const cands = db
    .prepare(`SELECT a.*, e.vector, e.model AS emb_model FROM archive_items a JOIN item_embeddings e ON e.item_id = a.id WHERE 1=1${flt.sql}`)
    .all(...flt.params) as any[];
  const qv = emb.vectors[0];
  const scored = cands
    .filter((r) => r.emb_model === emb.model)
    .map((r) => ({ ...r, sim: cosine(qv, JSON.parse(r.vector)) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, limit);
  const stale = cands.length && !cands.some((r) => r.emb_model === emb.model);
  return { rows: scored, note: stale ? `Stored embeddings were built with a different model than ${emb.model}; rebuild them.` : null };
}

export async function hybridSearch(db: DatabaseSync, q: string, f: SearchFilters = {}, limit = 20): Promise<HybridResult> {
  const pool = Math.max(limit * 2, 20);
  const lex = q.trim() ? lexical(db, q, f, pool) : { rows: [] as any[], matchedAll: true };
  const sem = q.trim() ? await semantic(db, q, f, pool) : { rows: [] as any[], note: null };

  const K = 60;
  const merged = new Map<string, { row: any; score: number; lexicalRank: number | null; semanticRank: number | null; sim: number | null }>();
  lex.rows.forEach((r, i) => merged.set(r.id, { row: r, score: 1 / (K + i + 1), lexicalRank: i + 1, semanticRank: null, sim: null }));
  sem.rows.forEach((r, i) => {
    const hit = merged.get(r.id);
    if (hit) {
      hit.score += 1 / (K + i + 1);
      hit.semanticRank = i + 1;
      hit.sim = r.sim;
    } else merged.set(r.id, { row: { ...r, snippet: r.summary }, score: 1 / (K + i + 1), lexicalRank: null, semanticRank: i + 1, sim: r.sim });
  });

  const results = [...merged.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((h) => ({
      ...rowToItem(h.row),
      snippet: h.row.snippet || h.row.summary,
      score: Number(h.score.toFixed(5)),
      lexicalRank: h.lexicalRank,
      semanticRank: h.semanticRank,
      semanticScore: h.sim === null ? null : Number(h.sim.toFixed(4)),
    }));

  return {
    query: q,
    mode: sem.rows.length ? 'hybrid' : 'lexical',
    semanticNote: sem.rows.length ? null : sem.note,
    matchedAllTerms: lex.matchedAll,
    total: results.length,
    results,
  };
}

export function facets(db: DatabaseSync) {
  const col = (sql: string) => (db.prepare(sql).all() as any[]).map((r) => Object.values(r)[0]);
  const tagCounts = new Map<string, number>();
  for (const r of db.prepare(`SELECT tags FROM archive_items WHERE review_status = 'APPROVED'`).all() as any[]) {
    for (const t of String(r.tags || '').split(',').map((x) => x.trim().toLowerCase()).filter((x) => x && x.length < 40)) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
  }
  const years = db.prepare(`SELECT MIN(year) AS min, MAX(year) AS max FROM archive_items WHERE year IS NOT NULL AND review_status = 'APPROVED'`).get() as any;
  return {
    domains: col(`SELECT DISTINCT domain FROM archive_items WHERE domain <> '' AND review_status = 'APPROVED' ORDER BY domain`),
    types: col(`SELECT DISTINCT type FROM archive_items WHERE review_status = 'APPROVED' ORDER BY type`),
    dataStatuses: col(`SELECT DISTINCT data_status FROM archive_items WHERE review_status = 'APPROVED' ORDER BY data_status`),
    stations: (db.prepare('SELECT data FROM stations ORDER BY sort').all() as any[]).map((r) => {
      const s = JSON.parse(r.data);
      return { id: s.id, name: s.name };
    }),
    years: { min: years?.min ?? null, max: years?.max ?? null },
    themes: [...tagCounts.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 24).map(([t]) => t),
  };
}
