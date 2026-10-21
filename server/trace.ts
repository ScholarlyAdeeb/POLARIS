import express from 'express';
import type { Db } from './pg.ts';
import { getItem, listStations, type ArchiveItem } from './db.ts';
import { HttpError, wrap } from './http.ts';
import { isReviewer } from './auth.ts';

/**
 * "Why is this connected?" and "Trace this finding".
 *
 * Every link gets plain-language reasons built from the database: what the relation means, the
 * station and years both records share, common tags, and who made and checked the link.
 * A trace walks a record back towards its evidence (publication -> dataset -> expedition ->
 * station and its instruments), one explained step at a time.
 */

const RELATION_TEXT: Record<string, (a: string, b: string) => string> = {
  documents: (a, b) => `${a} documents ${b}.`,
  collected_during: (a, b) => `${a} was collected during ${b}.`,
  uses_data: (a, b) => `${a} uses data from ${b}.`,
  describes: (a, b) => `${a} describes ${b}.`,
  part_of: (a, b) => `${a} is part of ${b}.`,
  related_to: (a, b) => `${a} is related to ${b}.`,
  located_at: (a, b) => `${a} was recorded at ${b}.`,
};

/** Relations that point from a result towards the evidence behind it. */
const UPSTREAM = new Set(['uses_data', 'collected_during', 'describes', 'documents', 'part_of']);

const TYPE_NAME: Record<string, string> = {
  expedition: 'the expedition',
  report: 'the report',
  dataset: 'the dataset',
  publication: 'the publication',
  photo: 'the photograph',
  video: 'the video',
  activity: 'the activity',
};

const stationName = (id: string | null) => (id ? listStations().find((s) => s.id === id)?.name ?? id : null);

export function explainLink(from: ArchiveItem, to: ArchiveItem, relation: string): string[] {
  const a = `${TYPE_NAME[from.type] ?? 'This record'} "${from.title}"`;
  const b = `${TYPE_NAME[to.type] ?? 'the record'} "${to.title}"`;
  const reasons = [(RELATION_TEXT[relation] ?? RELATION_TEXT.related_to)(a[0].toUpperCase() + a.slice(1), b)];
  if (from.stationId && from.stationId === to.stationId) reasons.push(`Both are recorded at ${stationName(from.stationId)}.`);
  else if (from.domain && from.domain === to.domain) reasons.push(`Both belong to the same region (${from.domain.toLowerCase()}).`);
  if (from.year && to.year) {
    const gap = from.year - to.year;
    reasons.push(gap === 0 ? `Both are from ${from.year}.` : gap > 0 ? `${from.year} and ${to.year}: it came ${gap} year${gap > 1 ? 's' : ''} later.` : `Dated ${from.year}; the linked record is dated ${to.year}.`);
  }
  const shared = from.tags.filter((t) => to.tags.some((u) => u.toLowerCase() === t.toLowerCase()));
  if (shared.length) reasons.push(`Shared keywords: ${shared.slice(0, 5).join(', ')}.`);
  const p = from.provenance ?? {};
  if (p.submittedBy) reasons.push(`Linked by ${p.submittedBy} when submitting${p.reviewedBy ? `; checked by reviewer ${p.reviewedBy}` : ''}.`);
  else if (p.source) reasons.push(/seed/i.test(p.source) ? 'A curated link in the demo catalogue.' : `From the catalogue source: ${p.source}.`);
  return reasons;
}

export interface TraceStep {
  depth: number;
  from: { id: string; type: string; title: string; year: number | null };
  to: { id: string; type: string; title: string; year: number | null };
  relation: string;
  reasons: string[];
}

const brief = (i: ArchiveItem) => ({ id: i.id, type: i.type, title: i.title, year: i.year });

export async function traceRecord(db: Db, root: ArchiveItem, publicOnly = true, maxDepth = 5) {
  const steps: TraceStep[] = [];
  const seen = new Set([root.id]);
  const stations = new Set<string>();
  let frontier = [root];
  for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
    const next: ArchiveItem[] = [];
    for (const item of frontier) {
      if (item.stationId) stations.add(item.stationId);
      const links = await db.all<{ to_id: string; relation: string }>('SELECT to_id, relation FROM item_links WHERE from_id = ?', item.id);
      for (const l of links) {
        if (!UPSTREAM.has(l.relation) || seen.has(l.to_id)) continue;
        const to = await getItem(l.to_id, db);
        if (!to || (publicOnly && to.reviewStatus !== 'APPROVED')) continue;
        seen.add(to.id);
        steps.push({ depth, from: brief(item), to: brief(to), relation: l.relation, reasons: explainLink(item, to, l.relation) });
        next.push(to);
      }
    }
    frontier = next;
  }
  for (const i of frontier) if (i.stationId) stations.add(i.stationId);
  const instruments = async (id: string) =>
    (await db.all<{ data: string }>('SELECT data FROM hotspots WHERE station_id = ? ORDER BY id', id)).map((r) => {
      const h = JSON.parse(r.data);
      return { id: h.id, title: h.title, dataset: h.datasetTitle ?? null };
    });
  const origin = await Promise.all(
    [...stations].map(async (id) => {
      const s = listStations().find((x) => x.id === id);
      return { id, name: s?.name ?? id, region: s?.domain ?? '', coordinates: s?.coordinates ?? '', instruments: await instruments(id) };
    })
  );
  return { root: brief(root), steps, stations: origin };
}

export function createTraceRouter(db: Db) {
  const r = express.Router();

  r.get(
    '/archive/:id/trace',
    wrap(async (req, res) => {
      const item = await getItem(req.params.id);
      const reviewer = isReviewer(req.user);
      if (!item || (item.reviewStatus !== 'APPROVED' && !reviewer && item.ownerId !== req.user?.id)) throw new HttpError(404, 'Record not found');
      res.json(await traceRecord(db, item, !reviewer));
    })
  );

  r.get(
    '/links/explain',
    wrap(async (req, res) => {
      const from = await getItem(String(req.query.from ?? ''));
      const to = await getItem(String(req.query.to ?? ''));
      if (!from || !to || from.reviewStatus !== 'APPROVED' || to.reviewStatus !== 'APPROVED') throw new HttpError(404, 'Link not found');
      const link = await db.get<{ relation: string }>(
        'SELECT relation FROM item_links WHERE (from_id = ?1 AND to_id = ?2) OR (from_id = ?2 AND to_id = ?1) LIMIT 1',
        from.id,
        to.id
      );
      if (!link) throw new HttpError(404, 'These records are not linked');
      const forward = !!(await db.get('SELECT 1 FROM item_links WHERE from_id = ? AND to_id = ?', from.id, to.id));
      res.json({ relation: link.relation, reasons: forward ? explainLink(from, to, link.relation) : explainLink(to, from, link.relation) });
    })
  );

  return r;
}
