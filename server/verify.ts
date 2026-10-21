import express from 'express';
import crypto from 'crypto';
import type { Db } from './pg.ts';
import { HttpError, rateLimit, str, wrap } from './http.ts';

/**
 * Public verification of outreach posts. Every post has a short code derived from its id and exact text;
 * the newsroom shows it with a QR code. Anyone holding a copy (a screenshot, a forwarded post) can check
 * whether it is a genuine published HIMAKSHA post, and paste the text to see whether it was altered.
 * Editing a post sends it back to review, so a published code always belongs to the approved wording.
 */

/** Whitespace-insensitive form of a post, so line wrapping or copy/paste spacing does not matter. */
export const normalizePost = (text: string) => text.replace(/\s+/g, ' ').trim();

export function verificationCode(post: { id: number | string; content: string }): string {
  return crypto.createHash('sha256').update(`${post.id}|${normalizePost(post.content)}`).digest('hex').slice(0, 8).toUpperCase();
}

export type VerifyStatus = 'genuine' | 'altered' | 'not_published' | 'no_match';

export function createVerifyRouter(db: Db) {
  const r = express.Router();
  r.get(
    '/verify/:code',
    rateLimit(120, 10 * 60 * 1000),
    wrap(async (req, res) => {
      const code = str(req.params.code, 'code', { required: true, max: 16 }).toUpperCase();
      if (!/^[0-9A-F]{8}$/.test(code)) throw new HttpError(400, 'A verification code is 8 characters, 0-9 and A-F');
      const text = str(req.query.text, 'text', { max: 20000 });
      const rows = await db.all(
        `SELECT p.id, p.item_id, p.channel, p.content, p.status, p.review_status, p.reviewer, p.reviewed_at, p.published_at,
                a.title AS item_title, a.review_status AS item_review_status,
                u.id AS author_id, u.name AS author_name, u.institution AS author_institution
         FROM outreach_posts p JOIN archive_items a ON a.id = p.item_id
         LEFT JOIN users u ON u.id = COALESCE(p.created_by, a.owner_id)`
      );
      const post = rows.find((p) => verificationCode(p) === code);
      if (!post) return res.json({ status: 'no_match' satisfies VerifyStatus, code });
      const published = post.status === 'PUBLISHED' && post.item_review_status === 'APPROVED';
      if (!published) return res.json({ status: 'not_published' satisfies VerifyStatus, code });
      const status: VerifyStatus = text && normalizePost(text) !== normalizePost(post.content) ? 'altered' : 'genuine';
      res.json({
        status,
        code,
        post: {
          id: post.id,
          channel: post.channel,
          content: post.content,
          itemId: post.item_id,
          itemTitle: post.item_title,
          author: post.author_id ? { id: post.author_id, name: post.author_name, institution: post.author_institution } : null,
          reviewer: post.reviewer,
          reviewedAt: post.reviewed_at,
          publishedAt: post.published_at,
        },
      });
    })
  );
  return r;
}
