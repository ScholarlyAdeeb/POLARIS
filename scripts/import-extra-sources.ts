/**
 * Adds three more open sources to server/data/open-data.json (run after import-open-data.ts):
 *   - NSIDC Sea Ice Index v4 (G02135): monthly sea-ice extent and area, Arctic and Antarctic, 1979 to now.
 *     Public domain (NOAA/NSIDC); cite Fetterer et al., doi:10.7265/a98x-0f50.
 *   - OpenAlex: open-access works with an author at NCPOR (institution I106814784) on polar topics, with the
 *     link to the free full text. Metadata only (OpenAlex is CC0); abstracts are not copied.
 *   - Wikimedia Commons: photographs of Indian polar stations and expeditions, each with its own licence
 *     and author, hot-linked from upload.wikimedia.org (nothing is re-hosted).
 *
 *   npx tsx scripts/import-extra-sources.ts
 */
import fs from 'fs';
import path from 'path';

const UA = { 'User-Agent': 'HIMAKSHA-SIH-prototype/1.0 (https://github.com/ScholarlyAdeeb/POLARIS)' };
const OUT = path.resolve('server', 'data', 'open-data.json');
const POLAR = /antarc|arctic|himalay|southern ocean|svalbard|glacier|sea[- ]ice|ice shelf|ice core|polar|snow|permafrost|cryo|maitri|bharati|himadri|himansh|kongsfjord|larsemann|schirmacher|ny[- ]?[aå]lesund|spitsbergen|chandra basin/i;

async function get(url: string, kind: 'json' | 'text' = 'json'): Promise<any> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30_000) });
    if (res.ok) return kind === 'json' ? res.json() : res.text();
    if (res.status !== 429 && res.status < 500) throw new Error(`${res.status} ${url}`);
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  throw new Error(`gave up on ${url}`);
}

const clean = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function seaIce() {
  const out: Record<'north' | 'south', { year: number; month: number; extent: number; area: number }[]> = { north: [], south: [] };
  for (const hemi of ['north', 'south'] as const) {
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, '0');
      const csv: string = await get(`https://noaadata.apps.nsidc.org/NOAA/G02135/${hemi}/monthly/data/${hemi[0].toUpperCase()}_${mm}_extent_v4.0.csv`, 'text');
      for (const line of csv.split('\n').slice(1)) {
        const [y, mo, , , extent, area] = line.split(',').map((s) => s.trim());
        const e = Number(extent);
        const a = Number(area);
        // -9999 marks missing months (e.g. the 1987-88 satellite gap).
        if (y && e > 0 && a > 0) out[hemi].push({ year: Number(y), month: Number(mo), extent: e, area: a });
      }
    }
    out[hemi].sort((a, b) => a.year - b.year || a.month - b.month);
  }
  return out;
}

async function openAlex(knownDois: Set<string>) {
  const out: any[] = [];
  for (let page = 1; page <= 4 && out.length < 60; page++) {
    const d = await get(
      'https://api.openalex.org/works?filter=authorships.institutions.id:I106814784,open_access.is_oa:true,type:article' +
        `&sort=cited_by_count:desc&per-page=100&page=${page}` +
        '&select=id,doi,title,publication_year,primary_location,best_oa_location,authorships,cited_by_count,primary_topic,open_access'
    );
    for (const w of d.results as any[]) {
      const doi = String(w.doi ?? '').replace('https://doi.org/', '').toLowerCase();
      const title = clean(w.title ?? '');
      if (!title || !doi || knownDois.has(doi) || !POLAR.test(`${title} ${w.primary_topic?.display_name ?? ''}`)) continue;
      knownDois.add(doi);
      const oa = w.best_oa_location ?? {};
      out.push({
        source: 'openalex',
        openalexId: String(w.id).split('/').pop(),
        doi,
        title,
        year: w.publication_year ?? null,
        journal: w.primary_location?.source?.display_name ?? '',
        authors: (w.authorships ?? []).map((a: any) => a.author?.display_name).filter(Boolean),
        ncporAuthors: (w.authorships ?? [])
          .filter((a: any) => (a.institutions ?? []).some((i: any) => String(i.id).endsWith('I106814784')))
          .map((a: any) => a.author?.display_name)
          .filter(Boolean),
        oaUrl: oa.pdf_url || oa.landing_page_url || w.open_access?.oa_url || null,
        license: oa.license ?? null,
        citedBy: w.cited_by_count ?? 0,
        topic: w.primary_topic?.display_name ?? null,
      });
      if (out.length >= 60) break;
    }
    if (d.results.length < 100) break;
  }
  return out;
}

const COMMONS_CATEGORIES: [string, string | null][] = [
  ['Category:Maitri Station', 'maitri'],
  ['Category:Bharati Station', 'bharati'],
  ['Category:Dakshin Gangotri', 'dakshin-gangotri'],
  ['Category:Indian expeditions to Antarctica', null],
  ['Category:Himadri (research station)', 'himadri'],
];

async function commons() {
  const out: any[] = [];
  const seen = new Set<number>();
  for (const [cat, station] of COMMONS_CATEGORIES) {
    const d = await get(
      'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=categorymembers&gcmtype=file&gcmlimit=20' +
        `&gcmtitle=${encodeURIComponent(cat)}&prop=imageinfo&iiprop=url|extmetadata|mime&iiurlwidth=1000`
    ).catch(() => null);
    for (const p of Object.values<any>(d?.query?.pages ?? {})) {
      const ii = p.imageinfo?.[0];
      if (!ii || seen.has(p.pageid) || !/^image\/(jpeg|png|webp)$/.test(ii.mime)) continue;
      const m = ii.extmetadata ?? {};
      const v = (k: string) => clean(String(m[k]?.value ?? ''));
      const licence = v('LicenseShortName');
      if (!licence) continue;
      seen.add(p.pageid);
      const date = v('DateTimeOriginal').match(/\d{4}(-\d{2}-\d{2})?/)?.[0] ?? null;
      out.push({
        source: 'commons',
        pageid: p.pageid,
        title: p.title.replace(/^File:/, '').replace(/\.(jpe?g|png|webp)$/i, '').replace(/[_]+/g, ' '),
        description: v('ImageDescription').slice(0, 600),
        author: v('Artist').slice(0, 200),
        licence,
        licenceUrl: v('LicenseUrl') || null,
        date,
        lat: Number(v('GPSLatitude')) || null,
        lon: Number(v('GPSLongitude')) || null,
        image: ii.thumburl || ii.url,
        page: ii.descriptionurl,
        category: cat.replace('Category:', ''),
        station,
      });
    }
  }
  return out;
}

const snap = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const known = new Set<string>((snap.papers ?? []).map((p: any) => String(p.doi).toLowerCase()));
const [ice, oa, photos] = await Promise.all([seaIce(), openAlex(known), commons()]);
snap.extraRetrievedAt = new Date().toISOString();
snap.sources = {
  ...snap.sources,
  nsidc: 'NSIDC Sea Ice Index v4, G02135 (NOAA/NSIDC, public domain), doi:10.7265/a98x-0f50',
  openalex: 'https://openalex.org (metadata released under CC0)',
  commons: 'https://commons.wikimedia.org (each file under its own free licence)',
};
snap.seaIce = ice;
snap.openAlex = oa;
snap.commons = photos;
fs.writeFileSync(OUT, JSON.stringify(snap, null, 1) + '\n');
console.log(`Sea ice: ${ice.north.length} Arctic + ${ice.south.length} Antarctic months; OpenAlex: ${oa.length} works; Commons: ${photos.length} photos`);
