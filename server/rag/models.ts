import { EMBED_DTYPE, llmDtype, localDevice, ragConfig, type RagConfig } from './config.ts';

/**
 * Embedding and generation behind one interface, for both backends (see config.ts).
 * Local models load lazily on first use and stay in memory; generation runs one request at a time.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

type Pipe = any;
let tf: Promise<any> | null = null;
let embedPipe: Promise<Pipe> | null = null;
let llmPipe: Promise<{ pipe: Pipe; device: string }> | null = null;
let queue: Promise<unknown> = Promise.resolve();

/** transformers.js is imported only by the local backend (it is not bundled into the Vercel function). */
function transformers(cfg: RagConfig) {
  tf ??= import('@huggingface/transformers').then((m) => {
    m.env.localModelPath = cfg.modelDir;
    m.env.cacheDir = cfg.modelDir;
    m.env.allowLocalModels = true;
    m.env.allowRemoteModels = true;
    return m;
  });
  return tf;
}

const normalise = (v: number[]) => {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
};

// ---- embeddings -----------------------------------------------------------------

export async function embed(texts: string[], kind: 'query' | 'passage'): Promise<number[][]> {
  const cfg = ragConfig();
  const inputs = kind === 'query' ? texts.map((t) => cfg.queryPrefix + t) : texts;
  if (cfg.backend === 'hosted') return embedHosted(cfg, inputs);
  embedPipe ??= transformers(cfg).then((m) => m.pipeline('feature-extraction', cfg.embedModelLocal, { dtype: EMBED_DTYPE, device: 'cpu' }));
  const pipe = await embedPipe.catch((err) => {
    embedPipe = null;
    throw err;
  });
  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += 16) {
    const t = await pipe(inputs.slice(i, i + 16), { pooling: 'cls', normalize: true });
    out.push(...(t.tolist() as number[][]));
  }
  return out;
}

async function embedHosted(cfg: RagConfig, inputs: string[]): Promise<number[][]> {
  if (!cfg.hfToken) throw new Error('HF_TOKEN is not set (needed for the hosted backend)');
  const out: number[][] = [];
  for (let i = 0; i < inputs.length; i += 32) {
    const res = await fetch(`https://router.huggingface.co/hf-inference/models/${cfg.embedModel}/pipeline/feature-extraction`, {
      method: 'POST',
      headers: { authorization: `Bearer ${cfg.hfToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ inputs: inputs.slice(i, i + 32), normalize: true }),
    });
    if (!res.ok) throw new Error(`Embedding service: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    const rows = (await res.json()) as number[][];
    out.push(...rows.map(normalise));
  }
  return out;
}

// ---- generation -----------------------------------------------------------------

/** Hosted models this deployment cannot use (no enabled provider), and the one that last worked. */
const unavailable = new Set<string>();
let hostedInUse: string | null = null;

export function llmName(cfg = ragConfig()) {
  if (cfg.backend === 'local') return cfg.llmLocal;
  return hostedInUse ?? cfg.llmHosted.find((m) => !unavailable.has(m)) ?? cfg.llmHosted[0];
}

/** Load the local language model now (startup warm-up), so the first question is not slow. */
export function warmLocalLlm() {
  const cfg = ragConfig();
  if (cfg.backend !== 'local' || !cfg.llm) return Promise.resolve(null);
  llmPipe ??= (async () => {
    const m = await transformers(cfg);
    const device = localDevice(cfg);
    try {
      return { pipe: await m.pipeline('text-generation', cfg.llmLocal, { device, dtype: llmDtype(device) }), device };
    } catch (err: any) {
      if (device === 'cpu') throw err;
      console.warn(`[POLARIS] RAG: ${device} unavailable (${err.message}); using CPU`);
      return { pipe: await m.pipeline('text-generation', cfg.llmLocal, { device: 'cpu', dtype: llmDtype('cpu') }), device: 'cpu' };
    }
  })().catch((err) => {
    llmPipe = null;
    throw err;
  });
  return llmPipe;
}

export const localLlmState = () => (llmPipe ? 'loaded' : 'not loaded');
export let localLlmDevice: string | null = null;

/** Streams the answer through onToken and resolves with the full text. */
export async function generate(messages: ChatMessage[], onToken: (t: string) => void, signal?: AbortSignal): Promise<string> {
  const cfg = ragConfig();
  if (cfg.backend === 'hosted') return generateHosted(cfg, messages, onToken, signal);
  const run = async () => {
    const { pipe, device } = (await warmLocalLlm())!;
    localLlmDevice = device;
    const m = await transformers(cfg);
    let text = '';
    const streamer = new m.TextStreamer(pipe.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (t: string) => {
        text += t;
        onToken(t);
      },
    });
    const stopper = new m.StoppingCriteria();
    stopper._call = (ids: any[]) => ids.map(() => Boolean(signal?.aborted));
    await pipe(messages, { max_new_tokens: cfg.maxNewTokens, do_sample: false, repetition_penalty: 1.05, streamer, stopping_criteria: [stopper] });
    return text;
  };
  const job = queue.then(run, run);
  queue = job.catch(() => undefined);
  return job;
}

async function generateHosted(cfg: RagConfig, messages: ChatMessage[], onToken: (t: string) => void, signal?: AbortSignal) {
  if (!cfg.hfToken) throw new Error('HF_TOKEN is not set (needed for the hosted backend)');
  let res: Response | null = null;
  let lastError = '';
  for (const model of cfg.llmHosted.filter((m) => !unavailable.has(m))) {
    const r = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: { authorization: `Bearer ${cfg.hfToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: true, max_tokens: cfg.maxNewTokens, temperature: 0.1 }),
    });
    if (r.ok && r.body) {
      hostedInUse = model;
      res = r;
      break;
    }
    lastError = `HTTP ${r.status} ${(await r.text()).slice(0, 200)}`;
    // Not served by any provider on this account: skip it from now on and try the next model.
    if ((r.status === 400 || r.status === 404) && /not supported|model_not_supported|not found|does not exist/i.test(lastError)) {
      unavailable.add(model);
      continue;
    }
    throw new Error(`Language model service (${model}): ${lastError}`);
  }
  if (!res || !res.body) throw new Error(`No configured model is available to this Hugging Face account (${lastError})`);
  let text = '';
  let buf = '';
  const decoder = new TextDecoder();
  for await (const chunk of res.body as any) {
    buf += decoder.decode(chunk, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return text;
      try {
        const t = JSON.parse(data).choices?.[0]?.delta?.content;
        if (t) {
          text += t;
          onToken(t);
        }
      } catch {
        /* keep-alive or partial line */
      }
    }
  }
  return text;
}
