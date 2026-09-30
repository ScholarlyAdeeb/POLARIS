import express, { type NextFunction, type Request, type Response } from 'express';
import crypto from 'crypto';
import { NOW, type Db } from './pg.ts';
import { HttpError, intOrNull, rateLimit, str, wrap } from './http.ts';

/**
 * Accounts and sessions.
 *  - contributor: uploads their own work and drafts content from it
 *  - reviewer:    approves records and outreach posts from anyone
 *  - admin:       reviewer + user management
 * The ADMIN_TOKEN from .env still works as a bearer token (acts as an admin),
 * so the launcher-printed token keeps opening the review tools.
 */

export const ROLES = ['contributor', 'reviewer', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export interface SessionUser {
  id: number;
  email: string;
  username?: string | null;
  name: string;
  institution: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export const ADMIN_TOKEN = process.env.ADMIN_TOKEN || crypto.randomBytes(18).toString('base64url');
if (!process.env.ADMIN_TOKEN) {
  console.log(`[POLARIS] ADMIN_TOKEN not set; generated one for this run: ${ADMIN_TOKEN}`);
}
const TOKEN_ADMIN: SessionUser = { id: 0, email: '', name: 'Admin (token)', institution: '', role: 'admin' };

const COOKIE = 'polaris_session';
const SESSION_DAYS = 14;
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const want = Buffer.from(hash, 'base64');
  const got = crypto.scryptSync(password, Buffer.from(salt, 'base64'), want.length);
  return crypto.timingSafeEqual(want, got);
}

function sameToken(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function readCookie(req: Request, name: string): string {
  for (const part of (req.get('cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}

const toUser = (r: any): SessionUser => ({ id: r.id, email: r.email, username: r.username ?? null, name: r.name, institution: r.institution, role: r.role });

/** Resolves req.user from the session cookie or a bearer token (session token or ADMIN_TOKEN). */
export function attachUser(db: Db) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.get('authorization') || '';
      const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
      if (bearer && sameToken(bearer, ADMIN_TOKEN)) {
        req.user = TOKEN_ADMIN;
        return next();
      }
      const token = bearer || readCookie(req, COOKIE);
      if (token) {
        const row = await db.get(
          `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ${NOW}`,
          sha256(token)
        );
        if (row) req.user = toUser(row);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, 'Sign in required'));
    if (roles.length && !roles.includes(req.user.role)) return next(new HttpError(403, `This needs the ${roles.join(' or ')} role`));
    next();
  };
}

export const isReviewer = (u?: SessionUser) => u?.role === 'reviewer' || u?.role === 'admin';

async function startSession(db: Db, req: Request, res: Response, userId: number) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.run(`DELETE FROM sessions WHERE expires_at < ${NOW}`);
  await db.run('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)', sha256(token), userId, expires.toISOString());
  const secure = req.secure || req.get('x-forwarded-proto') === 'https' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}${secure}`);
}

/**
 * Demo logins for presentations: user1 / 1234 (contributor) and admin / 0786 (admin).
 * On by default for local use; set DEMO_ACCOUNTS=off on any public deployment.
 */
export const demoAccountsEnabled = () => (process.env.DEMO_ACCOUNTS ?? 'on') !== 'off';
const DEMO = [
  { username: 'user1', password: '1234', email: 'user1@demo.polaris.local', name: 'Demo Contributor', institution: 'POLARIS demo', role: 'contributor' },
  { username: 'admin', password: '0786', email: 'admin@demo.polaris.local', name: 'Demo Admin', institution: 'POLARIS demo', role: 'admin' },
];

export async function seedDemoAccounts(db: Db) {
  if (!demoAccountsEnabled()) return;
  for (const d of DEMO) {
    await db.run(
      `INSERT INTO users (email, username, name, institution, role, password_hash)
       SELECT ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM users WHERE lower(username) = lower(?) OR lower(email) = lower(?))`,
      d.email, d.username, d.name, d.institution, d.role, hashPassword(d.password), d.username, d.email
    );
  }
}

export function createAuthRouter(db: Db) {
  const r = express.Router();
  const limit = rateLimit(20, 10 * 60 * 1000);

  r.post(
    '/register',
    limit,
    wrap(async (req, res) => {
      const name = str(req.body?.name, 'name', { required: true, max: 80 });
      const email = str(req.body?.email, 'email', { required: true, max: 160 }).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address');
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
      if (password.length > 200) throw new HttpError(400, 'Password is too long');
      const institution = str(req.body?.institution, 'institution', { max: 160 });
      if (await db.get('SELECT 1 FROM users WHERE lower(email) = lower(?)', email)) throw new HttpError(409, 'An account with this email already exists');
      const row = await db.get(
        `INSERT INTO users (email, name, institution, role, password_hash) VALUES (?, ?, ?, 'contributor', ?) RETURNING *`,
        email, name, institution, hashPassword(password)
      );
      await startSession(db, req, res, row.id);
      res.status(201).json(toUser(row));
    })
  );

  r.post(
    '/login',
    limit,
    wrap(async (req, res) => {
      // Sign in with email or username.
      const login = str(req.body?.email ?? req.body?.username, 'email', { required: true, max: 160 }).toLowerCase();
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const row = await db.get('SELECT * FROM users WHERE lower(email) = ? OR lower(username) = ?', login, login);
      if (!row || !verifyPassword(password, row.password_hash)) throw new HttpError(401, 'Username/email or password is wrong');
      await startSession(db, req, res, row.id);
      res.json(toUser(row));
    })
  );

  r.post(
    '/logout',
    wrap(async (req, res) => {
      const token = readCookie(req, COOKIE);
      if (token) await db.run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
      res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
      res.status(204).end();
    })
  );

  r.get('/me', (req, res) => res.json(req.user ?? null));
  r.get('/config', (_req, res) => res.json({ demoAccounts: demoAccountsEnabled() ? DEMO.map((d) => ({ username: d.username, password: d.password, role: d.role })) : [] }));
  return r;
}

/** Admin-only user management, mounted under /api/admin/users. */
export function createUsersRouter(db: Db) {
  const r = express.Router();
  r.use(requireRole('admin'));
  r.get(
    '/',
    wrap(async (_req, res) => {
      res.json(
        await db.all(
          `SELECT u.id, u.email, u.username, u.name, u.institution, u.role, u.created_at,
                  (SELECT COUNT(*) FROM archive_items a WHERE a.owner_id = u.id) AS records
           FROM users u ORDER BY u.id`
        )
      );
    })
  );
  r.patch(
    '/:id',
    wrap(async (req, res) => {
      const id = intOrNull(req.params.id, 'id');
      const role = str(req.body?.role, 'role', { required: true }) as Role;
      if (!ROLES.includes(role)) throw new HttpError(400, `role must be one of: ${ROLES.join(', ')}`);
      if (req.user?.id === id && role !== 'admin') throw new HttpError(409, 'You cannot remove your own admin role');
      const row = await db.get('UPDATE users SET role = ? WHERE id = ? RETURNING *', role, id);
      if (!row) throw new HttpError(404, 'User not found');
      res.json(toUser(row));
    })
  );
  return r;
}
