import pg from 'pg';

/**
 * Thin async layer over node-postgres. SQL is written with `?` placeholders (or `?1`, `?2`
 * for reused values); they are rewritten to Postgres `$n` parameters here.
 */

// COUNT(*) / SUM() come back as int8 / numeric strings by default; the app wants numbers.
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));

export interface RunResult {
  changes: number;
  rows: any[];
}

export interface Db {
  all<T = any>(sql: string, ...params: unknown[]): Promise<T[]>;
  get<T = any>(sql: string, ...params: unknown[]): Promise<T | undefined>;
  run(sql: string, ...params: unknown[]): Promise<RunResult>;
  exec(sql: string): Promise<void>;
  tx<T>(fn: (t: Db) => Promise<T>): Promise<T>;
}

/** `?` -> `$1, $2, …` and `?N` -> `$N`, ignoring question marks inside quoted strings. */
export function toPg(sql: string): string {
  let out = '';
  let n = 0;
  let quote: string | null = null;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (quote) {
      out += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      out += c;
      continue;
    }
    if (c === '?') {
      const m = /^\d+/.exec(sql.slice(i + 1));
      if (m) {
        out += `$${m[0]}`;
        i += m[0].length;
      } else out += `$${++n}`;
      continue;
    }
    out += c;
  }
  return out;
}

type Queryable = pg.Pool | pg.PoolClient;

function wrapQueryable(q: Queryable, pool: pg.Pool): Db {
  const query = (sql: string, params: unknown[]) => q.query(toPg(sql), params as any[]);
  const db: Db = {
    all: async (sql, ...params) => (await query(sql, params)).rows,
    get: async (sql, ...params) => (await query(sql, params)).rows[0],
    run: async (sql, ...params) => {
      const r = await query(sql, params);
      return { changes: r.rowCount ?? 0, rows: r.rows };
    },
    exec: async (sql) => {
      await q.query(sql);
    },
    tx: async (fn) => {
      // Already inside a transaction: reuse it.
      if (q !== pool) return fn(db);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const out = await fn(wrapQueryable(client, pool));
        await client.query('COMMIT');
        return out;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    },
  };
  return db;
}

export function connect(connectionString: string): Db {
  // pg treats sslmode=require as verify-full already; say so explicitly to keep that behaviour
  // (and avoid the driver's deprecation warning).
  const url = connectionString.replace(/sslmode=(require|prefer|verify-ca)\b/, 'sslmode=verify-full');
  const pool = new pg.Pool({ connectionString: url, max: Number(process.env.PG_POOL_MAX || 10), idleTimeoutMillis: 30_000 });
  pool.on('error', (err) => console.error('[POLARIS DB] idle client error:', err.message));
  return wrapQueryable(pool, pool);
}

/** UTC timestamp in the ISO text format the app stores (2026-09-29T14:07:31.035Z). */
export const NOW = `to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
