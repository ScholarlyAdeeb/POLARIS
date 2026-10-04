import type { ArchiveItem } from './db.ts';
import { TYPE_LABEL } from './outreach.ts';

/**
 * Sentence-level fact check for outreach posts: every sentence is compared with the source
 * record (shared words and exact numbers). Deterministic and rule-based.
 */

export interface Source {
  ref: string; // "S1"
  id: string;
  type: string;
  title: string;
  dataStatus: string;
  year: number | null;
  stationId: string | null;
  text: string;
}

export type ClaimStatus = 'supported' | 'partial' | 'unsupported' | 'no_claim';

export interface ClaimCheck {
  sentence: string;
  status: ClaimStatus;
  citations: string[];
  overlap: number;
  missingNumbers: string[];
}

export interface Verification {
  claims: ClaimCheck[];
  supported: number;
  partial: number;
  unsupported: number;
  checked: number;
  nonAuthoritativeSources: string[];
}

const STOP = new Set(
  ('the and for are was were with from that this these those into onto over under about above below than then there their they ' +
    'them its it’s has have had been being which who whom what when where why how also such can could may might will would shall ' +
    'should very more most less least other others some any each both only just not nor but our your you his her she him per via ' +
    'using used use between within across along among during after before while been one two three all out off').split(' ')
);

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/\[s\d+\]/gi, ' ')
    .split(/[^\p{L}\p{N}.]+/u)
    .map((w) => w.replace(/\.+$/, ''))
    .filter((w) => w.length >= 3 && !STOP.has(w));

const numbersIn = (s: string) => (s.replace(/\[S\d+\]/gi, '').match(/\d+(?:[.,]\d+)*/g) ?? []).filter((n) => n.length >= 2 || /\./.test(n));

export function splitSentences(text: string): string[] {
  return text
    .replace(/\r/g, '')
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9“"(])/)
    .map((s) => s.replace(/^[\s*•\-–\d.)]+(?=\S)/, (m) => (/^\d+\.\d/.test(m) ? m : '')).trim())
    .filter((s) => s.length > 1);
}

/** Links, hashtag lines and "explore it on POLARIS" calls to action are navigation, not factual claims. */
const NAVIGATION = /^(explore|view|read|watch|see|visit|learn more|find out more|link in bio|download)\b.*(https?:\/\/|polaris)/i;
const stripNonClaims = (s: string) => s.replace(/https?:\/\/\S+/g, ' ').replace(/(^|\s)#[\p{L}\p{N}_]+/gu, ' ');

export function verifyClaims(text: string, sources: Source[]): Verification {
  const byRef = new Map(sources.map((s) => [s.ref.toUpperCase(), s]));
  const claims: ClaimCheck[] = splitSentences(text).map((sentence) => {
    const citations = [...new Set((sentence.match(/\[S\d+\]/gi) ?? []).map((c) => c.slice(1, -1).toUpperCase()))];
    if (NAVIGATION.test(sentence.replace(/^[^\p{L}]+/u, ''))) return { sentence, status: 'no_claim', citations, overlap: 1, missingNumbers: [] };
    const evidence = (citations.length ? citations.map((c) => byRef.get(c)).filter(Boolean) : sources) as Source[];
    const ev = evidence.map((s) => s.text).join(' ');
    const evWords = new Set(words(ev));
    const claimText = stripNonClaims(sentence);
    const sw = [...new Set(words(claimText))];
    const missingNumbers = numbersIn(claimText).filter((n) => !ev.includes(n));
    if (sw.length < 3 && !missingNumbers.length) return { sentence, status: 'no_claim', citations, overlap: 1, missingNumbers };
    const hit = sw.filter((w) => evWords.has(w)).length;
    const overlap = sw.length ? hit / sw.length : 0;
    let status: ClaimStatus = overlap >= 0.6 ? 'supported' : overlap >= 0.35 ? 'partial' : 'unsupported';
    if (missingNumbers.length) status = 'unsupported';
    if (citations.length && citations.some((c) => !byRef.has(c))) status = 'unsupported';
    return { sentence, status, citations, overlap: Number(overlap.toFixed(2)), missingNumbers };
  });
  const count = (s: ClaimStatus) => claims.filter((c) => c.status === s).length;
  return {
    claims,
    supported: count('supported'),
    partial: count('partial'),
    unsupported: count('unsupported'),
    checked: claims.filter((c) => c.status !== 'no_claim').length,
    nonAuthoritativeSources: sources.filter((s) => !['OFFICIAL', 'VERIFIED'].includes(s.dataStatus)).map((s) => s.ref),
  };
}

/**
 * Adds a citation to every factual sentence that has none: the source sharing the most words with it
 * (at least 40%). Small models often forget to cite; this makes every claim checkable against a record.
 */
export function attachCitations(text: string, sources: Source[]): string {
  const vocab = sources.map((s) => ({ ref: s.ref, words: new Set(words(s.text)) }));
  return splitSentences(text)
    .map((sentence) => {
      if (/\[S\d+\]/i.test(sentence)) return sentence;
      const sw = [...new Set(words(stripNonClaims(sentence)))];
      if (sw.length < 3) return sentence;
      let best: { ref: string; score: number } | null = null;
      for (const v of vocab) {
        const score = sw.filter((w) => v.words.has(w)).length / sw.length;
        if (!best || score > best.score) best = { ref: v.ref, score };
      }
      if (!best || best.score < 0.4) return sentence;
      return sentence.replace(/([.!?]*)$/, ` [${best.ref}]$1`);
    })
    .join(' ');
}

export function toSource(item: ArchiveItem, i: number): Source {
  const c = item.meta?.contributor;
  const credit = c?.name ? `Shared on POLARIS by ${c.name}${c.institution ? `, ${c.institution}` : ''}.` : '';
  // The record's own catalogue fields count as evidence too (type, station, year, region).
  const where = item.stationId ? ` at ${item.stationId.replace(/-/g, ' ')} station` : '';
  const catalogue = `${TYPE_LABEL[item.type] ?? item.type}: ${item.type} record in the POLARIS archive${where}${item.year ? `, ${item.year}` : ''}${item.domain ? `, ${item.domain}` : ''}.`;
  const text =
    [item.title, item.summary, item.body].filter(Boolean).join('. ').replace(/\s+/g, ' ').slice(0, 1600) + ` ${catalogue}` + (credit ? ` ${credit}` : '');
  return {
    ref: `S${i + 1}`,
    id: item.id,
    type: item.type,
    title: item.title,
    dataStatus: item.dataStatus,
    year: item.year,
    stationId: item.stationId,
    text,
  };
}
