import type { Request, Response, NextFunction } from 'express';

/** Request helpers shared by every API module. */

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const wrap =
  (fn: (req: Request, res: Response) => unknown) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const out = fn(req, res);
      if (out instanceof Promise) out.catch(next);
    } catch (err) {
      next(err);
    }
  };

export function str(v: unknown, field: string, { required = false, max = 5000 } = {}): string {
  if (v === undefined || v === null || v === '') {
    if (required) throw new HttpError(400, `${field} is required`);
    return '';
  }
  if (typeof v !== 'string') throw new HttpError(400, `${field} must be a string`);
  const s = v.trim();
  if (required && !s) throw new HttpError(400, `${field} is required`);
  if (s.length > max) throw new HttpError(400, `${field} must be at most ${max} characters`);
  return s;
}

/** Tags are stored comma-separated, so a tag may not contain a comma. */
export function tag(v: unknown): string {
  const t = str(v, 'tag', { max: 60 });
  if (t.includes(',')) throw new HttpError(400, `tag "${t}" must not contain a comma`);
  return t;
}

export function intOrNull(v: unknown, field: string): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n)) throw new HttpError(400, `${field} must be an integer`);
  return n;
}

export function publicBase(req: Request): string {
  const configured = process.env.APP_URL;
  if (configured && /^https?:\/\//.test(configured)) return configured.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

export function sendDownload(res: Response, filename: string, contentType: string, body: string | Buffer) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/"/g, '')}"`);
  res.send(body);
}

// Tiny fixed-window limiter for public write endpoints.
export function rateLimit(max: number, windowMs: number) {
  const hits = new Map<string, { n: number; reset: number }>();
  return (req: Request, _res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    const h = hits.get(key);
    if (!h || h.reset < now) hits.set(key, { n: 1, reset: now + windowMs });
    else if (++h.n > max) return next(new HttpError(429, 'Too many requests, try again later'));
    next();
  };
}
