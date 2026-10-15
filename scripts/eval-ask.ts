// Runs the fixed Ask POLARIS questions against a running portal and writes server/data/eval/results.json,
// which the public /accuracy page shows. Uses the same endpoint visitors use, so it measures the real system.
//
//   npm run eval                                   (local server on :3000)
//   EVAL_BASE=https://polaris2-ecru.vercel.app npm run eval
import fs from 'fs';
import path from 'path';
import { scoreAnswer, summarize, type EvalQuestion } from '../server/evalScore.ts';

const BASE = (process.env.EVAL_BASE || 'http://localhost:3000').replace(/\/$/, '');
const DIR = path.resolve(process.cwd(), 'server', 'data', 'eval');
const { questions } = JSON.parse(fs.readFileSync(path.join(DIR, 'questions.json'), 'utf8')) as { questions: EvalQuestion[] };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function askOnce(question: string) {
  const res = await fetch(`${BASE}/api/rag/ask`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const stream = await res.text();
  let done: any = null;
  let error: string | null = null;
  for (const block of stream.split('\n\n')) {
    const event = block.match(/^event: (.+)$/m)?.[1];
    const data = block.match(/^data: (.*)$/m)?.[1];
    if (!event || data == null) continue;
    if (event === 'done') done = JSON.parse(data);
    if (event === 'error') error = JSON.parse(data).error;
  }
  if (error) throw new Error(error);
  if (!done) throw new Error('no answer in the response');
  return done;
}

async function main() {
  const status = await fetch(`${BASE}/api/rag/status`).then((r) => r.json()).catch(() => null);
  console.log(`Evaluating ${questions.length} questions against ${BASE} (model: ${status?.llm ?? 'unknown'})`);
  const rows = [];
  for (const q of questions) {
    let result: any = null;
    let error: string | null = null;
    for (let attempt = 1; attempt <= 3 && !result; attempt++) {
      try {
        result = await askOnce(q.question);
      } catch (err: any) {
        error = err.message;
        await sleep(5000 * attempt);
      }
    }
    const answer = result
      ? { answer: String(result.answer ?? ''), mode: String(result.mode ?? ''), sources: (result.sources ?? []).map((s: any) => ({ ref: s.ref, id: s.id, title: s.title, pages: s.pages ?? [] })) }
      : { answer: '', mode: 'error', sources: [] };
    const score = scoreAnswer(q, answer);
    rows.push({
      question: q,
      answer: answer.answer,
      mode: answer.mode,
      model: result?.model ?? null,
      sources: answer.sources,
      verification: result?.verification ? { supported: result.verification.supported, partial: result.verification.partial, unsupported: result.verification.unsupported } : null,
      ms: result?.timings ? (result.timings.retrievalMs ?? 0) + (result.timings.generationMs ?? 0) : null,
      error: result ? null : error,
      score,
    });
    console.log(`${score.pass ? 'PASS' : 'FAIL'}  ${q.id}  ${q.question}${score.missingFacts.length ? `  (missing: ${score.missingFacts.join(', ')})` : ''}${result ? '' : `  [${error}]`}`);
    await sleep(3500); // stays under the 20 questions/minute limit
  }
  const out = { ranAt: new Date().toISOString(), base: BASE, model: status?.llm ?? null, embedModel: status?.embedModel ?? null, summary: summarize(rows), rows };
  fs.writeFileSync(path.join(DIR, 'results.json'), JSON.stringify(out, null, 1));
  const s = out.summary;
  console.log(`\n${s.passed}/${s.total} passed. Factual: cited the right record ${s.factual.cited}/${s.factual.total}, stated the fact ${s.factual.facts}/${s.factual.total}. Off-topic declined ${s.offTopic.declined}/${s.offTopic.total}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
