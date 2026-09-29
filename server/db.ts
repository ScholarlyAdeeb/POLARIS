import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { seedDatabase } from './seed.ts';
import { loadOpenData } from './openData.ts';
import { runMigrations, deriveDataStatus, deriveProvenance, type DataStatus } from './migrations.ts';

export type ArchiveType =
  | 'expedition'
  | 'report'
  | 'dataset'
  | 'publication'
  | 'photo'
  | 'video'
  | 'activity';

export const ARCHIVE_TYPES: ArchiveType[] = [
  'expedition',
  'report',
  'dataset',
  'publication',
  'photo',
  'video',
  'activity',
];

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

const SCHEMA = `
CREATE TABLE IF NOT EXISTS stations (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  sort INTEGER NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hotspots (
  id INTEGER PRIMARY KEY,
  station_id TEXT NOT NULL,
  data TEXT NOT NULL
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

CREATE TABLE IF NOT EXISTS archive_items (
  rowid INTEGER PRIMARY KEY AUTOINCREMENT,
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
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_archive_type ON archive_items(type);
CREATE INDEX IF NOT EXISTS idx_archive_station ON archive_items(station_id);
CREATE INDEX IF NOT EXISTS idx_archive_year ON archive_items(year);

CREATE VIRTUAL TABLE IF NOT EXISTS archive_fts USING fts5(
  title, summary, body, tags, domain,
  content='archive_items', content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER IF NOT EXISTS archive_ai AFTER INSERT ON archive_items BEGIN
  INSERT INTO archive_fts(rowid, title, summary, body, tags, domain)
  VALUES (new.rowid, new.title, new.summary, new.body, new.tags, new.domain);
END;
CREATE TRIGGER IF NOT EXISTS archive_ad AFTER DELETE ON archive_items BEGIN
  INSERT INTO archive_fts(archive_fts, rowid, title, summary, body, tags, domain)
  VALUES ('delete', old.rowid, old.title, old.summary, old.body, old.tags, old.domain);
END;
CREATE TRIGGER IF NOT EXISTS archive_au AFTER UPDATE ON archive_items BEGIN
  INSERT INTO archive_fts(archive_fts, rowid, title, summary, body, tags, domain)
  VALUES ('delete', old.rowid, old.title, old.summary, old.body, old.tags, old.domain);
  INSERT INTO archive_fts(rowid, title, summary, body, tags, domain)
  VALUES (new.rowid, new.title, new.summary, new.body, new.tags, new.domain);
END;

-- Directed links between records ("value graph": photo -> expedition -> dataset -> paper -> lesson)
CREATE TABLE IF NOT EXISTS item_links (
  from_id TEXT NOT NULL REFERENCES archive_items(id) ON DELETE CASCADE,
  to_id TEXT NOT NULL REFERENCES archive_items(id) ON DELETE CASCADE,
  relation TEXT NOT NULL,
  PRIMARY KEY (from_id, to_id, relation)
);

CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS outreach_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL REFERENCES archive_items(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'EN',
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`;

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;
  const dbPath = process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'polaris.db');
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  runMigrations(db);
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM stations').get() as { n: number };
  if (n === 0) seedDatabase(db);
  if (process.env.OPEN_DATA !== 'off') loadOpenData(db);
  return db;
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

export function insertItem(d: DatabaseSync, item: ArchiveInput): void {
  d.prepare(
    `INSERT INTO archive_items (id, type, title, summary, body, domain, station_id, year, date, tags, url, thumbnail_url, doi, meta, data_status, provenance, owner_id, review_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
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
    item.reviewStatus ?? 'APPROVED'
  );
}

export function listStations(): import('../src/types/polaris.ts').StationData[] {
  return (getDb().prepare('SELECT data FROM stations ORDER BY sort').all() as any[]).map((r) => JSON.parse(r.data));
}

export function getItem(id: string): ArchiveItem | null {
  const row = getDb().prepare('SELECT * FROM archive_items WHERE id = ?').get(id);
  return row ? rowToItem(row) : null;
}
