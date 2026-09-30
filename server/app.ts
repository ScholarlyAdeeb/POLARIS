import express from 'express';
import { createApiRouter, UPLOAD_DIR } from './api.ts';
import { initDb } from './db.ts';

/**
 * The POLARIS Express app: REST API under /api and uploaded media under /uploads.
 * server.ts adds the frontend (Vite in dev, dist/ in production) and listens;
 * server/vercel.ts exports it as a Vercel function, where Vercel serves the frontend itself.
 */
export async function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.VERCEL) app.set('trust proxy', true); // https links and Secure cookies behind Vercel's proxy
  await initDb();
  app.use('/api', await createApiRouter());
  app.use('/uploads', express.static(UPLOAD_DIR, { fallthrough: false, dotfiles: 'deny' }));
  return app;
}
