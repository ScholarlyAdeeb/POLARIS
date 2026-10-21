import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { normalizePost, verificationCode } from '../server/verify.ts';
import { citedIds, scoreAnswer, summarize, type EvalQuestion } from '../server/evalScore.ts';

test('verification code is 8 hex characters and stable', () => {
  const code = verificationCode({ id: 3, content: 'Aurora over the ice at Maitri.' });
  assert.match(code, /^[0-9A-F]{8}$/);
  assert.equal(verificationCode({ id: 3, content: 'Aurora over the ice at Maitri.' }), code);
});

test('verification code ignores spacing but changes when the text or post changes', () => {
  const a = verificationCode({ id: 3, content: 'Aurora over\n the ice  at Maitri.' });
  assert.equal(a, verificationCode({ id: 3, content: 'Aurora over the ice at Maitri.' }));
  assert.notEqual(a, verificationCode({ id: 3, content: 'Aurora over the ice at Bharati.' }));
  assert.notEqual(a, verificationCode({ id: 4, content: 'Aurora over the ice at Maitri.' }));
  assert.equal(normalizePost('  a \n\n b\t'), 'a b');
});

const q: EvalQuestion = { id: 'q', category: 'x', question: 'Which ship?', records: ['EXP-1'], facts: [['Polar Circle']] };
const sources = [
  { ref: 'S1', id: 'OTHER' },
  { ref: 'S2', id: 'EXP-1' },
];

test('cited ids follow the [S#] references in the answer', () => {
  assert.deepEqual(citedIds({ answer: 'It was MV Polar Circle [S2].', mode: 'generative', sources }), ['EXP-1']);
  assert.deepEqual(citedIds({ answer: 'No citation.', mode: 'generative', sources }), []);
});

test('a factual answer passes only when it cites the right record and states the fact', () => {
  assert.equal(scoreAnswer(q, { answer: 'The MV Polar Circle carried it [S2].', mode: 'generative', sources }).pass, true);
  const wrongCite = scoreAnswer(q, { answer: 'The MV Polar Circle carried it [S1].', mode: 'generative', sources });
  assert.equal(wrongCite.pass, false);
  assert.equal(wrongCite.retrieved, true);
  const noFact = scoreAnswer(q, { answer: 'A ship carried it [S2].', mode: 'generative', sources });
  assert.equal(noFact.pass, false);
  assert.deepEqual(noFact.missingFacts, ['Polar Circle']);
  // case and accents do not matter
  assert.equal(scoreAnswer({ ...q, facts: [['Ny-Ålesund']] }, { answer: 'At ny-alesund [S2].', mode: 'generative', sources }).facts, true);
});

test('off-topic questions pass when HIMAKSHA declines', () => {
  const off: EvalQuestion = { id: 'o', category: 'x', question: 'Who won the World Cup?', offTopic: true };
  assert.equal(scoreAnswer(off, { answer: 'The HIMAKSHA archive does not have this yet.', mode: 'no_sources', sources: [] }).pass, true);
  assert.equal(scoreAnswer(off, { answer: 'France won in 2018.', mode: 'generative', sources: [] }).pass, false);
});

test('summary counts factual and off-topic questions separately', () => {
  const off: EvalQuestion = { id: 'o', category: 'x', question: '?', offTopic: true };
  const s = summarize([
    { question: q, score: scoreAnswer(q, { answer: 'Polar Circle [S2]', mode: 'generative', sources }) },
    { question: q, score: scoreAnswer(q, { answer: 'unknown', mode: 'generative', sources }) },
    { question: off, score: scoreAnswer(off, { answer: '', mode: 'no_sources', sources: [] }) },
  ]);
  assert.deepEqual(s, { total: 3, passed: 2, factual: { total: 2, retrieved: 2, cited: 1, facts: 1, passed: 1 }, offTopic: { total: 1, declined: 1 } });
});

test('the published question set is well formed', () => {
  const { questions } = JSON.parse(fs.readFileSync('server/data/eval/questions.json', 'utf8'));
  const ids = new Set();
  for (const x of questions) {
    assert.ok(!ids.has(x.id), `duplicate id ${x.id}`);
    ids.add(x.id);
    if (x.offTopic) continue;
    assert.ok(x.records?.length, `${x.id} needs expected records`);
    assert.ok(x.facts?.length && x.facts.every((g: string[]) => g.length), `${x.id} needs expected facts`);
  }
  assert.ok(questions.length >= 20);
});
