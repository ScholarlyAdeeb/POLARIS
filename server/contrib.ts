import express from 'express';
import crypto from 'crypto';
import type { Db } from './pg.ts';
import { NOW } from './pg.ts';
import { ARCHIVE_TYPES, getItem, insertItem, listStations, rowToItem, type ArchiveItem, type ArchiveType } from './db.ts';
import { HttpError, intOrNull, publicBase, str, tag, wrap } from './http.ts';
import { requireRole, type SessionUser } from './auth.ts';
import { blobUploadToken, describeBlobUpload, rawBody, saveUpload } from './uploads.ts';
import { search } from './search.ts';
import { nearestStation, regionFor, validLatLon } from './geo.ts';
import { CHANNELS, generateContent, type Channel } from './outreach.ts';
import { toSource, verifyClaims } from './claims.ts';

/**
 * Contributor workflow:
 *   upload file(s) -> describe the work -> POLARIS suggests where it belongs (station, region,
 *   related records) -> submit for review -> reviewer approves -> it appears on the map, graph,
 *   search and station pages -> contributor drafts website / social posts from it -> reviewer
 *   approves -> published on the newsroom with a credit to the contributor.
 */

/** Suggested relation for a new record of type `from` pointing at an existing record of type `to`. */
export function suggestRelation(from: ArchiveType, to: ArchiveType): string {
  if ((from === 'photo' || from === 'video') && (to === 'expedition' || to === 'activity')) return 'documents';
  if (from === 'dataset' && to === 'expedition') return 'collected_during';
  if (from === 'publication' && to === 'dataset') return 'uses_data';
  if (from === 'report' && (to === 'expedition' || to === 'dataset')) return 'describes';
  if (from === 'report' || from === 'activity') return 'part_of';
  return 'related_to';
}
const RELATIONS = ['documents', 'collected_during', 'uses_data', 'describes', 'part_of', 'related_to'];

export const postRow = async (db: Db, id: unknown) => {
  const p = await db.get(
    `SELECT p.*, a.title AS item_title, a.data_status AS item_data_status, a.review_status AS item_review_status,
            u.name AS author_name, u.institution AS author_institution
     FROM outreach_posts p JOIN archive_items a ON a.id = p.item_id
     LEFT JOIN users u ON u.id = COALESCE(p.created_by, a.owner_id) WHERE p.id = ?`,
    id
  );
  return p ? { ...p, claim_check: JSON.parse(p.claim_check || '{}') } : null;
};

export const checkAgainst = async (itemId: string, content: string) => {
  const item = await getItem(itemId);
  return item ? verifyClaims(content, [toSource(item, 0)]) : null;
};

/** One draft for one channel, written from the record by the template generator and fact-checked against it. */
export async function createDraft(db: Db, item: ArchiveItem, channel: Channel, base: string, createdBy: number | null) {
  const t = generateContent(item, `${base}/?record=${encodeURIComponent(item.id)}`, [channel])[0];
  const content = [channel === 'website' ? '' : t.title, t.text].filter(Boolean).join('\n\n');
  const row = await db.get(
    `INSERT INTO outreach_posts (item_id, channel, content, status, data_status, review_status, provider, claim_check, created_by)
     VALUES (?, ?, ?, 'DRAFT', 'TEMPLATE', 'PENDING_REVIEW', 'template', ?, ?) RETURNING id`,
    item.id,
    channel,
    content,
    JSON.stringify((await checkAgainst(item.id, content)) ?? {}),
    createdBy
  );
  return postRow(db, row.id);
}

async function ownRecord(user: SessionUser, id: string): Promise<ArchiveItem> {
  const item = await getItem(id);
  if (!item || item.ownerId !== user.id) throw new HttpError(404, 'Record not found in your workspace');
  return item;
}

interface MappingInput {
  type: ArchiveType;
  title: string;
  summary: string;
  tags: string[];
  stationId: string | null;
  location: { lat: number; lon: number } | null;
  excludeId?: string;
}

