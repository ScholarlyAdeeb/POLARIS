/**
 * Refreshes server/data/open-data.json from open registries:
 *   - Crossref: journal articles with an author affiliated to NCPOR (or its former name NCAOR),
 *     filtered to polar / cryosphere topics. Metadata only (Crossref metadata is CC0); no abstracts.
 *   - PANGAEA: datasets that mention Indian polar stations or NCPOR/NCAOR, with DOI, licence and position.
 * The server loads the snapshot on start (server/openData.ts), so the app works offline.
 *
 *   npx tsx scripts/import-open-data.ts
 */
import fs from 'fs';
import path from 'path';

const UA = { 'User-Agent': 'POLARIS-SIH-prototype/1.0 (https://github.com/ScholarlyAdeeb/POLARIS)' };
const OUT = path.resolve('server', 'data', 'open-data.json');

const POLAR = /antarc|arctic|himalay|southern ocean|svalbard|glacier|sea[- ]ice|ice shelf|ice core|polar|snow|permafrost|cryo|maitri|bharati|himadri|himansh|kongsfjord|larsemann|schirmacher|ny[- ]?[aå]lesund|spitsbergen|chandra basin/i;
const AFFIL = /polar and ocean research|antarctic and ocean research/i;

async function getJson(url: string): Promise<any> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30_000) });
    if (res.ok) return res.json();
    if (res.status !== 429 && res.status < 500) throw new Error(`${res.status} ${url}`);
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  throw new Error(`gave up on ${url}`);
}

const clean = (s: string) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function crossref() {
  const out = new Map<string, any>();
  for (const name of ['National Centre for Polar and Ocean Research', 'National Centre for Antarctic and Ocean Research']) {
    for (let offset = 0; offset < 600; offset += 200) {
      const url =
        `https://api.crossref.org/works?query.affiliation=${encodeURIComponent(`"${name}"`)}` +
        `&filter=type:journal-article,from-pub-date:2012-01-01&rows=200&offset=${offset}` +
        '&select=DOI,title,published,container-title,author,subject,volume,page';
      const items = (await getJson(url)).message.items as any[];
      for (const w of items) {
        const title = clean(w.title?.[0] ?? '');
        const affiliated = (w.author ?? []).some((a: any) => (a.affiliation ?? []).some((f: any) => AFFIL.test(f.name ?? '')));
        if (!title || !affiliated || !POLAR.test(title) || out.has(w.DOI.toLowerCase())) continue;
        out.set(w.DOI.toLowerCase(), {
          source: 'crossref',
          doi: w.DOI.toLowerCase(),
          title,
          year: w.published?.['date-parts']?.[0]?.[0] ?? null,
          journal: clean(w['container-title']?.[0] ?? ''),
          authors: (w.author ?? []).map((a: any) => [a.given, a.family].filter(Boolean).join(' ')).filter(Boolean),
          ncporAuthors: (w.author ?? [])
            .filter((a: any) => (a.affiliation ?? []).some((f: any) => AFFIL.test(f.name ?? '')))
            .map((a: any) => [a.given, a.family].filter(Boolean).join(' ')),
          subjects: w.subject ?? [],
        });
      }
      if (items.length < 200) break;
    }
  }
  return [...out.values()].sort((a, b) => (b.year ?? 0) - (a.year ?? 0)).slice(0, 80);
}

async function pangaea() {
  const queries = ['Maitri', 'Bharati', 'Larsemann Hills', 'Schirmacher', 'Himadri', 'NCAOR', '"Polar and Ocean Research"', '"Indian Antarctic"'];
  const ids = new Map<string, { lat: number; lon: number } | null>();
  for (const q of queries) {
    const d = await getJson(`https://ws.pangaea.de/es/pangaea/panmd/_search?q=${encodeURIComponent(q)}&size=12`);
    for (const h of d.hits.hits as any[]) {
      if (h._source?.['sp-hidden']) continue;
      const uri: string = h._source?.URI ?? '';
      if (!uri.includes('PANGAEA.')) continue;
      if (!ids.has(uri)) ids.set(uri, h._source?.meanPosition ?? null);
    }
  }
  const out: any[] = [];
  for (const [uri, pos] of [...ids.entries()].slice(0, 60)) {
    const doi = uri.replace('https://doi.org/', '').toLowerCase();
    try {
      const j = await getJson(`https://doi.pangaea.de/${doi.replace('10.1594/', '10.1594/')}?format=metadata_jsonld`);
      const creators = (Array.isArray(j.creator) ? j.creator : [j.creator]).filter(Boolean).map((c: any) => c.name).filter(Boolean);
      out.push({
        source: 'pangaea',
        doi,
        title: clean(j.name ?? ''),
        year: Number(String(j.datePublished ?? '').slice(0, 4)) || null,
        authors: creators,
        license: j.license ?? null,
        temporalCoverage: j.temporalCoverage ?? null,
        location: pos && Number.isFinite(pos.lat) ? { lat: Number(pos.lat.toFixed(4)), lon: Number(pos.lon.toFixed(4)) } : null,
        keywords: (Array.isArray(j.keywords) ? j.keywords : String(j.keywords ?? '').split(',')).map((k: any) => String(k).trim()).filter(Boolean).slice(0, 12),
      });
    } catch (e) {
      console.warn('skip', uri, (e as Error).message);
    }
  }
  // Keep polar / Himalayan datasets only (searches also match unrelated cruises that share a keyword).
  const polarPlace = (l: { lat: number; lon: number } | null) =>
    !!l && (l.lat <= -40 || l.lat >= 60 || (l.lat >= 26 && l.lat <= 40 && l.lon >= 70 && l.lon <= 100));
  return out.filter((d) => d.title && (polarPlace(d.location) || POLAR.test(d.title)));
}

const [papers, datasets] = await Promise.all([crossref(), pangaea()]);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      retrievedAt: new Date().toISOString(),
      sources: {
        crossref: 'https://api.crossref.org (metadata released under CC0)',
        pangaea: 'https://www.pangaea.de (dataset metadata; each dataset carries its own licence)',
      },
      papers,
      datasets,
    },
    null,
    1
  ) + '\n'
);
console.log(`Wrote ${papers.length} publications and ${datasets.length} datasets to ${OUT}`);
