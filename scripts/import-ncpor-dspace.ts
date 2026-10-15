// Harvests article metadata from NCPOR's DSpace repository ("DSPACE AT NCAOR") over OAI-PMH and stores it
// in server/data/open-data.json under `ncporReports`. Each record is a paper in the Scientific Report of an
// Indian Expedition to Antarctica, linked to its NCPOR handle page. Metadata only: NCPOR's site states
// "All Rights Reserved", so POLARIS links to the report instead of copying it.
//
//   npm run import:ncpor         (polite: one request at a time, a pause between pages)
import fs from 'fs';
import path from 'path';

const BASE = process.env.NCPOR_DSPACE || 'http://14.139.119.23:8080';
const OAI = `${BASE}/dspace-oai/request`;
const SNAPSHOT = path.resolve(process.cwd(), 'server', 'data', 'open-data.json');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string, tries = 4): Promise<string> {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'POLARIS-SIH26063-harvester (metadata only)' }, signal: AbortSignal.timeout(120_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (i >= tries) throw err;
      await sleep(3000 * i);
    }
  }
}

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
const all = (xml: string, tag: string) => [...xml.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))].map((m) => decode(m[1])).filter(Boolean);
const clean = (s: string) => decode(s.replace(/<[^>]+>/g, ' '));

/** collection handle -> { expedition report title, expedition number, section name } from the community list page. */
async function collectionMap() {
  const html = await get(`${BASE}/dspace/community-list`);
  const events = [
    ...[...html.matchAll(/<strong><A HREF="\/dspace\/handle\/([\d/]+)">([\s\S]*?)<\/A><\/strong>/gi)].map((m) => ({ at: m.index!, kind: 'community', handle: m[1], name: clean(m[2]) })),
    ...[...html.matchAll(/class="collectionListItem">\s*<A HREF="\/dspace\/handle\/([\d/]+)">([\s\S]*?)<\/A>/gi)].map((m) => ({ at: m.index!, kind: 'collection', handle: m[1], name: clean(m[2]) })),
  ].sort((a, b) => a.at - b.at);
  const map = new Map<string, { report: string; expedition: number | null; section: string }>();
  let community = '';
  for (const e of events) {
    if (e.kind === 'community') community = e.name;
    else {
      const num = community.match(/^(\d+)\]/);
      map.set(`hdl_${e.handle.replace('/', '_')}`, {
        report: community.replace(/^\d+\]\s*/, '').replace(/\s*-\s*Not Published$/i, ''),
        expedition: num ? Number(num[1]) : null,
        section: e.name.replace(/^\d+\]\s*/, ''),
      });
    }
  }
  return map;
}

async function main() {
  console.log(`Harvesting ${OAI}`);
  const sets = await collectionMap();
  console.log(`  ${sets.size} collections across the expedition reports`);
  const reports: any[] = [];
  let url = `${OAI}?verb=ListRecords&metadataPrefix=oai_dc`;
  let page = 0;
  while (url) {
    const xml = await get(url);
    page++;
    for (const rec of xml.match(/<record>[\s\S]*?<\/record>/g) ?? []) {
      if (/<header status="deleted"/.test(rec)) continue;
      const oaiId = all(rec, 'identifier')[0] ?? '';
      const handle = oaiId.split(':').pop() ?? '';
      const set = all(rec, 'setSpec').map((s) => sets.get(s)).find(Boolean);
      const title = all(rec, 'dc:title')[0];
      if (!title || !handle) continue;
      const links = all(rec, 'dc:identifier').filter((u) => /^https?:/.test(u));
      const issued = all(rec, 'dc:date').map((d) => d.match(/^(\d{4})/)?.[1]).filter(Boolean).map(Number);
      reports.push({
        source: 'ncpor-dspace',
        handle,
        title,
        authors: all(rec, 'dc:creator').slice(0, 20),
        subjects: all(rec, 'dc:subject').slice(0, 8),
        description: all(rec, 'dc:description').join(' ').slice(0, 1200),
        year: issued.length ? Math.min(...issued) : null,
        report: set?.report ?? null,
        expedition: set?.expedition ?? null,
        section: set?.section ?? null,
        url: links.find((u) => u.includes('/handle/')) ?? `${BASE}/dspace/handle/${handle}`,
      });
    }
    const token = xml.match(/<resumptionToken[^>]*>([^<]+)<\/resumptionToken>/)?.[1];
    process.stdout.write(`\r  page ${page}: ${reports.length} records`);
    url = token ? `${OAI}?verb=ListRecords&resumptionToken=${encodeURIComponent(token)}` : '';
    if (url) await sleep(1500);
  }
  console.log();
  const snap = fs.existsSync(SNAPSHOT) ? JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')) : {};
  snap.sources = { ...(snap.sources ?? {}), ncpor: `${OAI} (NCPOR DSpace, OAI-PMH; metadata only, articles stay on NCPOR's site)` };
  snap.ncporRetrievedAt = new Date().toISOString();
  snap.ncporReports = reports;
  fs.writeFileSync(SNAPSHOT, JSON.stringify(snap, null, 1));
  const byExp = new Map<number | null, number>();
  for (const r of reports) byExp.set(r.expedition, (byExp.get(r.expedition) ?? 0) + 1);
  console.log(`Wrote ${reports.length} NCPOR records from ${byExp.size} expedition reports to ${path.relative(process.cwd(), SNAPSHOT)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
