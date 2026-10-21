import express, { type Request } from 'express';
import type { Db } from './pg.ts';
import { intOrNull, wrap } from './http.ts';
import { isReviewer, requireRole } from './auth.ts';
import { demoScopeSql } from './guards.ts';

/**
 * Audit trail: one row per decision (submit, edit, approve, request changes, reject, publish,
 * access change, delete). Rows are only ever inserted, never updated or deleted by the app.
 * Approved records show their own history publicly; reviewers see the full log.
 */

export type AuditTarget = 'record' | 'post' | 'certificate';

export interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  role: string;
  action: string;
  target_type: AuditTarget;
  target_id: string;
  detail: Record<string, unknown>;
}

export async function audit(
  db: Db,
  req: Request | null,
  action: string,
  targetType: AuditTarget,
  targetId: string | number,
  detail: Record<string, unknown> = {}
): Promise<void> {
  const u = req?.user;
  const actor = u ? (u.id > 0 ? u.name : 'Admin token') : 'Public';
  await db.run(
    'INSERT INTO audit_log (actor_id, actor, role, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?, ?, ?)',
    u && u.id > 0 ? u.id : null,
    actor,
    u?.role ?? 'public',
    action,
    targetType,
    String(targetId),
    JSON.stringify(detail)
  );
}

const parse = (r: any): AuditEntry => ({ ...r, detail: JSON.parse(r.detail || '{}') });

export function historyFor(db: Db, targetType: AuditTarget, targetId: string | number) {
  return db
    .all('SELECT id, at, actor, role, action, target_type, target_id, detail FROM audit_log WHERE target_type = ? AND target_id = ? ORDER BY id', targetType, String(targetId))
    .then((rows) => rows.map(parse));
}

export function createAuditRouter(db: Db) {
  const r = express.Router();

  // Public for approved records; owners and reviewers also see the history of work still in review.
  r.get(
    '/archive/:id/history',
    wrap(async (req, res) => {
      const row = await db.get<{ review_status: string; owner_id: number | null }>('SELECT review_status, owner_id FROM archive_items WHERE id = ?', req.params.id);
      const maySee = row && (row.review_status === 'APPROVED' || isReviewer(req.user) || (req.user && row.owner_id === req.user.id));
      if (!maySee) return res.status(404).json({ error: 'Record not found' });
      const posts = await db.all<{ id: number }>("SELECT id FROM outreach_posts WHERE item_id = ? AND status = 'PUBLISHED'", req.params.id);
      const events = [...(await historyFor(db, 'record', req.params.id))];
      for (const p of posts) events.push(...(await historyFor(db, 'post', p.id)));
      res.json(events.sort((a, b) => a.id - b.id));
    })
  );

  r.get(
    '/admin/audit',
    requireRole('reviewer', 'admin'),
    wrap(async (req, res) => {
      const limit = Math.min(Math.max(intOrNull(req.query.limit, 'limit') ?? 100, 1), 500);
      // Shared demo logins see only the trail of demo-owned work.
      const scope = await demoScopeSql(db, req, 'l.actor_id');
      const rows = await db.all(
        `SELECT l.id, l.at, l.actor, l.role, l.action, l.target_type, l.target_id, l.detail FROM audit_log l
         ${scope.sql ? `WHERE ${scope.sql}` : ''} ORDER BY l.id DESC LIMIT ?`,
        ...scope.params,
        limit
      );
      res.json(rows.map(parse));
    })
  );

  return r;
}
