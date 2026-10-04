import express, { type Request, type Response } from 'express';
import type { Db } from '../pg.ts';
import { rowToItem, type ArchiveItem } from '../db.ts';
import { filterSql, parseQuery, tsQuery, type SearchFilters } from '../search.ts';
import { attachCitations, verifyClaims, splitSentences, type Source, type Verification } from '../claims.ts';
import { HttpError, rateLimit, str, wrap } from '../http.ts';
import { requireRole } from '../auth.ts';
import { ragConfig } from './config.ts';
import { embed, generate, llmName, localLlmDevice, localLlmState, warmLocalLlm, type ChatMessage } from './models.ts';
import { ensureRagSchema, indexStatus, recordHeader, syncIndex } from './indexer.ts';

/**
 * Ask POLARIS: questions answered from the records researchers have shared on the portal.
 * Retrieval is hybrid (pgvector cosine similarity + PostgreSQL full-text, fused with reciprocal
 * rank fusion); the language model answers only from the retrieved records and cites them as [S1];
 * every sentence of the answer is then checked against the cited records.
 */

export interface RagSource extends Source {
  excerpt: string;
  url: string | null;
  contributor: { id: number | null; name: string; institution: string } | null;
  score: number;
}

const MAX_SOURCES = 6;
const CHUNKS_PER_SOURCE = 2;

interface Hit {
  item_id: string;
  content: string;
  rrf: number;
  sim: number;
  keyword?: boolean;
}

const MIN_SIM = 0.6;
const KEYWORD_MIN_SIM = 0.55;

/** Top chunks by vector similarity and by keywords, fused with RRF (k = 60). */
async function retrieve(db: Db, question: string, f: SearchFilters): Promise<Hit[]> {
  const flt = filterSql(f);
  const [qv] = await embed([question], 'query');
  const vec = `[${qv.join(',')}]`;
  const dense = await db.all(
    `SELECT c.id, c.item_id, c.content, 1 - (c.embedding <=> ?::vector) AS sim
     FROM rag_chunks c JOIN archive_items a ON a.id = c.item_id
     WHERE true ${flt.sql} ORDER BY c.embedding <=> ?::vector LIMIT 30`,
    vec,
    ...flt.params,
    vec
  );
  const ts = tsQuery(question, 'OR');
  const sparse = ts
    ? await db.all(
        `SELECT c.id, c.item_id, c.content, ts_rank_cd(c.search, q) AS rank, 1 - (c.embedding <=> ?::vector) AS sim
         FROM rag_chunks c JOIN archive_items a ON a.id = c.item_id, to_tsquery('english', ?) q
         WHERE c.search @@ q ${flt.sql} ORDER BY rank DESC LIMIT 30`,
        vec,
        ts,
        ...flt.params
      )
    : [];
  const fused = new Map<string, Hit>();
  const keyword = new Set(sparse.map((r) => r.id));
  const add = (rows: any[]) =>
    rows.forEach((r, i) => {
      const h = fused.get(r.id) ?? { item_id: r.item_id, content: r.content, rrf: 0, sim: Number(r.sim) };
      h.rrf += 1 / (60 + i + 1);
      fused.set(r.id, { ...h, keyword: keyword.has(r.id) } as Hit);
    });
  add(dense);
  add(sparse);
  // bge-small similarity: unrelated questions score about 0.50, relevant records 0.62 and up.
  // Keep strong semantic matches near the best one, and keyword matches that are at least loosely related.
  const best = Math.max(0, ...[...fused.values()].map((h) => h.sim));
  const floor = Math.max(MIN_SIM, best - 0.12);
  return [...fused.values()]
    .filter((h) => h.sim >= floor || (h.keyword && h.sim >= Math.max(KEYWORD_MIN_SIM, best - 0.2)))
    .sort((a, b) => b.sim + (b.keyword ? 0.02 : 0) - (a.sim + (a.keyword ? 0.02 : 0)));
}

const stripHeader = (chunk: string, item: ArchiveItem) => chunk.replace(recordHeader(item), '').replace(/^\s*\(from the attached file\)\s*/, '').trim();

