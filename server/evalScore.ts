/**
 * Scoring for the Ask HIMAKSHA evaluation (scripts/eval-ask.ts, shown at /accuracy).
 * A factual question passes when the answer cites one of the expected records AND states every expected
 * fact (any spelling in a group). An off-topic question passes when HIMAKSHA declines instead of answering.
 */

export interface EvalQuestion {
  id: string;
  category: string;
  question: string;
  records?: string[];
  facts?: string[][];
  offTopic?: boolean;
}

export interface EvalAnswer {
  answer: string;
  mode: string;
  sources: { ref: string; id: string }[];
}

export interface EvalScore {
  retrieved: boolean;
  cited: boolean;
  facts: boolean;
  declined: boolean;
  pass: boolean;
  citedIds: string[];
  missingFacts: string[];
}

const DECLINE = /does not have (this|that|it)|no approved record|not (in|on) (the )?(polaris )?archive|cannot (find|answer)|no (matching|relevant) record/i;

/** Record ids cited in the answer text as [S1], [S2] … mapped through the sources list. */
export function citedIds(a: EvalAnswer): string[] {
  const refs = new Set([...a.answer.matchAll(/\[(S\d+)\]/g)].map((m) => m[1]));
  return a.sources.filter((s) => refs.has(s.ref)).map((s) => s.id);
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

export function scoreAnswer(q: EvalQuestion, a: EvalAnswer): EvalScore {
  const declined = a.mode === 'no_sources' || DECLINE.test(a.answer);
  const cited = citedIds(a);
  if (q.offTopic) {
    return { retrieved: false, cited: false, facts: false, declined, pass: declined, citedIds: cited, missingFacts: [] };
  }
  const want = new Set(q.records ?? []);
  const retrieved = a.sources.some((s) => want.has(s.id));
  const citedRight = cited.some((id) => want.has(id));
  const text = norm(a.answer);
  const missingFacts = (q.facts ?? []).filter((group) => !group.some((f) => text.includes(norm(f)))).map((g) => g[0]);
  const facts = missingFacts.length === 0;
  return { retrieved, cited: citedRight, facts, declined, pass: citedRight && facts && !declined, citedIds: cited, missingFacts };
}

export interface EvalSummary {
  total: number;
  passed: number;
  factual: { total: number; retrieved: number; cited: number; facts: number; passed: number };
  offTopic: { total: number; declined: number };
}

export function summarize(rows: { question: EvalQuestion; score: EvalScore }[]): EvalSummary {
  const factual = rows.filter((r) => !r.question.offTopic);
  const off = rows.filter((r) => r.question.offTopic);
  return {
    total: rows.length,
    passed: rows.filter((r) => r.score.pass).length,
    factual: {
      total: factual.length,
      retrieved: factual.filter((r) => r.score.retrieved).length,
      cited: factual.filter((r) => r.score.cited).length,
      facts: factual.filter((r) => r.score.facts).length,
      passed: factual.filter((r) => r.score.pass).length,
    },
    offTopic: { total: off.length, declined: off.filter((r) => r.score.declined).length },
  };
}
