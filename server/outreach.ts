import type { ArchiveItem } from './db.ts';

export type Channel = 'website' | 'x' | 'linkedin' | 'instagram';
export const CHANNELS: Channel[] = ['website', 'x', 'linkedin', 'instagram'];

export interface GeneratedContent {
  channel: Channel;
  title?: string;
  slug?: string;
  metaDescription?: string;
  text: string;
  characters: number;
  limit?: number;
}

const X_LIMIT = 280;
const X_URL_LENGTH = 23; // X counts every link as 23 characters
const INSTAGRAM_HASHTAG_LIMIT = 30;

export const TYPE_LABEL: Record<string, string> = {
  expedition: 'Expedition',
  report: 'Expedition report',
  dataset: 'Open dataset',
  publication: 'New publication',
  photo: 'From the photo archive',
  video: 'Watch',
  activity: 'Update',
};

const TYPE_EMOJI: Record<string, string> = {
  expedition: '🧭',
  report: '📘',
  dataset: '📊',
  publication: '📄',
  photo: '📷',
  video: '🎬',
  activity: '📣',
};

const STATION_NAMES: Record<string, string> = {
  bharati: 'Bharati',
  maitri: 'Maitri',
  'dakshin-gangotri': 'Dakshin Gangotri',
  himadri: 'Himadri',
  himansh: 'Himansh',
  'sagar-kanya': 'Sagar Kanya',
};

const DOMAIN_TAGS: Record<string, string[]> = {
  ANTARCTICA: ['Antarctica'],
  ARCTIC: ['Arctic', 'Svalbard'],
  'HIMALAYAS / THIRD POLE': ['Himalaya', 'ThirdPole'],
  'SOUTHERN OCEAN': ['SouthernOcean', 'Oceanography'],
  'ATMOSPHERIC PHYSICS': ['AtmosphericScience'],
  'GLACIOLOGY & HYDROLOGY': ['Glaciology', 'Cryosphere'],
  'MICROBIOME & BIOPROSPECTING': ['PolarBiology', 'Microbiome'],
  OCEANOGRAPHY: ['Oceanography'],
};

function hashtagify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => (/^[A-Z0-9]+$/.test(w) && w.length <= 5 ? w : w[0].toUpperCase() + w.slice(1)))
    .join('');
}

export function hashtags(item: ArchiveItem, max = 8): string[] {
  const tags = ['NCPOR', 'PolarScience', 'MoES'];
  tags.push(...(DOMAIN_TAGS[item.domain] ?? [hashtagify(item.domain)]));
  if (item.stationId && STATION_NAMES[item.stationId]) tags.push(`${STATION_NAMES[item.stationId]}Station`);
  if (item.type === 'dataset') tags.push('OpenData');
  if (item.type === 'publication') tags.push('ScienceCommunication');
  for (const t of item.tags) {
    const h = hashtagify(t);
    if (h.length >= 3 && h.length <= 24 && !/^\d+$/.test(h)) tags.push(h);
  }
  const seen = new Set<string>();
  return tags
    .filter(Boolean)
    .filter((t) => (seen.has(t.toLowerCase()) ? false : (seen.add(t.toLowerCase()), true)))
    .slice(0, max)
    .map((t) => `#${t}`);
}

function sentence(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  if (lastStop > max * 0.5) return cut.slice(0, lastStop + 1);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:\s]+$/, '') + '…';
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function context(item: ArchiveItem): string {
  const bits: string[] = [];
  if (item.stationId && STATION_NAMES[item.stationId]) bits.push(`${STATION_NAMES[item.stationId]} station`);
  if (item.year) bits.push(String(item.year));
  return bits.join(', ');
}