async function buildSources(db: Db, hits: Hit[]): Promise<RagSource[]> {
  const order: string[] = [];
  const chunks = new Map<string, Hit[]>();
  for (const h of hits) {
    if (!chunks.has(h.item_id)) {
      if (order.length >= MAX_SOURCES) continue;
      order.push(h.item_id);
      chunks.set(h.item_id, []);
    }
    const list = chunks.get(h.item_id)!;
    if (list.length < CHUNKS_PER_SOURCE) list.push(h);
  }
  if (!order.length) return [];
  const rows = await db.all(
    `SELECT a.*, u.id AS owner_uid, u.name AS owner_name, u.institution AS owner_institution
     FROM archive_items a LEFT JOIN users u ON u.id = a.owner_id WHERE a.id IN (${order.map(() => '?').join(',')})`,
    ...order
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  return order
    .filter((id) => byId.has(id))
    .map((id, i) => {
      const row = byId.get(id);
      const item = rowToItem(row);
      const hs = chunks.get(id)!;
      const excerpt = hs.map((h) => stripHeader(h.content, item)).join('\n…\n');
      const c = item.meta?.contributor;
      const contributor = row.owner_uid
        ? { id: Number(row.owner_uid), name: row.owner_name, institution: row.owner_institution || '' }
        : c?.name
          ? { id: null, name: c.name, institution: c.institution || '' }
          : null;
      return {
        ref: `S${i + 1}`,
        id: item.id,
        type: item.type,
        title: item.title,
        dataStatus: item.dataStatus,
        year: item.year,
        stationId: item.stationId,
        // What the model saw, so the claim check compares against the same evidence.
        text: `${recordHeader(item)}\n${excerpt}`,
        excerpt: excerpt.slice(0, 700),
        url: item.url,
        contributor,
        score: Number(Math.max(...hs.map((h) => h.rrf)).toFixed(4)),
      };
    });
}

const SYSTEM =
  "You answer questions about India's polar research (NCPOR, MoES) using only the sources the user gives you. " +
  'The sources are records that researchers shared on the POLARIS portal. You always cite them in square brackets, like [S1].';

// Rules come after the sources: small models follow the most recent instructions best.
const RULES = `Instructions:
- Answer in 2 to 5 plain sentences. No lists, no bold text, no headings.
- End every sentence with the source it comes from, for example [S2].
- Use only facts stated in the sources and copy numbers, dates and names exactly.
- If the sources do not answer the question, reply only: The POLARIS archive does not have this yet.
- If a source names the researcher who contributed it, credit them by name.

Format: <fact from a source> [S1]. <another fact> [S3].`;

function prompt(question: string, sources: RagSource[]): ChatMessage[] {
  const block = sources.map((s) => `[${s.ref}] ${s.text.replace(/\n+/g, '\n')}`).join('\n\n');
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `Sources:\n\n${block}\n\nQuestion: ${question}\n\n${RULES}` },
  ];
}

