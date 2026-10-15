import type { NextFunction, Request, Response } from 'express';
import type { Db } from './pg.ts';
import { HttpError } from './http.ts';
import type { SessionUser } from './auth.ts';

/**
 * Review rules enforced on the server, not just in the UI.
 *
 * Two-person rule: nobody approves their own work. A contributor's record is approved by someone else,
 * and an outreach draft is approved by someone other than the person who drafted it.
 *
 * Demo sandbox: the shared demo logins are printed on the public sign-in page, so the demo reviewer can
 * only act on content that demo accounts created. Real contributors' work, accounts, proposals (which hold
 * applicants' contact details) and destructive admin actions stay out of reach.
 */

export const DEMO_EMAIL_DOMAIN = '@demo.polaris.local';
export const isDemoUser = (u?: Pick<SessionUser, 'email'> | null) => Boolean(u?.email?.toLowerCase().endsWith(DEMO_EMAIL_DOMAIN));

let demoIds: { at: number; ids: Set<number> } | null = null;
/** Ids of the demo accounts (cached for a minute). */
export async function demoUserIds(db: Db): Promise<Set<number>> {
  if (demoIds && Date.now() - demoIds.at < 60_000) return demoIds.ids;
  const rows = await db.all<{ id: number }>(`SELECT id FROM users WHERE lower(email) LIKE ?`, `%${DEMO_EMAIL_DOMAIN}`);
  demoIds = { at: Date.now(), ids: new Set(rows.map((r) => Number(r.id))) };
  return demoIds.ids;
}

/** Admin routes a demo reviewer may never call (method + path relative to /api/admin). */
const DEMO_BLOCKED: [string, RegExp][] = [
  ['*', /^\/users(\/|$)/],
  ['*', /^\/proposals(\/|$)/],
  ['POST', /^\/archive\/?$/],
  ['PATCH', /^\/archive\/[^/]+\/?$/],
  ['DELETE', /^\/archive\/[^/]+\/?$/],
  ['POST', /^\/uploads\/?$/],
];

/** Mounted on the admin router: blocks the routes above for demo users. Scoping of the rest happens per route. */
export function demoSandbox() {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!isDemoUser(req.user)) return next();
    const blocked = DEMO_BLOCKED.some(([m, re]) => (m === '*' || m === req.method) && re.test(req.path));
    if (blocked) return next(new HttpError(403, 'The demo reviewer cannot do this. It is limited to content created by demo accounts.'));
    next();
  };
}

/** SQL condition limiting rows to demo-owned content when the caller is a demo user ('' otherwise). */
export async function demoScopeSql(db: Db, req: Request, ownerExpr: string): Promise<{ sql: string; params: number[] }> {
  if (!isDemoUser(req.user)) return { sql: '', params: [] };
  const ids = [...(await demoUserIds(db))];
  if (!ids.length) return { sql: 'FALSE', params: [] };
  return { sql: `${ownerExpr} IN (${ids.map(() => '?').join(',')})`, params: ids };
}

/** A demo reviewer may only act on content owned by a demo account. */
export async function assertDemoMayAct(db: Db, req: Request, ownerIds: (number | null | undefined)[]) {
  if (!isDemoUser(req.user)) return;
  const ids = await demoUserIds(db);
  if (!ownerIds.some((id) => id != null && ids.has(Number(id))))
    throw new HttpError(403, 'The demo reviewer can only review content created by demo accounts.');
}

/** Two-person rule: the approver must not be the author. The shared admin token (id 0) owns nothing, so it never trips this. */
export function assertNotOwnWork(user: SessionUser | undefined, authorIds: (number | null | undefined)[], what: string) {
  if (!user || user.id <= 0) return;
  if (authorIds.some((id) => id != null && Number(id) === user.id))
    throw new HttpError(409, `Two-person rule: you cannot approve ${what} you created. Another reviewer has to approve it.`);
}