/** Where the work belongs: station, region and related records, each with the reason. */
async function suggestMapping(db: Db, m: MappingInput) {
  const stations = listStations();
  let station: { id: string; name: string; reason: string } | null = null;
  if (m.stationId) {
    const s = stations.find((x) => x.id === m.stationId);
    if (s) station = { id: s.id, name: s.name, reason: 'Chosen by you' };
  }
  if (!station && m.location) {
    const near = nearestStation(m.location, stations);
    if (near) station = { id: near.station.id, name: near.station.name, reason: `Nearest station, ${near.km} km from your coordinates` };
  }
  if (!station) {
    const text = `${m.title} ${m.summary} ${m.tags.join(' ')}`.toLowerCase();
    const s = stations.find((x) => text.includes(x.name.toLowerCase().split(' ')[0].toLowerCase()));
    if (s) station = { id: s.id, name: s.name, reason: `"${s.name.split(' ')[0]}" appears in your description` };
  }
  const st = station ? stations.find((s) => s.id === station!.id) : null;
  const region = st?.domain || (m.location ? regionFor(m.location) : '') || '';
  const query = [m.title, m.summary, m.tags.join(' ')].join(' ').slice(0, 200);
  const found = query.trim() ? await search(db, query, {}, 8) : { results: [] as any[] };
  const related = found.results
    .filter((r: any) => r.id !== m.excludeId)
    .slice(0, 6)
    .map((r: any) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      year: r.year,
      relation: suggestRelation(m.type, r.type),
      reason: 'Shares key words with your description',
    }));
  return { station, region, related };
}

function readRecordBody(b: any, partial = false) {
  const type = (str(b.type, 'type', { required: !partial }) || undefined) as ArchiveType | undefined;
  if (type && !ARCHIVE_TYPES.includes(type)) throw new HttpError(400, `type must be one of: ${ARCHIVE_TYPES.join(', ')}`);
  if (b.tags !== undefined && !Array.isArray(b.tags)) throw new HttpError(400, 'tags must be an array of strings');
  const location = b.location === undefined ? undefined : b.location === null ? null : validLatLon(b.location?.lat, b.location?.lon);
  if (b.location && !location) throw new HttpError(400, 'location needs lat between -90 and 90 and lon between -180 and 180');
  const url = str(b.url, 'url', { max: 2000 });
  if (url && !/^(\/uploads\/|https?:\/\/)/.test(url)) throw new HttpError(400, 'url must be an uploaded file or an http(s) link');
  const thumbnailUrl = str(b.thumbnailUrl, 'thumbnailUrl', { max: 2000 });
  if (thumbnailUrl && !/^(\/uploads\/|https?:\/\/)/.test(thumbnailUrl)) throw new HttpError(400, 'thumbnailUrl must be an uploaded file or an http(s) link');
  const stationId = str(b.stationId, 'stationId', { max: 60 }) || null;
  if (stationId && !listStations().some((s) => s.id === stationId)) throw new HttpError(400, `Unknown station ${stationId}`);
  return {
    type,
    title: b.title === undefined && partial ? undefined : str(b.title, 'title', { required: true, max: 300 }),
    summary: str(b.summary, 'summary', { max: 5000 }),
    body: str(b.body, 'body', { max: 50000 }),
    stationId,
    year: intOrNull(b.year, 'year'),
    date: str(b.date, 'date', { max: 40 }) || null,
    tags: ((b.tags ?? []) as unknown[]).map(tag).filter(Boolean),
    url: url || null,
    thumbnailUrl: thumbnailUrl || null,
    doi: str(b.doi, 'doi', { max: 200 }) || null,
    location,
    links: Array.isArray(b.links) ? (b.links as any[]).slice(0, 20) : [],
  };
}

async function writeLinks(t: Db, id: string, type: ArchiveType, links: any[]) {
  for (const l of links) {
    const to = str(l?.id, 'links[].id', { required: true, max: 120 });
    const target = await getItem(to, t);
    if (!target || target.reviewStatus !== 'APPROVED') throw new HttpError(400, `Linked record ${to} does not exist`);
    const relation = str(l?.relation, 'links[].relation', { max: 40 }) || suggestRelation(type, target.type);
    if (!RELATIONS.includes(relation)) throw new HttpError(400, `relation must be one of: ${RELATIONS.join(', ')}`);
    await t.run('INSERT INTO item_links (from_id, to_id, relation) VALUES (?, ?, ?) ON CONFLICT DO NOTHING', id, to, relation);
  }
}