/** Plain text (models sometimes add markdown anyway), with a citation on every factual sentence. */
function tidy(answer: string, sources: RagSource[]) {
  const plain = answer
    .replace(/\*\*|__|`/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/^\s*(?:[-*•]|\d+\.)\s+/gm, '')
    .replace(/:\s*\n/g, ': ')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
  return attachCitations(plain, sources);
}

/** Without a language model: the sentences from the sources that best match the question, cited. */
function extractive(question: string, sources: RagSource[]): string {
  const terms = parseQuery(question).terms;
  const scored = sources.flatMap((s) =>
    splitSentences(s.excerpt)
      .filter((x) => x.length > 30 && x.length < 400)
      .map((x) => ({ s, x, score: terms.filter((t) => x.toLowerCase().includes(t)).length }))
  );
  const best = scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  if (!best.length) return `The closest records are listed below, but none of them states this directly. [${sources[0].ref}]`;
  return best.map((b) => `${b.x.replace(/[.\s]+$/, '')}. [${b.s.ref}]`).join(' ');
}

export interface AskResult {
  question: string;
  answer: string;
  mode: 'generative' | 'extractive' | 'no_sources';
  model: string | null;
  sources: RagSource[];
  verification: Verification | null;
  timings: { retrievalMs: number; generationMs: number };
  note: string | null;
}

/** Answers a question; `emit` receives streaming events (sources first, then answer tokens). */
export async function ask(
  db: Db,
  question: string,
  filters: SearchFilters,
  emit: (event: string, data: unknown) => void,
  signal?: AbortSignal
): Promise<AskResult> {
  const cfg = ragConfig();
  const problem = await ensureRagSchema(db);
  if (problem) throw new HttpError(503, problem);
  // Records approved since the last question are embedded first (bounded, so a question never waits long).
  await syncIndex(db, { budgetMs: 8_000 }).catch(() => undefined);

  const t0 = Date.now();
  const sources = await buildSources(db, await retrieve(db, question, filters));
  const retrievalMs = Date.now() - t0;
  emit('sources', sources);

  const base = { question, sources, timings: { retrievalMs, generationMs: 0 } };
  if (!sources.length) {
    const answer = 'No approved record on POLARIS matches this question yet. Try other words, or share your own work from the Share page.';
    emit('token', answer);
    return { ...base, answer, mode: 'no_sources', model: null, verification: null, note: null };
  }

  let answer = '';
  let mode: AskResult['mode'] = 'generative';
  let note: string | null = null;
  const t1 = Date.now();
  if (cfg.llm) {
    try {
      answer = await generate(prompt(question, sources), (t) => emit('token', t), signal);
    } catch (err: any) {
      note = `Language model unavailable (${err.message}); showing the matching sentences from the records instead.`;
      emit('reset', note);
    }
  }
  const refused = /does not have this/i.test(answer) && answer.length < 120;
  if (refused) {
    const text = 'The POLARIS archive does not have this yet. The closest records are listed alongside.';
    return { ...base, answer: text, mode: 'no_sources', model: llmName(cfg), verification: null, timings: { retrievalMs, generationMs: Date.now() - t1 }, note };
  }
  if (answer.trim()) answer = tidy(answer, sources);
  else {
    mode = 'extractive';
    answer = extractive(question, sources);
    emit('token', answer);
  }
  const generationMs = Date.now() - t1;
  return {
    ...base,
    answer: answer.trim(),
    mode,
    model: mode === 'generative' ? llmName(cfg) : null,
    verification: verifyClaims(answer, sources),
    timings: { retrievalMs, generationMs },
    note,
  };
}

function filtersFrom(b: any): SearchFilters {
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean).slice(0, 10) : undefined);
  return {
    domain: b?.domain ? String(b.domain) : undefined,
    station: b?.station ? String(b.station) : undefined,
    types: list(b?.types),
    yearFrom: Number.isInteger(b?.yearFrom) ? b.yearFrom : null,
    yearTo: Number.isInteger(b?.yearTo) ? b.yearTo : null,
  };
}

export function createRagRouter(db: Db) {
  const r = express.Router();

  r.get(
    '/rag/status',
    wrap(async (_req, res) => {
      const cfg = ragConfig();
      res.json({
        enabled: cfg.enabled,
        backend: cfg.backend,
        embedModel: cfg.embedModel,
        llm: cfg.llm ? llmName(cfg) : null,
        device: cfg.backend === 'local' ? (localLlmDevice ?? cfg.device) : 'Hugging Face Inference',
        llmState: cfg.backend === 'local' ? localLlmState() : 'remote',
        hostedReady: cfg.backend === 'hosted' ? Boolean(cfg.hfToken) : null,
        index: await indexStatus(db),
      });
    })
  );

  r.post(
    '/rag/ask',
    rateLimit(20, 60_000),
    wrap(async (req: Request, res: Response) => {
      if (!ragConfig().enabled) throw new HttpError(503, 'Ask POLARIS is turned off on this server (RAG=off)');
      const question = str(req.body?.question, 'question', { required: true, max: 500 });
      res.status(200).set({ 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', 'x-accel-buffering': 'no' });
      res.flushHeaders();
      const ctrl = new AbortController();
      res.on('close', () => !res.writableEnded && ctrl.abort());
      const emit = (event: string, data: unknown) => {
        if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };
      try {
        const result = await ask(db, question, filtersFrom(req.body?.filters), emit, ctrl.signal);
        emit('done', result);
      } catch (err: any) {
        emit('error', { error: err.message || 'Could not answer' });
      }
      res.end();
    })
  );

  r.post(
    '/admin/rag/reindex',
    requireRole('reviewer', 'admin'),
    wrap(async (req, res) => {
      const result = await syncIndex(db, { force: Boolean(req.body?.full), budgetMs: 50_000 });
      res.json({ ...result, index: await indexStatus(db) });
    })
  );

  return r;
}

/** Startup work for the local backend: build the index and load the model in the background. */
export function startRag(db: Db) {
  const cfg = ragConfig();
  if (!cfg.enabled || process.env.VERCEL) return;
  syncIndex(db, { force: false, budgetMs: 10 * 60_000 })
    .then(() => (cfg.backend === 'local' ? warmLocalLlm() : null))
    .catch((err) => console.warn('[POLARIS] RAG not ready:', err.message));
}
