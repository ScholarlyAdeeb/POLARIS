import type { DatabaseSync } from 'node:sqlite';

/**
 * Explicit, append-only schema migrations. Each runs once, in order, inside a
 * transaction; applied versions are recorded in schema_migrations. Existing
 * archive rows are never dropped: new columns get defaults and are back-filled.
 */

export const DATA_STATUSES = ['OFFICIAL', 'VERIFIED', 'SAMPLE', 'SYNTHETIC', 'AI_GENERATED', 'UNVERIFIED'] as const;
export type DataStatus = (typeof DATA_STATUSES)[number];

export const REVIEW_STATUSES = ['PENDING_REVIEW', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Status for a record from what we know about where it came from. */
export function deriveDataStatus(type: string, meta: Record<string, any>): DataStatus {
  if (meta?.dataStatus && (DATA_STATUSES as readonly string[]).includes(meta.dataStatus)) return meta.dataStatus;
  if (meta?.sample) return type === 'dataset' ? 'SYNTHETIC' : 'SAMPLE';
  return 'UNVERIFIED';
}

export function deriveProvenance(type: string, meta: Record<string, any>): Record<string, any> {
  if (meta?.sample) {
    return {
      source: 'POLARIS demo seed (server/seed.ts)',
      method: type === 'dataset' ? 'Synthetic sample extract generated from record metadata' : 'Illustrative demo record',
      note: 'Not an NCPOR data product. Replace through the admin API.',
    };
  }
  return {
    source: 'POLARIS seed from src/data/polarisData.ts',
    method: 'Compiled by the project team from public descriptions; not yet verified against NCPOR records',
  };
}

interface Migration {
  version: number;
  name: string;
  up: (db: DatabaseSync) => void;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'archive provenance: data_status, provenance, review_status',
    up: (db) => {
      db.exec(`
        ALTER TABLE archive_items ADD COLUMN data_status TEXT NOT NULL DEFAULT 'UNVERIFIED';
        ALTER TABLE archive_items ADD COLUMN provenance TEXT NOT NULL DEFAULT '{}';
        ALTER TABLE archive_items ADD COLUMN review_status TEXT NOT NULL DEFAULT 'APPROVED';
        CREATE INDEX IF NOT EXISTS idx_archive_status ON archive_items(data_status);
      `);
      const rows = db.prepare('SELECT id, type, meta FROM archive_items').all() as any[];
      const upd = db.prepare('UPDATE archive_items SET data_status = ?, provenance = ? WHERE id = ?');
      for (const r of rows) {
        const meta = JSON.parse(r.meta || '{}');
        upd.run(deriveDataStatus(r.type, meta), JSON.stringify(deriveProvenance(r.type, meta)), r.id);
      }
    },
  },
  {
    version: 2,
    name: 'station + hotspot data status',
    up: (db) => {
      db.exec(`
        ALTER TABLE stations ADD COLUMN data_status TEXT NOT NULL DEFAULT 'UNVERIFIED';
        ALTER TABLE stations ADD COLUMN readings_status TEXT NOT NULL DEFAULT 'SYNTHETIC';
        ALTER TABLE hotspots ADD COLUMN data_status TEXT NOT NULL DEFAULT 'SAMPLE';
      `);
    },
  },
  {
    version: 3,
    name: 'outreach review workflow',
    up: (db) => {
      db.exec(`
        ALTER TABLE outreach_posts ADD COLUMN data_status TEXT NOT NULL DEFAULT 'TEMPLATE';
        ALTER TABLE outreach_posts ADD COLUMN review_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW';
        ALTER TABLE outreach_posts ADD COLUMN provider TEXT NOT NULL DEFAULT 'template';
        ALTER TABLE outreach_posts ADD COLUMN claim_check TEXT NOT NULL DEFAULT '{}';
        ALTER TABLE outreach_posts ADD COLUMN reviewer TEXT;
        ALTER TABLE outreach_posts ADD COLUMN review_note TEXT;
        ALTER TABLE outreach_posts ADD COLUMN reviewed_at TEXT;
        UPDATE outreach_posts SET review_status = 'APPROVED' WHERE status IN ('APPROVED', 'PUBLISHED');
      `);
    },
  },
  {
    version: 4,
    name: 'semantic embeddings + assistant audit log',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS item_embeddings (
          item_id TEXT PRIMARY KEY REFERENCES archive_items(id) ON DELETE CASCADE,
          model TEXT NOT NULL,
          dim INTEGER NOT NULL,
          vector TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );
        CREATE TABLE IF NOT EXISTS ai_queries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          question TEXT NOT NULL,
          provider TEXT NOT NULL,
          model TEXT,
          retrieval_mode TEXT NOT NULL,
          answer TEXT NOT NULL,
          citations TEXT NOT NULL,
          verification TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );
      `);
    },
  },
];

export function runMigrations(db: DatabaseSync): number[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )`);
  const done = new Set((db.prepare('SELECT version FROM schema_migrations').all() as any[]).map((r) => r.version));
  const applied: number[] = [];
  for (const m of MIGRATIONS) {
    if (done.has(m.version)) continue;
    db.exec('BEGIN');
    try {
      m.up(db);
      db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(m.version, m.name);
      db.exec('COMMIT');
      applied.push(m.version);
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${m.version} (${m.name}) failed: ${(err as Error).message}`);
    }
  }
  if (applied.length) console.log(`[POLARIS] Applied migrations: ${applied.join(', ')}`);
  return applied;
}
