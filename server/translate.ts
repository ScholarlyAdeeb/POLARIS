import type { Db } from './pg.ts';
import { NOW } from './pg.ts';
import { getItem, type ArchiveItem } from './db.ts';
import { ragConfig } from './rag/config.ts';
import { splitSentences } from './claims.ts';

/**
 * Hindi title and summary for every approved record, written to meta.hi:
 *   { title, summary, by, at, reviewed }
 * Made by an open translation model (Meta NLLB-200 distilled 600M, ONNX via transformers.js) that runs
 * on this machine; nothing is sent to a third party. Station and place names are put in Hindi first from
 * a fixed glossary, because the model otherwise translates them as words ("Bharati" -> "India"). Machine output is marked reviewed:false and shown
 * with a "machine translation" label until a reviewer corrects and confirms it.
 * Not available on Vercel (no local models there): run `npm run translate` against the same database.
 */

export const HI_MODEL = process.env.TRANSLATE_HI_MODEL || 'Xenova/nllb-200-distilled-600M';

/** Proper names the model must not translate, longest first so "Dakshin Gangotri" wins over shorter matches. */
export const GLOSSARY: [string, string][] = (
  [
    ['Dakshin Gangotri', 'दक्षिण गंगोत्री'],
    ['Bharati', 'भारती'],
    ['Maitri', 'मैत्री'],
    ['Himadri', 'हिमाद्रि'],
    ['Himansh', 'हिमांश'],
    ['IndARC', 'इंडआर्क'],
    ['Sagar Kanya', 'सागर कन्या'],
    ['Sagar Nidhi', 'सागर निधि'],
    ['Larsemann Hills', 'लार्समैन हिल्स'],
    ['Schirmacher Oasis', 'शिरमाकर ओएसिस'],
    ['Dronning Maud Land', 'ड्रोनिंग मॉड लैंड'],
    ['Ny-Ålesund', 'नी-ओलेसुंड'],
    ['Ny-Alesund', 'नी-ओलेसुंड'],
    ['Kongsfjorden', 'कोंग्सफ्योर्डन'],
    ['Svalbard', 'स्वालबार्ड'],
    ['Chandra Basin', 'चंद्रा बेसिन'],
    ['Lahaul', 'लाहौल'],
    ['Spiti', 'स्पीति'],
    ['Antarctica', 'अंटार्कटिका'],
    ['Antarctic', 'अंटार्कटिक'],
    ['Arctic', 'आर्कटिक'],
    ['Himalayas', 'हिमालय'],
    ['Himalaya', 'हिमालय'],
    ['Southern Ocean', 'दक्षिणी महासागर'],
    ['NCPOR', 'एनसीपीओआर'],
    ['MoES', 'पृथ्वी विज्ञान मंत्रालय'],
  ] as [string, string][]
).sort((a, b) => b[0].length - a[0].length);

export function applyGlossary(text: string): string {
  let out = text;
  for (const [en, hi] of GLOSSARY) out = out.replace(new RegExp(`(?<![\\p{L}])${en}(?![\\p{L}])`, 'gu'), hi);
  return out;
}

const MAX_SUMMARY = 500; // characters of English summary translated per record

let pipe: Promise<any> | null = null;
let queue: Promise<unknown> = Promise.resolve();

export const translationAvailable = () => !process.env.VERCEL && process.env.TRANSLATE !== 'off';

function translator() {
  pipe ??= import('@huggingface/transformers').then(async (m) => {
    const dir = ragConfig().modelDir;
    m.env.localModelPath = dir;
    m.env.cacheDir = dir;
    m.env.allowLocalModels = true;
    m.env.allowRemoteModels = true;
    return m.pipeline('translation', HI_MODEL, { dtype: 'q8' } as any);
  });
  return pipe;
}

/** Translates sentence by sentence (the model handles short inputs best); one request at a time. */
export function toHindi(text: string): Promise<string> {
  const run = async () => {
    const t = await translator();
    const out: string[] = [];
    for (const s of splitSentences(text)) {
      if (!/[A-Za-z]/.test(s)) {
        out.push(s);
        continue;
      }
      const [r] = await t(applyGlossary(s), { src_lang: 'eng_Latn', tgt_lang: 'hin_Deva', max_new_tokens: 256 });
      out.push(String(r.translation_text ?? '').trim());
    }
    return out.join(' ').replace(/\s+/g, ' ').trim();
  };
  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}

const clip = (s: string) => {
  if (s.length <= MAX_SUMMARY) return s;
  const cut = s.slice(0, MAX_SUMMARY);
  const stop = cut.lastIndexOf('. ');
  return stop > MAX_SUMMARY / 2 ? cut.slice(0, stop + 1) : cut;
};

/** Adds meta.hi to one record unless a translation (machine or reviewed) is already there. */
export async function translateRecord(db: Db, item: ArchiveItem, force = false): Promise<boolean> {
  if (!force && item.meta?.hi?.summary) return false;
  if (item.meta?.hi?.reviewed) return false; // never overwrite a reviewer's wording
  const summary = clip((item.summary || '').trim());
  const hi = {
    title: await toHindi(item.title),
    summary: summary ? await toHindi(summary) : '',
    by: HI_MODEL,
    at: new Date().toISOString(),
    reviewed: false,
  };
  if (!hi.summary && !hi.title) return false;
  const fresh = await getItem(item.id, db);
  if (!fresh) return false;
  await db.run(`UPDATE archive_items SET meta = ?, updated_at = ${NOW} WHERE id = ?`, JSON.stringify({ ...fresh.meta, hi }), item.id);
  return true;
}

/** Fire-and-forget after approval, on servers that can run the model. */
export function translateLater(db: Db, id: string) {
  if (!translationAvailable()) return;
  getItem(id, db)
    .then((item) => item && translateRecord(db, item))
    .catch((err) => console.warn('[HIMAKSHA] Hindi translation failed:', err.message));
}
