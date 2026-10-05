import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Db } from '../pg.ts';
import { NOW } from '../pg.ts';
import { listStations, rowToItem, type ArchiveItem } from '../db.ts';
import { UPLOAD_DIR } from '../uploads.ts';
import { TYPE_LABEL } from '../outreach.ts';
import { ragConfig } from './config.ts';
import { embed } from './models.ts';

/**
 * The RAG index: every approved record on the portal (contributor uploads once a reviewer approves
 * them, seeded records, open-data metadata) is split into chunks, embedded and stored in pgvector.
 * Text inside uploaded PDF, TXT, CSV and JSON files is indexed with its record. A content hash per
 * record keeps the index in step: changed records are re-embedded, unpublished ones are removed.
 */

const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS rag_chunks (
  id BIGSERIAL PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES archive_items(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding vector(384) NOT NULL,
  search tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
);
CREATE INDEX IF NOT EXISTS rag_chunks_item ON rag_chunks(item_id);
CREATE INDEX IF NOT EXISTS rag_chunks_embedding ON rag_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS rag_chunks_search ON rag_chunks USING GIN (search);
CREATE TABLE IF NOT EXISTS rag_index_state (
  item_id TEXT PRIMARY KEY REFERENCES archive_items(id) ON DELETE CASCADE,
  hash TEXT NOT NULL,
  model TEXT NOT NULL,
  chunks INTEGER NOT NULL,
  file_chars INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  indexed_at TEXT NOT NULL
);
`;

let schemaReady: Promise<string | null> | null = null;

/** Creates the tables once. Resolves to null, or the reason RAG cannot run on this database. */
export function ensureRagSchema(db: Db) {
  schemaReady ??= db
    .get(`SELECT to_regclass('public.rag_index_state') IS NOT NULL AS ready`)
    // Tables already there (every start after the first): skip the DDL, which costs several round trips.
    .then((r) =>
      r?.ready
        ? undefined
        : db.tx(async (t) => {
            await t.run('SELECT pg_advisory_xact_lock(4242)');
            await t.exec(SCHEMA);
          })
    )
    .then(() => null)
    .catch((err) => {
      schemaReady = null;
      return /vector/i.test(err.message) ? 'This database has no pgvector extension (Neon, Supabase and Render Postgres include it).' : err.message;
    });
  return schemaReady;
}

// ---- record text -----------------------------------------------------------------

const stationName = (id: string | null) => (id ? (listStations().find((s) => s.id === id)?.name ?? id) : '');

/** Catalogue header carried by every chunk, so a chunk is meaningful on its own. */
export function recordHeader(item: ArchiveItem) {
  const c = item.meta?.contributor;
  return [
    `${TYPE_LABEL[item.type] ?? item.type}: ${item.title}`,
    [item.year, stationName(item.stationId), item.domain].filter(Boolean).join(' · '),
    c?.name ? `Contributed by ${c.name}${c.institution ? `, ${c.institution}` : ''}` : item.meta?.authors ? `Authors: ${item.meta.authors}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function recordText(item: ArchiveItem) {
  return [item.summary, item.body, item.tags.length ? `Keywords: ${item.tags.join(', ')}` : '', item.doi ? `DOI: ${item.doi}` : '']
    .filter(Boolean)
    .join('\n\n');
}

const TEXT_FILES = /\.(txt|csv|json|md)$/i;
const MAX_FILE_CHARS = 40_000;

/** Text of the record's uploaded file (local /uploads or Vercel Blob). Other links are not fetched. */
async function fileText(item: ArchiveItem): Promise<string> {
  const url = item.url || '';
  const isPdf = /\.pdf$/i.test(url);
  if (!isPdf && !TEXT_FILES.test(url)) return '';
  let bytes: Buffer;
  if (url.startsWith('/uploads/')) {
    const p = path.join(UPLOAD_DIR, path.basename(url));
    if (!fs.existsSync(p)) return '';
    bytes = fs.readFileSync(p);
  } else if (/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(url)) {
    const res = await fetch(url);
    if (!res.ok) return '';
    bytes = Buffer.from(await res.arrayBuffer());
  } else return '';
  if (bytes.length > 30 * 1024 * 1024) return '';
  if (isPdf) {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    return String(text).replace(/\s+\n/g, '\n').slice(0, MAX_FILE_CHARS);
  }
  return bytes.toString('utf8').slice(0, MAX_FILE_CHARS);
}

/** ~900-character chunks on paragraph/sentence boundaries, with a little overlap. */
export function chunkText(text: string, size = 900, overlap = 150): string[] {
  const clean = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(clean.length, start + size);
    if (end < clean.length) {
      const window = clean.slice(start, end);
      const cut = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('. '), window.lastIndexOf('\n'));
      if (cut > size * 0.5) end = start + cut + 1;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks.filter((c) => c.length > 20);
}

const hashOf = (item: ArchiveItem) =>
  crypto
    .createHash('sha1')
    .update(JSON.stringify([item.title, item.summary, item.body, item.tags, item.url, item.stationId, item.year, item.domain, item.doi, item.meta?.contributor]))
    .digest('hex');

// ---- sync ------------------------------------------------------------------------

export interface SyncResult {
  indexed: number;
  removed: number;
  pending: number;
  errors: { id: string; error: string }[];
}

let running: Promise<SyncResult> | null = null;
let lastFullCheck = 0;

/**
 * Brings the index up to date with the approved records. `budgetMs` bounds the work per call (the
 * rest stays pending for the next call), so it is safe to run before answering a question.
 */
export function syncIndex(db: Db, { budgetMs = 60_000, force = false } = {}): Promise<SyncResult> {
  if (running) return running;
  if (!force && Date.now() - lastFullCheck < 20_000) return Promise.resolve({ indexed: 0, removed: 0, pending: 0, errors: [] });
  running = (async () => {
    const cfg = ragConfig();
    const started = Date.now();
    const result: SyncResult = { indexed: 0, removed: 0, pending: 0, errors: [] };
    if (await ensureRagSchema(db)) return result;
    // One cheap query decides whether anything changed; only then are all records hashed.
    if (!force && !(await indexVersion(db)).stale) {
      lastFullCheck = Date.now();
      return result;
    }

    // Records that are no longer public leave the index.
    const removed = await db.run(
      `DELETE FROM rag_index_state s WHERE NOT EXISTS (SELECT 1 FROM archive_items a WHERE a.id = s.item_id AND a.review_status = 'APPROVED')`
    );
    await db.run(`DELETE FROM rag_chunks c WHERE NOT EXISTS (SELECT 1 FROM rag_index_state s WHERE s.item_id = c.item_id)`);
    result.removed = removed.changes;

    const state = new Map(
      (await db.all('SELECT item_id, hash, model FROM rag_index_state')).map((r) => [r.item_id, `${r.hash}|${r.model}`])
    );
    const items = (await db.all(`SELECT * FROM archive_items WHERE review_status = 'APPROVED' ORDER BY rowid`)).map(rowToItem);
    const todo = force ? items : items.filter((i) => state.get(i.id) !== `${hashOf(i)}|${cfg.embedModel}`);

    // Batches of records: one embedding call and one transaction each (the database may be far away).
    const BATCH = 12;
    for (let n = 0; n < todo.length; n += BATCH) {
      if (Date.now() - started > budgetMs) {
        result.pending = todo.length - n;
        break;
      }
      const batch = todo.slice(n, n + BATCH);
      try {
        const prepared = await Promise.all(
          batch.map(async (item) => {
            let file = '';
            let fileError: string | null = null;
            try {
              file = await fileText(item);
            } catch (err: any) {
              fileError = `File text not read: ${err.message}`;
            }
            const header = recordHeader(item);
            const parts = [
              ...chunkText(recordText(item)).map((c) => ({ source: 'record', content: `${header}\n\n${c}` })),
              ...chunkText(file).map((c) => ({ source: 'file', content: `${header}\n(from the attached file)\n\n${c}` })),
            ];
            if (!parts.length) parts.push({ source: 'record', content: header });
            return { item, parts, fileChars: file.length, fileError };
          })
        );
        const vectors = await embed(
          prepared.flatMap((p) => p.parts.map((x) => x.content)),
          'passage'
        );
        await db.tx(async (t) => {
          const ids = prepared.map((p) => p.item.id);
          await t.run(`DELETE FROM rag_chunks WHERE item_id IN (${ids.map(() => '?').join(',')})`, ...ids);
          const values: string[] = [];
          const params: unknown[] = [];
          let v = 0;
          for (const p of prepared)
            p.parts.forEach((x, i) => {
              values.push('(?, ?, ?, ?, ?::vector)');
              params.push(p.item.id, i, x.source, x.content, `[${vectors[v++].join(',')}]`);
            });
          await t.run(`INSERT INTO rag_chunks (item_id, seq, source, content, embedding) VALUES ${values.join(',')}`, ...params);
          await t.run(
            `INSERT INTO rag_index_state (item_id, hash, model, chunks, file_chars, error, indexed_at)
             VALUES ${prepared.map(() => `(?, ?, ?, ?, ?, ?, ${NOW})`).join(',')}
             ON CONFLICT (item_id) DO UPDATE SET hash = EXCLUDED.hash, model = EXCLUDED.model, chunks = EXCLUDED.chunks,
               file_chars = EXCLUDED.file_chars, error = EXCLUDED.error, indexed_at = EXCLUDED.indexed_at`,
            ...prepared.flatMap((p) => [p.item.id, hashOf(p.item), cfg.embedModel, p.parts.length, p.fileChars, p.fileError])
          );
        });
        result.indexed += batch.length;
      } catch (err: any) {
        result.errors.push(...batch.map((i) => ({ id: i.id, error: err.message })));
        if (result.indexed === 0) {
          result.pending = todo.length - n - batch.length;
          break; // the model or service is down; stop instead of failing every batch
        }
      }
    }
    if (!result.pending && !result.errors.length) {
      // Every record's hash is now current; edits that did not change the indexed text (data status,
      // downloads) no longer count as stale for the quick check.
      await db.run(`UPDATE rag_index_state s SET indexed_at = ${NOW} FROM archive_items a WHERE a.id = s.item_id AND a.updated_at > s.indexed_at`);
      lastFullCheck = Date.now();
    }
    if (result.indexed || result.removed) console.log(`[POLARIS] RAG index: ${result.indexed} records embedded, ${result.removed} removed`);
    return result;
  })().finally(() => {
    running = null;
  });
  return running;
}

/**
 * Index version in one query: approved records, indexed records, records edited since they were
 * indexed, and records embedded with another model. Stale when any of them disagree. The version
 * string changes whenever the public archive changes, so it also keys the answer cache.
 */
export async function indexVersion(db: Db): Promise<{ stale: boolean; version: string }> {
  const r = await db.get(
    `SELECT (SELECT COUNT(*) FROM archive_items WHERE review_status = 'APPROVED') AS approved,
            (SELECT MAX(updated_at) FROM archive_items WHERE review_status = 'APPROVED') AS latest,
            (SELECT COUNT(*) FROM rag_index_state) AS indexed,
            (SELECT COUNT(*) FROM rag_index_state s JOIN archive_items a ON a.id = s.item_id
               WHERE a.updated_at > s.indexed_at OR a.review_status <> 'APPROVED' OR s.model <> ?) AS changed`,
    ragConfig().embedModel
  );
  const approved = Number(r?.approved ?? 0);
  const indexed = Number(r?.indexed ?? 0);
  const changed = Number(r?.changed ?? 0);
  return { stale: approved !== indexed || changed > 0, version: `${approved}|${r?.latest ?? ''}|${indexed}|${changed}` };
}

/** Marks the index stale so the next sync re-checks every record (after approvals and edits). */
export function touchIndex() {
  lastFullCheck = 0;
}

export async function indexStatus(db: Db) {
  const problem = await ensureRagSchema(db);
  if (problem) return { ready: false, problem, records: 0, chunks: 0, fileChunks: 0, approved: 0, contributorRecords: 0, errors: [] as any[] };
  const [counts, approved, contributed, errors] = await Promise.all([
    db.get(`SELECT COUNT(DISTINCT item_id) AS records, COUNT(*) AS chunks, COUNT(*) FILTER (WHERE source = 'file') AS file_chunks FROM rag_chunks`),
    db.get(`SELECT COUNT(*) AS n FROM archive_items WHERE review_status = 'APPROVED'`),
    db.get(`SELECT COUNT(*) AS n FROM rag_index_state s JOIN archive_items a ON a.id = s.item_id WHERE a.owner_id IS NOT NULL`),
    db.all(`SELECT item_id, error FROM rag_index_state WHERE error IS NOT NULL LIMIT 10`),
  ]);
  return {
    ready: true,
    problem: null,
    records: Number(counts?.records ?? 0),
    chunks: Number(counts?.chunks ?? 0),
    fileChunks: Number(counts?.file_chunks ?? 0),
    approved: Number(approved?.n ?? 0),
    contributorRecords: Number(contributed?.n ?? 0),
    errors,
  };
}
