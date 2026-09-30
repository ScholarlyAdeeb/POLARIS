import type { Db } from './pg.ts';
import { rowToItem, listStations, type ArchiveItem } from './db.ts';

/**
 * Full-text search over the archive with PostgreSQL (weighted tsvector + GIN index, ranked with
 * ts_rank_cd). Natural-language questions work: stopwords are dropped and years become filters.
 * If no record matches every term, it falls back to records matching any term and says so.
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

export interface SearchHit extends ArchiveItem {
  snippet: string;
  score: number;
  rank: number;
}

export interface SearchResult {
  query: string;
  matchedAllTerms: boolean;
  total: number;
  results: SearchHit[];
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

/** Search terms as a safe to_tsquery() string: every term prefix-matched, joined with AND or OR. */
export function tsQuery(q: string, mode: 'AND' | 'OR'): string | null {
  const { terms } = parseQuery(q);
  if (!terms.length) return null;
  return terms.map((t) => `${t}:*`).join(mode === 'AND' ? ' & ' : ' | ');
}

/** Only reviewer-approved records are searchable (contributor uploads wait for review). */
export function filterSql(f: SearchFilters): { sql: string; params: any[] } {
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
  return { sql: ' AND ' + where.join(' AND '), params };
}

export async function search(db: Db, q: string, f: SearchFilters = {}, limit = 20): Promise<SearchResult> {
  const { terms, years } = parseQuery(q);
  const flt = filterSql(f);
  const yearSql = years.length ? ` AND a.year IN (${years.map(() => '?').join(',')})` : '';

  const run = async (mode: 'AND' | 'OR', withYears: boolean): Promise<any[]> => {
    const ts = tsQuery(q, mode);
    const yp = withYears ? years : [];
    if (!ts) {
      if (!withYears || !years.length) return [];
      return db.all(
        `SELECT a.*, a.summary AS snippet, 0 AS rank FROM archive_items a WHERE true ${yearSql}${flt.sql} ORDER BY a.rowid DESC LIMIT ?`,
        ...yp,
        ...flt.params,
        limit
      );
    }
    return db.all(
      `SELECT a.*, ts_headline('english', a.title || '. ' || a.summary, query, 'StartSel=[, StopSel=], MaxWords=26, MinWords=10') AS snippet,
              ts_rank_cd(a.search, query) AS rank
       FROM archive_items a, to_tsquery('english', ?) query
       WHERE a.search @@ query ${withYears ? yearSql : ''}${flt.sql}
       ORDER BY rank DESC, a.year DESC NULLS LAST LIMIT ?`,
      ts,
      ...yp,
      ...flt.params,
      limit
    );
  };

  // Strictest first: all terms + year, then all terms, then any term.
  let rows = await run('AND', true);
  let matchedAll = true;
  if (!rows.length && years.length && terms.length) rows = await run('AND', false);
  if (!rows.length && terms.length > 1) {
    rows = await run('OR', true);
    if (!rows.length && years.length) rows = await run('OR', false);
    matchedAll = false;
  }
  const results = rows.map((r, i) => ({ ...rowToItem(r), snippet: r.snippet || r.summary, score: Number(Number(r.rank).toFixed(5)), rank: i + 1 }));
  return { query: q, matchedAllTerms: matchedAll, total: results.length, results };
}

export async function facets(db: Db) {
  const col = async (sql: string) => (await db.all(sql)).map((r) => Object.values(r)[0]);
  const tagCounts = new Map<string, number>();
  for (const r of await db.all(`SELECT tags FROM archive_items WHERE review_status = 'APPROVED'`)) {
    for (const t of String(r.tags || '').split(',').map((x) => x.trim().toLowerCase()).filter((x) => x && x.length < 40)) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
  }
  const years = await db.get(`SELECT MIN(year) AS min, MAX(year) AS max FROM archive_items WHERE year IS NOT NULL AND review_status = 'APPROVED'`);
  return {
    domains: await col(`SELECT DISTINCT domain FROM archive_items WHERE domain <> '' AND review_status = 'APPROVED' ORDER BY domain`),
    types: await col(`SELECT DISTINCT type FROM archive_items WHERE review_status = 'APPROVED' ORDER BY type`),
    dataStatuses: await col(`SELECT DISTINCT data_status FROM archive_items WHERE review_status = 'APPROVED' ORDER BY data_status`),
    stations: listStations().map((s) => ({ id: s.id, name: s.name })),
    years: { min: years?.min ?? null, max: years?.max ?? null },
    themes: [...tagCounts.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 24).map(([t]) => t),
  };
}
