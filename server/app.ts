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
  // Behind a proxy (Vercel, Render, nginx) req.ip and req.protocol must come from X-Forwarded-*, or every
  // client shares the proxy's IP in the rate limiters. TRUST_PROXY is the number of proxy hops.
  if (process.env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);
  else if (process.env.VERCEL || process.env.RENDER) app.set('trust proxy', 1);
  await initDb();
  app.use('/api', await createApiRouter());
  app.use('/uploads', express.static(UPLOAD_DIR, { fallthrough: false, dotfiles: 'deny' }));
  return app;
}
