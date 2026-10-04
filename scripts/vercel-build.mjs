// Vercel build (Build Output API v3): the React app as static files, the Express API as one bundled Node function.
// Run by Vercel via vercel.json's buildCommand; locally: `npm run vercel-build` (writes .vercel/output).
import { build } from 'esbuild';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const out = path.join(root, '.vercel', 'output');
const fn = path.join(out, 'functions', 'api.func');

fs.rmSync(out, { recursive: true, force: true });

// 1. Frontend
execSync('npx vite build', { cwd: root, stdio: 'inherit' });
fs.cpSync(path.join(root, 'dist'), path.join(out, 'static'), { recursive: true });

// 2. API function
await build({
  entryPoints: [path.join(root, 'server', 'vercel.ts')],
  outfile: path.join(fn, 'index.mjs'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: 'linked',
  // Local RAG models (transformers.js + ONNX Runtime) never run in the function; Vercel uses the hosted backend.
  external: ['pg-native', 'vite', '@huggingface/transformers', 'onnxruntime-node'],
  // CommonJS dependencies inside an ESM bundle still call require()/__dirname
  banner: {
    js: [
      "import { createRequire as __cr } from 'module';",
      "import { fileURLToPath as __fu } from 'url';",
      "import { dirname as __dn } from 'path';",
      'const require = __cr(import.meta.url);',
      'const __filename = __fu(import.meta.url);',
      'const __dirname = __dn(__filename);',
    ].join('\n'),
  },
  logLevel: 'info',
});
// Data files the API reads at runtime (paths are relative to the working directory, the function root)
fs.cpSync(path.join(root, 'server', 'data'), path.join(fn, 'server', 'data'), { recursive: true });
fs.writeFileSync(path.join(fn, 'package.json'), JSON.stringify({ type: 'module' }));
fs.writeFileSync(
  path.join(fn, '.vc-config.json'),
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration: 60 }, null, 2)
);

// 3. Routing: /api/* → function, real files → static, everything else → the SPA
fs.writeFileSync(
  path.join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/api(?:/.*)?$', dest: '/api' },
        { src: '^/assets/(.*)$', headers: { 'cache-control': 'public, max-age=31536000, immutable' }, continue: true },
        { handle: 'filesystem' },
        { src: '/.*', dest: '/index.html' },
      ],
    },
    null,
    2
  )
);
console.log('Vercel build output written to', path.relative(root, out));
