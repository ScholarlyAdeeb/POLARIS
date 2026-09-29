import express, { type Request } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { HttpError, str } from './http.ts';

export const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');

export const UPLOAD_TYPES: Record<string, 'image' | 'video' | 'document' | 'data'> = {
  '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.webp': 'image', '.gif': 'image',
  '.mp4': 'video', '.webm': 'video',
  '.pdf': 'document', '.txt': 'document',
  '.csv': 'data', '.nc': 'data', '.json': 'data',
};

/** Body parser for raw file uploads (the file bytes are the request body, the name is in X-Filename). */
export const rawBody = express.raw({ type: () => true, limit: process.env.MAX_UPLOAD || '100mb' });

export function saveUpload(req: Request) {
  const original = str(req.get('x-filename'), 'X-Filename header', { required: true, max: 200 });
  const ext = path.extname(original).toLowerCase();
  const kind = UPLOAD_TYPES[ext];
  if (!kind) throw new HttpError(400, `File type ${ext || '(none)'} is not allowed. Allowed: ${Object.keys(UPLOAD_TYPES).join(' ')}`);
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw new HttpError(400, 'Empty upload');
  const safeBase = path.basename(original, ext).replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 60) || 'file';
  const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeBase}${ext}`;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, name), req.body);
  return { url: `/uploads/${name}`, kind, bytes: req.body.length, originalName: original };
}

/** Local path for an /uploads/... URL, or null for anything else. */
export function uploadPath(url: string | null | undefined): string | null {
  if (!url || !url.startsWith('/uploads/')) return null;
  const file = path.join(UPLOAD_DIR, path.basename(url));
  return fs.existsSync(file) ? file : null;
}