function facts(item: ArchiveItem): string[] {
  const m = item.meta;
  const out: string[] = [];
  if (m.contributor?.name) out.push(`Shared on POLARIS by ${m.contributor.name}${m.contributor.institution ? `, ${m.contributor.institution}` : ''}`);
  if (m.authors) out.push(`Authors: ${m.authors}`);
  if (m.journal) out.push(`Journal: ${m.journal}`);
  if (m.format) out.push(`Format: ${m.format}${m.size ? ` (${m.size})` : ''}`);
  if (m.license) out.push(`Licence: ${m.license}`);
  if (m.leader) out.push(`Led by: ${m.leader}`);
  if (m.duration) out.push(`Duration: ${m.duration}`);
  if (Array.isArray(m.highlights)) out.push(...m.highlights.map((h: string) => `Highlight: ${h}`));
  if (item.doi) out.push(`DOI: https://doi.org/${item.doi}`);
  return out;
}

export function generateContent(item: ArchiveItem, link: string, channels: Channel[] = CHANNELS): GeneratedContent[] {
  const label = TYPE_LABEL[item.type] ?? 'Update';
  const emoji = TYPE_EMOJI[item.type] ?? '❄️';
  const ctx = context(item);
  const tags = hashtags(item);
  const sampleNote = item.meta.sample ? 'Note: this is a sample record in the POLARIS demo archive.' : '';
  const results: GeneratedContent[] = [];

  for (const channel of channels) {
    if (channel === 'website') {
      const metaDescription = sentence(item.summary || item.title, 155);
      const body = [
        `# ${item.title}`,
        '',
        `*${label}${ctx ? ` · ${ctx}` : ''} · ${item.domain}*`,
        '',
        item.summary,
        '',
        item.body ? item.body + '\n' : '',
        facts(item).length ? '## Key facts\n\n' + facts(item).map((f) => `- ${f}`).join('\n') + '\n' : '',
        `[View the full record on POLARIS](${link})`,
        '',
        sampleNote,
      ]
        .filter((l, i, a) => !(l === '' && a[i - 1] === ''))
        .join('\n')
        .trim();
      results.push({ channel, title: item.title, slug: slugify(item.title), metaDescription, text: body, characters: body.length });
    }

    if (channel === 'x') {
      const head = `${emoji} ${label}: ${item.title}`;
      const tagLine = tags.slice(0, 3).join(' ');
      // Budget: head + blank + summary + blank + link + space + tags
      const fixed = X_URL_LENGTH + tagLine.length + 4;
      let headPart = head;
      if (headPart.length > X_LIMIT - fixed) headPart = sentence(head, X_LIMIT - fixed);
      const room = X_LIMIT - fixed - headPart.length - 2;
      const summary = room > 40 ? sentence(item.summary, room) : '';
      const text = [headPart, summary, `${link} ${tagLine}`].filter(Boolean).join('\n\n');
      const counted = text.length - link.length + X_URL_LENGTH;
      results.push({ channel, text, characters: counted, limit: X_LIMIT });
    }

    if (channel === 'linkedin') {
      const text = [
        item.meta.contributor?.name
          ? `${emoji} ${label} shared on POLARIS by ${item.meta.contributor.name}${item.meta.contributor.institution ? `, ${item.meta.contributor.institution}` : ''}`
          : `${emoji} ${label} from the National Centre for Polar and Ocean Research (NCPOR)`,
        '',
        item.title,
        '',
        sentence(item.summary, 600),
        facts(item).length ? '\n' + facts(item).slice(0, 4).map((f) => `• ${f}`).join('\n') : '',
        '',
        `Explore the record, linked datasets and publications on POLARIS: ${link}`,
        sampleNote ? `\n${sampleNote}` : '',
        '',
        tags.join(' '),
      ]
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      results.push({ channel, text, characters: text.length, limit: 3000 });
    }

    if (channel === 'instagram') {
      const text = [
        `${emoji} ${item.title}`,
        '',
        sentence(item.summary, 300),
        ctx ? `\n📍 ${ctx}` : '',
        item.meta.contributor?.name ? `📸 Shared on POLARIS by ${item.meta.contributor.name}${item.meta.contributor.institution ? `, ${item.meta.contributor.institution}` : ''}` : '',
        '',
        'Link in bio → POLARIS knowledge portal',
        sampleNote ? `\n${sampleNote}` : '',
        '',
        '.',
        hashtags(item, INSTAGRAM_HASHTAG_LIMIT).join(' '),
      ]
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      results.push({ channel, text, characters: text.length, limit: 2200 });
    }
  }
  return results;
}
