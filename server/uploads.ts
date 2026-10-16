import express, { type Request } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { put } from '@vercel/blob';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { HttpError, str } from './http.ts';

export const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');

export const UPLOAD_TYPES: Record<string, 'image' | 'video' | 'document' | 'data'> = {
  '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.webp': 'image', '.gif': 'image',
  '.mp4': 'video', '.webm': 'video',
  '.pdf': 'document', '.txt': 'document',
  '.csv': 'data', '.nc': 'data', '.json': 'data',
};

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.pdf': 'application/pdf', '.txt': 'text/plain',
  '.csv': 'text/csv', '.nc': 'application/x-netcdf', '.json': 'application/json',
};

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/**
 * Where uploads live. With a Vercel Blob store connected, files go to Blob; otherwise they are written to
 * UPLOAD_DIR and served from /uploads. A connected store gives the project either BLOB_READ_WRITE_TOKEN
 * (older stores) or BLOB_STORE_ID, authenticated through the deployment's OIDC token (newer stores).
 * Browsers can upload straight to Blob (no 4.5 MB function limit) only with the read-write token.
 */
export const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
export const blobDirectUploads = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);
/** Largest upload a serverless function accepts in its request body (Vercel: 4.5 MB). */
export const SERVER_UPLOAD_LIMIT = process.env.VERCEL ? 4.5 * 1024 * 1024 : MAX_UPLOAD_BYTES_LOCAL();
function MAX_UPLOAD_BYTES_LOCAL() {
  return 100 * 1024 * 1024;
}
const isBlobUrl = (url: string) => /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(url);

/** Body parser for raw file uploads (the file bytes are the request body, the name is in X-Filename). */
export const rawBody = express.raw({ type: () => true, limit: process.env.MAX_UPLOAD || '100mb' });

function checkName(original: string) {
  const ext = path.extname(original).toLowerCase();
  const kind = UPLOAD_TYPES[ext];
  if (!kind) throw new HttpError(400, `File type ${ext || '(none)'} is not allowed. Allowed: ${Object.keys(UPLOAD_TYPES).join(' ')}`);
  const safeBase = path.basename(original, ext).replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 60) || 'file';
  return { ext, kind, name: `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeBase}${ext}` };
}

/** Upload whose bytes are the request body (admin API, and contributors when no Blob store is connected). */
export async function saveUpload(req: Request) {
  const original = str(req.get('x-filename'), 'X-Filename header', { required: true, max: 200 });
  const { ext, kind, name } = checkName(original);
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw new HttpError(400, 'Empty upload');
  if (blobEnabled()) {
    const blob = await put(`uploads/${name}`, req.body, { access: 'public', contentType: CONTENT_TYPES[ext], addRandomSuffix: false });
    return { url: blob.url, kind, bytes: req.body.length, originalName: original };
  }
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, name), req.body);
  return { url: `/uploads/${name}`, kind, bytes: req.body.length, originalName: original };
}

/** Token exchange for a direct browser → Blob upload (keeps large files off the 4.5 MB function body limit). */
export async function blobUploadToken(req: Request) {
  if (!blobDirectUploads()) throw new HttpError(404, 'Direct Blob uploads need BLOB_READ_WRITE_TOKEN on this deployment');
  return handleUpload({
    body: req.body as HandleUploadBody,
    request: req,
    onBeforeGenerateToken: async (pathname) => {
      checkName(pathname);
      if (!pathname.startsWith('uploads/')) throw new HttpError(400, 'Uploads must go under uploads/');
      return { allowedContentTypes: Object.values(CONTENT_TYPES), maximumSizeInBytes: MAX_UPLOAD_BYTES, addRandomSuffix: true };
    },
    onUploadCompleted: async () => undefined,
  });
}

/** Describe a file the browser already put in Blob, in the same shape as saveUpload(). */
export function describeBlobUpload(body: unknown) {
  const b = (body ?? {}) as { url?: unknown; originalName?: unknown; bytes?: unknown };
  const url = str(b.url, 'url', { required: true, max: 500 });
  if (!isBlobUrl(url)) throw new HttpError(400, 'url must be a file in this app’s Blob store');
  const originalName = str(b.originalName, 'originalName', { required: true, max: 200 });
  const { kind } = checkName(originalName);
  const bytes = Number(b.bytes);
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > MAX_UPLOAD_BYTES) throw new HttpError(400, 'bytes is out of range');
  return { url, kind, bytes, originalName };
}

/** Local path for an /uploads/... URL, or null for anything else. */
export function uploadPath(url: string | null | undefined): string | null {
  if (!url || !url.startsWith('/uploads/')) return null;
  const file = path.join(UPLOAD_DIR, path.basename(url));
  return fs.existsSync(file) ? file : null;
}

/** Text of an uploaded file, whether it is on local disk or in Blob; null if it is neither. */
export async function readUploadText(url: string | null | undefined): Promise<string | null> {
  const file = uploadPath(url);
  if (file) return fs.readFileSync(file, 'utf8');
  if (url && isBlobUrl(url)) {
    const res = await fetch(url);
    return res.ok ? res.text() : null;
  }
  return null;
}
