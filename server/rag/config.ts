import path from 'path';

/**
 * RAG configuration. Both backends use open models from Hugging Face:
 *  - local:  models run inside this Node process with transformers.js (ONNX, CPU or GPU).
 *            Nothing leaves the server; first use downloads the models (`npm run rag:models`).
 *  - hosted: the same embedding model and an open chat model through Hugging Face Inference
 *            Providers (needs HF_TOKEN). Used on Vercel, where a function cannot hold a local model.
 * Both write and read the same pgvector index, so records indexed by one are searchable by the other.
 */

export type Backend = 'local' | 'hosted';

const env = (k: string, d = '') => (process.env[k] ?? '').trim() || d;

export const ragConfig = () => {
  const backend: Backend =
    env('RAG_BACKEND') === 'hosted' || env('RAG_BACKEND') === 'local'
      ? (env('RAG_BACKEND') as Backend)
      : process.env.VERCEL
        ? 'hosted'
        : 'local';
  return {
    enabled: env('RAG', 'on') !== 'off',
    backend,
    hfToken: env('HF_TOKEN'),
    /** Sentence embeddings, 384 dimensions. Local runs the ONNX port of the same weights. */
    embedModel: env('RAG_EMBED_MODEL', 'BAAI/bge-small-en-v1.5'),
    embedModelLocal: env('RAG_EMBED_MODEL_LOCAL', 'Xenova/bge-small-en-v1.5'),
    embedDim: 384,
    /** bge models expect this prefix on queries (not on passages). */
    queryPrefix: env('RAG_QUERY_PREFIX', 'Represent this sentence for searching relevant passages: '),
    llmLocal: env('RAG_LLM_MODEL', 'onnx-community/Qwen2.5-1.5B-Instruct'),
    /**
     * Hosted chat models, tried in order: Hugging Face serves each through a set of providers, and an
     * account may not have every provider enabled, so the first model one of them serves is used.
     */
    llmHosted: env('RAG_HF_LLM_MODEL', 'Qwen/Qwen2.5-72B-Instruct,openai/gpt-oss-20b,Qwen/Qwen2.5-7B-Instruct')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean),
    /**
     * cpu (default) runs the 4-bit model with ONNX Runtime's CPU kernels, the fastest option measured
     * (about 6 tokens/s for 1.5B on a laptop i9). dml (Windows GPU) and cuda (Linux) are available, but
     * DirectML has no 4-bit kernels, so it is slower for these models.
     */
    device: env('RAG_DEVICE', 'cpu'),
    /** off = retrieval with an extractive answer only (no language model). */
    llm: env('RAG_LLM', 'on') !== 'off',
    modelDir: path.resolve(process.cwd(), env('RAG_MODEL_DIR', 'data/models')),
    maxNewTokens: Number(env('RAG_MAX_TOKENS', '260')),
  };
};

export type RagConfig = ReturnType<typeof ragConfig>;

/** Files transformers.js needs for a model, and the ONNX weights for a dtype. */
export const modelFiles = (dtype: string) => [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  `onnx/model${dtype === 'fp32' ? '' : `_${dtype === 'q8' ? 'quantized' : dtype}`}.onnx`,
];

export const optionalModelFiles = ['generation_config.json', 'special_tokens_map.json'];

export function localDevice(cfg: RagConfig): 'cpu' | 'dml' | 'cuda' {
  if (cfg.device === 'dml' || cfg.device === 'cuda') return cfg.device;
  return 'cpu';
}

/** fp16 kernels on GPU, int4 weights on CPU. */
export const llmDtype = (device: string) => (device === 'cpu' ? 'q4' : 'q4f16');
export const EMBED_DTYPE = 'q8';
