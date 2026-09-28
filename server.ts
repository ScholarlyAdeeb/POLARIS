import 'dotenv/config'; // must run before ./server/api.ts reads ADMIN_TOKEN etc.
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApiRouter, UPLOAD_DIR } from './server/api.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');

// REST API (SQLite-backed knowledge repository) and uploaded media
app.use('/api', createApiRouter());
app.use('/uploads', express.static(UPLOAD_DIR, { fallthrough: false, dotfiles: 'deny' }));

// Setup dev server with Vite or production static handler
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`POLARIS server running on http://0.0.0.0:${port}`);
  });
}

startServer();
