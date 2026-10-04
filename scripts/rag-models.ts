// Download the local RAG models from Hugging Face into RAG_MODEL_DIR (default data/models).
// Resumable: run it again after a dropped connection and it continues where it stopped.
//   npm run rag:models
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { EMBED_DTYPE, llmDtype, localDevice, modelFiles, optionalModelFiles, ragConfig } from '../server/rag/config.ts';

const cfg = ragConfig();
const device = localDevice(cfg);

async function fetchFile(model: string, file: string, optional = false) {
  const dest = path.join(cfg.modelDir, model, file);
  const url = `https://huggingface.co/${model}/resolve/main/${file}`;
  const headers: Record<string, string> = cfg.hfToken ? { authorization: `Bearer ${cfg.hfToken}` } : {};

  const head = await fetch(url, { method: 'HEAD', headers, redirect: 'follow' });
  if (!head.ok) {
    if (optional) return;
    throw new Error(`${model}/${file}: HTTP ${head.status}`);
  }
  const total = Number(head.headers.get('content-length') || 0);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (total && fs.existsSync(dest) && fs.statSync(dest).size === total) return console.log(`  ok   ${file}`);

  const part = dest + '.part';
  for (let attempt = 1; ; attempt++) {
    const have = fs.existsSync(part) ? fs.statSync(part).size : 0;
    // A stalled connection (no bytes for 30 s) is aborted and resumed from where it stopped.
    const ctrl = new AbortController();
    let idle = setTimeout(() => ctrl.abort(), 30_000);
    let out: fs.WriteStream | null = null;
    try {
      const res = await fetch(url, { headers: { ...headers, ...(have ? { range: `bytes=${have}-` } : {}) }, redirect: 'follow', signal: ctrl.signal });
      if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`);
      out = fs.createWriteStream(part, { flags: have && res.status === 206 ? 'a' : 'w' });
      let got = res.status === 206 ? have : 0;
      let shown = 0;
      for await (const chunk of res.body as any) {
        clearTimeout(idle);
        idle = setTimeout(() => ctrl.abort(), 30_000);
        out.write(chunk);
        got += chunk.length;
        if (total > 50e6 && got - shown > 25e6) {
          shown = got;
          process.stdout.write(`\r  ...  ${file} ${(got / 1e6).toFixed(0)} / ${(total / 1e6).toFixed(0)} MB`);
        }
      }
      await new Promise((r) => out!.end(r));
      out = null;
      if (total && fs.statSync(part).size !== total) throw new Error('incomplete');
      fs.renameSync(part, dest);
      if (shown) process.stdout.write('\n');
      return console.log(`  got  ${file}`);
    } catch (err: any) {
      if (out) await new Promise((r) => out!.end(r)); // flush what arrived; the next attempt resumes after it
      if (attempt >= 8) throw new Error(`${model}/${file}: ${err.message}`);
      console.log(`\n  retry ${file} (${err.message})`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    } finally {
      clearTimeout(idle);
    }
  }
}

async function fetchModel(model: string, dtype: string) {
  console.log(`${model} (${dtype})`);
  for (const f of modelFiles(dtype)) await fetchFile(model, f);
  for (const f of optionalModelFiles) await fetchFile(model, f, true);
}

await fetchModel(cfg.embedModelLocal, EMBED_DTYPE);
if (cfg.llm) await fetchModel(cfg.llmLocal, llmDtype(device));
console.log(`Models ready in ${cfg.modelDir} (device: ${device})`);
