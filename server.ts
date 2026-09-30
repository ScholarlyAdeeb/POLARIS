import 'dotenv/config'; // must run before ./server/api.ts reads ADMIN_TOKEN, DATABASE_URL etc.
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApp } from './server/app.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

// Setup dev server with Vite or production static handler
async function startServer() {
  // REST API (PostgreSQL knowledge repository) and uploaded media
  const app = await createApp();

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`POLARIS server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('[POLARIS] Could not start:', err.message);
  process.exit(1);
});
