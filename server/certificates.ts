import express from 'express';
import crypto from 'crypto';
import type { Db } from './pg.ts';
import { HttpError, intOrNull, rateLimit, str, wrap } from './http.ts';
import { buildQuiz } from './extras.ts';
import { audit } from './audit.ts';

/**
 * Learning certificates. The server rebuilds the day's quiz from its seed and grades the answers
 * itself, so a certificate means the questions were answered, not that the browser said so.
 * Each certificate has a code ("C-" + 8 characters) that anyone can check on /verify.
 */

export const PASS_MARK = 0.75;

export const certificateCode = () => `C-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

export function createCertificateRouter(db: Db) {
  const r = express.Router();

  r.post(
    '/learn/certificate',
    rateLimit(20, 60 * 60 * 1000),
    wrap(async (req, res) => {
      const name = str(req.body?.name, 'name', { required: true, max: 80 });
      const seed = intOrNull(req.body?.seed, 'seed');
      if (seed === null) throw new HttpError(400, 'seed is required');
      const answers = req.body?.answers;
      if (!Array.isArray(answers)) throw new HttpError(400, 'answers must be an array');
      const quiz = await buildQuiz(db, seed);
      if (answers.length !== quiz.length) throw new HttpError(400, `Answer all ${quiz.length} questions`);
      const score = quiz.filter((q, i) => String(answers[i]) === String(q.answer)).length;
      if (score / quiz.length < PASS_MARK)
        return res.status(422).json({ error: `Score ${score}/${quiz.length}. A certificate needs ${Math.ceil(PASS_MARK * quiz.length)} correct answers; try again.`, score, total: quiz.length });
      const code = certificateCode();
      await db.run('INSERT INTO certificates (code, name, score, total, seed) VALUES (?, ?, ?, ?, ?)', code, name, score, quiz.length, seed);
      await audit(db, req, 'issue', 'certificate', code, { score, total: quiz.length });
      res.status(201).json(await db.get('SELECT code, name, score, total, issued_at FROM certificates WHERE code = ?', code));
    })
  );

  r.get(
    '/certificates/:code',
    rateLimit(120, 10 * 60 * 1000),
    wrap(async (req, res) => {
      const code = str(req.params.code, 'code', { required: true, max: 12 }).toUpperCase();
      if (!/^C-[0-9A-F]{8}$/.test(code)) throw new HttpError(400, 'A certificate code looks like C-1A2B3C4D');
      const row = await db.get('SELECT code, name, score, total, issued_at FROM certificates WHERE code = ?', code);
      if (!row) throw new HttpError(404, 'No certificate has this code');
      res.json(row);
    })
  );

  return r;
}