export function createContributorRouter(db: Db) {
  const r = express.Router();
  r.use(requireRole());
  r.use((req, _res, next) => (req.user!.id > 0 ? next() : next(new HttpError(403, 'The admin token cannot own work. Create a contributor account to upload.'))));

  r.post('/uploads', rawBody, wrap(async (req, res) => res.status(201).json(await saveUpload(req))));
  // Direct browser → Vercel Blob uploads: token exchange, then register the finished file.
  r.post('/uploads/blob', wrap(async (req, res) => res.json(await blobUploadToken(req))));
  r.post('/uploads/complete', wrap((req, res) => res.status(201).json(describeBlobUpload(req.body))));

  r.post(
    '/suggest',
    wrap(async (req, res) => {
      const b = req.body ?? {};
      const type = (ARCHIVE_TYPES.includes(b.type) ? b.type : 'photo') as ArchiveType;
      res.json(
        await suggestMapping(db, {
          type,
          title: str(b.title, 'title', { max: 300 }),
          summary: str(b.summary, 'summary', { max: 5000 }),
          tags: Array.isArray(b.tags) ? b.tags.map(String).slice(0, 20) : [],
          stationId: str(b.stationId, 'stationId', { max: 60 }) || null,
          location: validLatLon(b.location?.lat, b.location?.lon),
          excludeId: str(b.excludeId, 'excludeId', { max: 120 }) || undefined,
        })
      );
    })
  );

  r.get(
    '/records',
    wrap(async (req, res) => {
      const rows = await db.all('SELECT * FROM archive_items WHERE owner_id = ? ORDER BY rowid DESC', req.user!.id);
      res.json(rows.map(rowToItem));
    })
  );

  r.get(
    '/records/:id',
    wrap(async (req, res) => {
      const item = await ownRecord(req.user!, req.params.id);
      const links = await db.all(
        `SELECT a.id, a.type, a.title, l.relation, 'out' AS direction FROM item_links l JOIN archive_items a ON a.id = l.to_id WHERE l.from_id = ?1
         UNION ALL SELECT a.id, a.type, a.title, l.relation, 'in' AS direction FROM item_links l JOIN archive_items a ON a.id = l.from_id WHERE l.to_id = ?1`,
        item.id
      );
      res.json({ ...item, links });
    })
  );

  r.post(
    '/records',
    wrap(async (req, res) => {
      const u = req.user!;
      const b = readRecordBody(req.body ?? {});
      const st = listStations().find((s) => s.id === b.stationId);
      const domain = st?.domain || (b.location ? regionFor(b.location) : '') || str(req.body?.domain, 'domain', { max: 80 });
      const id = `USR-${b.type!.toUpperCase().slice(0, 4)}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      const isImage = b.url && /\.(jpe?g|png|webp|gif)$/i.test(b.url);
      await db.tx(async (t) => {
        await insertItem(t, {
          id,
          type: b.type!,
          title: b.title!,
          summary: b.summary,
          body: b.body,
          domain,
          stationId: b.stationId,
          year: b.year ?? (b.date ? Number(b.date.slice(0, 4)) || null : null),
          date: b.date,
          tags: b.tags,
          url: b.url,
          thumbnailUrl: b.thumbnailUrl || (isImage ? b.url : null),
          doi: b.doi,
          meta: { ...(b.location ? { location: b.location } : {}), contributor: { name: u.name, institution: u.institution } },
          dataStatus: 'UNVERIFIED',
          provenance: {
            source: 'Contributor upload',
            submittedBy: u.name,
            institution: u.institution || null,
            submittedAt: new Date().toISOString(),
            note: 'Submitted through the POLARIS contributor workspace; not yet verified.',
          },
          ownerId: u.id,
          reviewStatus: 'PENDING_REVIEW',
        });
        await writeLinks(t, id, b.type!, b.links);
      });
      res.status(201).json(await getItem(id));
    })
  );

  r.patch(
    '/records/:id',
    wrap(async (req, res) => {
      const item = await ownRecord(req.user!, req.params.id);
      const body = req.body ?? {};
      // An explicit `location: null` clears the coordinates; leaving the field out keeps them.
      const location = 'location' in body ? body.location : item.meta.location ?? null;
      const b = readRecordBody({ ...item, ...body, location, links: body.links }, true);
      const meta = { ...item.meta, location: b.location ?? undefined };
      const st = listStations().find((s) => s.id === b.stationId);
      const domain = st?.domain || (b.location ? regionFor(b.location) : '') || item.domain;
      await db.tx(async (t) => {
        await t.run(
          `UPDATE archive_items SET title = ?, summary = ?, body = ?, domain = ?, station_id = ?, year = ?, date = ?, tags = ?, url = ?, thumbnail_url = ?, doi = ?,
             meta = ?, review_status = 'PENDING_REVIEW', updated_at = ${NOW} WHERE id = ?`,
          b.title ?? item.title, b.summary, b.body, domain, b.stationId, b.year, b.date, b.tags.join(', '), b.url, b.thumbnailUrl, b.doi, JSON.stringify(meta), item.id
        );
        if (b.links.length) await writeLinks(t, item.id, item.type, b.links);
      });
      res.json(await getItem(item.id));
    })
  );

  r.delete(
    '/records/:id',
    wrap(async (req, res) => {
      const item = await ownRecord(req.user!, req.params.id);
      if (item.reviewStatus === 'APPROVED') throw new HttpError(409, 'Approved records are part of the archive; ask a reviewer to remove it');
      await db.run('DELETE FROM archive_items WHERE id = ?', item.id);
      res.status(204).end();
    })
  );

  // Content from your own record: one draft per channel, each fact-checked and queued for review.
  r.post(
    '/records/:id/content',
    wrap(async (req, res) => {
      const item = await ownRecord(req.user!, req.params.id);
      const channels: Channel[] = Array.isArray(req.body?.channels) && req.body.channels.length ? req.body.channels : CHANNELS;
      for (const c of channels) if (!CHANNELS.includes(c)) throw new HttpError(400, `Unknown channel: ${c}`);
      const out = [];
      for (const c of channels) out.push(await createDraft(db, item, c, publicBase(req), req.user!.id));
      res.status(201).json(out);
    })
  );

  r.get(
    '/content',
    wrap(async (req, res) => {
      const rows = await db.all(
        `SELECT p.id FROM outreach_posts p JOIN archive_items a ON a.id = p.item_id
         WHERE p.created_by = ?1 OR a.owner_id = ?1 ORDER BY p.id DESC`,
        req.user!.id
      );
      res.json(await Promise.all(rows.map((r) => postRow(db, r.id))));
    })
  );

  r.patch(
    '/content/:id',
    wrap(async (req, res) => {
      const post = await postRow(db, intOrNull(req.params.id, 'id'));
      const item = post ? await getItem(post.item_id) : null;
      if (!post || !(post.created_by === req.user!.id || item?.ownerId === req.user!.id)) throw new HttpError(404, 'Post not found in your workspace');
      if (post.status === 'PUBLISHED') throw new HttpError(409, 'Published posts cannot be edited');
      const content = str(req.body?.content, 'content', { required: true, max: 20000 });
      await db.run(
        `UPDATE outreach_posts SET content = ?, claim_check = ?, review_status = 'PENDING_REVIEW', status = 'DRAFT', updated_at = ${NOW} WHERE id = ?`,
        content,
        JSON.stringify((await checkAgainst(post.item_id, content)) ?? {}),
        post.id
      );
      res.json(await postRow(db, post.id));
    })
  );

  return r;
}

/** Public: the newsroom (published posts) and contributor profiles. Only name and institution are exposed. */
export function createPublicContentRouter(db: Db) {
  const r = express.Router();

  r.get(
    '/content/published',
    wrap(async (req, res) => {
      const where = [`p.status = 'PUBLISHED'`, `a.review_status = 'APPROVED'`];
      const params: any[] = [];
      if (req.query.channel) {
        const c = String(req.query.channel) as Channel;
        if (!CHANNELS.includes(c)) throw new HttpError(400, `Unknown channel: ${c}`);
        where.push('p.channel = ?');
        params.push(c);
      }
      const user = intOrNull(req.query.user, 'user');
      if (user !== null) {
        where.push('COALESCE(p.created_by, a.owner_id) = ?');
        params.push(user);
      }
      res.json(
        await db.all(
          `SELECT p.id, p.item_id, p.channel, p.content, p.data_status, p.reviewer, p.published_at, p.updated_at,
                  a.title AS item_title, a.type AS item_type, a.thumbnail_url AS item_thumbnail, a.station_id AS item_station,
                  u.id AS author_id, u.name AS author_name, u.institution AS author_institution
           FROM outreach_posts p JOIN archive_items a ON a.id = p.item_id
           LEFT JOIN users u ON u.id = COALESCE(p.created_by, a.owner_id)
           WHERE ${where.join(' AND ')} ORDER BY COALESCE(p.published_at, p.updated_at) DESC LIMIT 100`,
          ...params
        )
      );
    })
  );

  r.get(
    '/contributors/:id',
    wrap(async (req, res) => {
      const u = await db.get('SELECT id, name, institution, role, created_at FROM users WHERE id = ?', intOrNull(req.params.id, 'id'));
      if (!u) throw new HttpError(404, 'Contributor not found');
      const records = (await db.all(`SELECT * FROM archive_items WHERE owner_id = ? AND review_status = 'APPROVED' ORDER BY rowid DESC`, u.id)).map(rowToItem);
      const { posts } = (await db.get(
        `SELECT COUNT(*) AS posts FROM outreach_posts p JOIN archive_items a ON a.id = p.item_id
         WHERE p.status = 'PUBLISHED' AND COALESCE(p.created_by, a.owner_id) = ?`,
        u.id
      ))!;
      res.json({ ...u, records, publishedPosts: posts });
    })
  );

  return r;
}
