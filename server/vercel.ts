import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from './app.ts';

/**
 * Vercel function entry (bundled by scripts/vercel-build.mjs). The app is created once per
 * instance and reused across requests; /api/* is routed here, everything else is static.
 */
let ready: ReturnType<typeof createApp> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  ready ??= createApp().catch((err) => {
    ready = null; // let the next request retry (e.g. database briefly unreachable)
    throw err;
  });
  const app = await ready;
  app(req as any, res as any);
}
