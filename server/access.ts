import type { ArchiveItem } from './db.ts';
import { isReviewer, type SessionUser } from './auth.ts';
import { HttpError } from './http.ts';

/**
 * Access levels for a record's file. The catalogue entry (title, summary, station, links) is always
 * public once approved; only the file itself is held back:
 *  - open: anyone can download;
 *  - restricted: on request to NCPOR (sensitive locations, unpublished data, third-party rights);
 *  - embargoed: opens automatically on `until` (e.g. pending publication).
 * Owners and reviewers always see the file.
 */

export type AccessLevel = 'open' | 'restricted' | 'embargoed';
export const ACCESS_LEVELS: AccessLevel[] = ['open', 'restricted', 'embargoed'];

export interface Access {
  level: AccessLevel;
  until: string | null;
  reason: string | null;
  /** True while the file is held back from the public. */
  held: boolean;
}

export function accessOf(item: Pick<ArchiveItem, 'meta'>, now = new Date()): Access {
  const a = item.meta?.access ?? {};
  const level: AccessLevel = ACCESS_LEVELS.includes(a.level) ? a.level : 'open';
  const until = level === 'embargoed' && typeof a.until === 'string' ? a.until : null;
  const held = level === 'restricted' || (level === 'embargoed' && (!until || new Date(until) > now));
  return { level, until, reason: typeof a.reason === 'string' ? a.reason : null, held };
}

/** Validates an access setting from a request body; returns the value to store in meta.access. */
export function readAccess(v: unknown): { level: AccessLevel; until?: string; reason?: string } {
  if (typeof v !== 'object' || v === null) throw new HttpError(400, 'access must be an object');
  const { level, until, reason } = v as Record<string, unknown>;
  if (!ACCESS_LEVELS.includes(level as AccessLevel)) throw new HttpError(400, `access.level must be one of: ${ACCESS_LEVELS.join(', ')}`);
  const out: { level: AccessLevel; until?: string; reason?: string } = { level: level as AccessLevel };
  if (level === 'embargoed') {
    if (typeof until !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(until) || isNaN(Date.parse(until))) throw new HttpError(400, 'An embargo needs access.until as YYYY-MM-DD');
    out.until = until;
  }
  if (typeof reason === 'string' && reason.trim()) out.reason = reason.trim().slice(0, 300);
  return out;
}

const canSeeFile = (item: ArchiveItem, user?: SessionUser) => isReviewer(user) || (!!user && item.ownerId === user.id);

/** The record as this caller may see it: held files lose their links (the thumbnail too, when it is the file). */
export function redact<T extends ArchiveItem>(item: T, user?: SessionUser): T & { access: Access } {
  const access = accessOf(item);
  if (!access.held || canSeeFile(item, user)) return { ...item, access };
  const thumbIsFile = !!item.thumbnailUrl && item.thumbnailUrl === item.url;
  return { ...item, url: null, thumbnailUrl: thumbIsFile ? null : item.thumbnailUrl, access };
}

/** Throws 403 with the public notice when the caller may not download this record's file. */
export function assertMayDownload(item: ArchiveItem, user?: SessionUser) {
  const access = accessOf(item);
  if (!access.held || canSeeFile(item, user)) return;
  throw new HttpError(
    403,
    access.level === 'embargoed'
      ? `This file is under embargo until ${access.until}. The catalogue entry stays public.`
      : 'This file is restricted. Request access from NCPOR (Data Management, ncpor.res.in) quoting the record id.'
  );
}
