import type { StationData } from '../src/types/polaris.ts';
import { connect, NOW, type Db } from './pg.ts';
import { seedDatabase } from './seed.ts';
import { loadOpenData } from './openData.ts';
import { deriveDataStatus, deriveProvenance, type DataStatus } from './migrations.ts';

export type ArchiveType = 'expedition' | 'report' | 'dataset' | 'publication' | 'photo' | 'video' | 'activity';

export const ARCHIVE_TYPES: ArchiveType[] = ['expedition', 'report', 'dataset', 'publication', 'photo', 'video', 'activity'];

export interface ArchiveItem {
  id: string;
  type: ArchiveType;
  title: string;
  summary: string;
  body: string;
  domain: string;
  stationId: string | null;
  year: number | null;
  date: string | null;
  tags: string[];
  url: string | null;
  thumbnailUrl: string | null;
  doi: string | null;
  meta: Record<string, any>;
  downloads: number;
  dataStatus: DataStatus;
  provenance: Record<string, any>;
  reviewStatus: string;
  reviewNote: string | null;
  ownerId: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * PostgreSQL schema. JSON payloads (meta, provenance, station data) are stored as text and parsed in
 * rowToItem; queries that filter on them cast to jsonb. `search` is a weighted full-text vector
 * (title > tags > summary > body/domain) kept up to date by Postgres itself.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS stations (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  sort INTEGER NOT NULL,
  data TEXT NOT NULL,
  data_status TEXT NOT NULL DEFAULT 'UNVERIFIED',
  readings_status TEXT NOT NULL DEFAULT 'SYNTHETIC'
);

CREATE TABLE IF NOT EXISTS hotspots (
  id INTEGER PRIMARY KEY,
  station_id TEXT NOT NULL,
  data TEXT NOT NULL,
  data_status TEXT NOT NULL DEFAULT 'SAMPLE'
);

CREATE TABLE IF NOT EXISTS simulations (
  id TEXT PRIMARY KEY,
  sort INTEGER NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS value_graph_steps (
  step TEXT PRIMARY KEY,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  username TEXT,
  name TEXT NOT NULL,
  institution TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'contributor',
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT ${NOW}
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (lower(username));

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS archive_items (
  rowid BIGSERIAL PRIMARY KEY,
  id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  domain TEXT NOT NULL DEFAULT '',
  station_id TEXT,
  year INTEGER,
  date TEXT,
  tags TEXT NOT NULL DEFAULT '',
  url TEXT,
  thumbnail_url TEXT,
  doi TEXT,
  meta TEXT NOT NULL DEFAULT '{}',
  downloads INTEGER NOT NULL DEFAULT 0,
  data_status TEXT NOT NULL DEFAULT 'UNVERIFIED',
  provenance TEXT NOT NULL DEFAULT '{}',
  review_status TEXT NOT NULL DEFAULT 'APPROVED',
  review_note TEXT,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT ${NOW},
  updated_at TEXT NOT NULL DEFAULT ${NOW},
  search tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(tags, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(body, '') || ' ' || coalesce(domain, '')), 'D')
  ) STORED
);
CREATE INDEX IF NOT EXISTS idx_archive_type ON archive_items(type);
CREATE INDEX IF NOT EXISTS idx_archive_station ON archive_items(station_id);
CREATE INDEX IF NOT EXISTS idx_archive_year ON archive_items(year);
CREATE INDEX IF NOT EXISTS idx_archive_status ON archive_items(data_status);
CREATE INDEX IF NOT EXISTS idx_archive_review ON archive_items(review_status);
CREATE INDEX IF NOT EXISTS idx_archive_owner ON archive_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_archive_search ON archive_items USING GIN (search);

-- Directed links between records ("value graph": photo -> expedition -> dataset -> paper -> lesson)
CREATE TABLE IF NOT EXISTS item_links (
  from_id TEXT NOT NULL REFERENCES archive_items(id) ON DELETE CASCADE,
  to_id TEXT NOT NULL REFERENCES archive_items(id) ON DELETE CASCADE,
  relation TEXT NOT NULL,
  PRIMARY KEY (from_id, to_id, relation)
);

CREATE TABLE IF NOT EXISTS proposals (
  id SERIAL PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  pi_name TEXT NOT NULL,
  affiliation TEXT NOT NULL,
  email TEXT NOT NULL,
  platform TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL,
  berths INTEGER,
  status TEXT NOT NULL DEFAULT 'SUBMITTED',
  created_at TEXT NOT NULL DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS outreach_posts (
  id SERIAL PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES archive_items(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'EN',
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  data_status TEXT NOT NULL DEFAULT 'TEMPLATE',
  review_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  provider TEXT NOT NULL DEFAULT 'template',
  claim_check TEXT NOT NULL DEFAULT '{}',
  reviewer TEXT,
  review_note TEXT,
  reviewed_at TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT ${NOW},
  updated_at TEXT NOT NULL DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS usage_counts (
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind, key)
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT ${NOW}
);
`;

let db: Db | null = null;
let stationCache: StationData[] = [];

/** Connects, creates the schema, seeds an empty database and loads open data. Call once at start-up. */
export async function initDb(): Promise<Db> {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set. Add your PostgreSQL connection string to .env.');
  const conn = connect(url);
  // Serialise schema creation across processes starting at the same time.
  await conn.tx(async (t) => {
    await t.exec('SELECT pg_advisory_xact_lock(76010)');
    await t.exec(SCHEMA);
    await t.run(`INSERT INTO schema_migrations (version, name) VALUES (1, 'postgres baseline') ON CONFLICT (version) DO NOTHING`);
    const { n } = (await t.get<{ n: number }>('SELECT COUNT(*) AS n FROM stations'))!;
    if (n === 0) await seedDatabase(t);
  });
  db = conn;
  await refreshStations();
  if (process.env.OPEN_DATA !== 'off') await loadOpenData(conn);
  return conn;
}

export function getDb(): Db {
  if (!db) throw new Error('Database not initialised; call initDb() first');
  return db;
}

async function refreshStations() {
  stationCache = (await getDb().all('SELECT data FROM stations ORDER BY sort')).map((r) => JSON.parse(r.data));
}

/** Stations never change after seeding, so they are read once and served from memory. */
export function listStations(): StationData[] {
  return stationCache;
}

export function rowToItem(row: any): ArchiveItem {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    summary: row.summary,
    body: row.body,
    domain: row.domain,
    stationId: row.station_id,
    year: row.year,
    date: row.date,
    tags: row.tags ? String(row.tags).split(',').map((t: string) => t.trim()).filter(Boolean) : [],
    url: row.url,
    thumbnailUrl: row.thumbnail_url,
    doi: row.doi,
    meta: JSON.parse(row.meta || '{}'),
    downloads: row.downloads,
    dataStatus: row.data_status ?? 'UNVERIFIED',
    provenance: JSON.parse(row.provenance || '{}'),
    reviewStatus: row.review_status ?? 'APPROVED',
    reviewNote: row.review_note ?? null,
    ownerId: row.owner_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ArchiveInput {
  id: string;
  type: ArchiveType;
  title: string;
  summary?: string;
  body?: string;
  domain?: string;
  stationId?: string | null;
  year?: number | null;
  date?: string | null;
  tags?: string[];
  url?: string | null;
  thumbnailUrl?: string | null;
  doi?: string | null;
  meta?: Record<string, any>;
  dataStatus?: DataStatus;
  provenance?: Record<string, any>;
  ownerId?: number | null;
  reviewStatus?: string;
}

const ITEM_COLUMNS =
  'id, type, title, summary, body, domain, station_id, year, date, tags, url, thumbnail_url, doi, meta, data_status, provenance, owner_id, review_status';

function itemValues(item: ArchiveInput): unknown[] {
  return [
    item.id,
    item.type,
    item.title,
    item.summary ?? '',
    item.body ?? '',
    item.domain ?? '',
    item.stationId ?? null,
    item.year ?? null,
    item.date ?? null,
    (item.tags ?? []).join(', '),
    item.url ?? null,
    item.thumbnailUrl ?? null,
    item.doi || null,
    JSON.stringify(item.meta ?? {}),
    item.dataStatus ?? deriveDataStatus(item.type, item.meta ?? {}),
    JSON.stringify(item.provenance ?? deriveProvenance(item.type, item.meta ?? {})),
    item.ownerId ?? null,
    item.reviewStatus ?? 'APPROVED',
  ];
}

export async function insertItem(d: Db, item: ArchiveInput): Promise<void> {
  await d.run(`INSERT INTO archive_items (${ITEM_COLUMNS}) VALUES (${Array(18).fill('?').join(', ')})`, ...itemValues(item));
}

/** Many records in one statement (seed, open data). Existing ids are left untouched. Returns how many were added. */
export async function insertItems(d: Db, items: ArchiveInput[], chunk = 50): Promise<number> {
  let added = 0;
  for (let i = 0; i < items.length; i += chunk) {
    const part = items.slice(i, i + chunk);
    const rows = part.map(() => `(${Array(18).fill('?').join(', ')})`).join(', ');
    const r = await d.run(`INSERT INTO archive_items (${ITEM_COLUMNS}) VALUES ${rows} ON CONFLICT (id) DO NOTHING`, ...part.flatMap(itemValues));
    added += r.changes;
  }
  return added;
}

export async function getItem(id: string, d: Db = getDb()): Promise<ArchiveItem | null> {
  const row = await d.get('SELECT * FROM archive_items WHERE id = ?', id);
  return row ? rowToItem(row) : null;
}
