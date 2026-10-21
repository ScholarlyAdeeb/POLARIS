import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accessOf, assertMayDownload, readAccess, redact } from '../server/access.ts';
import { explainLink } from '../server/trace.ts';
import { generateContent } from '../server/outreach.ts';
import { applyGlossary } from '../server/translate.ts';
import type { ArchiveItem } from '../server/db.ts';
import type { SessionUser } from '../server/auth.ts';

const item = (over: Partial<ArchiveItem> = {}): ArchiveItem => ({
  id: 'USR-DATA-1',
  type: 'dataset',
  title: 'Aerosol optical depth, Bharati 2023',
  summary: 'Sun photometer readings over one summer.',
  body: '',
  domain: 'ANTARCTICA',
  stationId: 'bharati',
  year: 2023,
  date: null,
  tags: ['aerosol', 'photometer'],
  url: '/uploads/aod.csv',
  thumbnailUrl: null,
  doi: null,
  meta: {},
  downloads: 0,
  dataStatus: 'UNVERIFIED',
  provenance: {},
  reviewStatus: 'APPROVED',
  reviewNote: null,
  ownerId: 9,
  createdAt: '',
  updatedAt: '',
  ...over,
});
const person = (id: number, role: SessionUser['role'] = 'contributor'): SessionUser => ({ id, email: `u${id}@x.in`, name: `u${id}`, institution: '', role });

test('open records keep their file; restricted ones hide it from the public only', () => {
  assert.equal(redact(item()).url, '/uploads/aod.csv');
  const r = item({ meta: { access: { level: 'restricted' } } });
  assert.equal(redact(r).url, null);
  assert.equal(redact(r, person(1)).url, null);
  assert.equal(redact(r, person(9)).url, '/uploads/aod.csv'); // owner
  assert.equal(redact(r, person(2, 'reviewer')).url, '/uploads/aod.csv');
  assert.throws(() => assertMayDownload(r), /restricted/);
  assert.doesNotThrow(() => assertMayDownload(r, person(9)));
});

test('an embargo lifts on its date', () => {
  const e = item({ meta: { access: { level: 'embargoed', until: '2030-01-01' } } });
  assert.equal(accessOf(e, new Date('2029-12-31')).held, true);
  assert.equal(accessOf(e, new Date('2030-01-02')).held, false);
  assert.throws(() => readAccess({ level: 'embargoed' }), /YYYY-MM-DD/);
  assert.throws(() => readAccess({ level: 'secret' }), /access.level/);
  assert.deepEqual(readAccess({ level: 'restricted', reason: ' sensitive site ' }), { level: 'restricted', reason: 'sensitive site' });
});

test('a link is explained from shared station, years, keywords and who linked it', () => {
  const pub = item({ id: 'P1', type: 'publication', title: 'Aerosols at Bharati', year: 2025, tags: ['aerosol'], provenance: { submittedBy: 'Dr Rao', reviewedBy: 'Dr Iyer' } });
  const reasons = explainLink(pub, item(), 'uses_data');
  assert.match(reasons[0], /uses data from the dataset/);
  assert.ok(reasons.some((r) => /Shared keywords: aerosol/.test(r)));
  assert.ok(reasons.some((r) => /2025 and 2023: it came 2 years later/.test(r)));
  assert.ok(reasons.some((r) => /Linked by Dr Rao when submitting; checked by reviewer Dr Iyer/.test(r)));
});

test('press release and Facebook posts are generated; Hindi needs a Hindi summary', () => {
  const [press, fb] = generateContent(item(), 'https://x.test/r', ['press', 'facebook']);
  assert.match(press.text, /^PRESS RELEASE/);
  assert.match(press.text, /About NCPOR/);
  assert.match(fb.text, /https:\/\/x\.test\/r/);
  assert.deepEqual(generateContent(item(), 'https://x.test/r', ['x'], 'HI'), []);
  const hi = generateContent(item({ meta: { hi: { title: 'भारती पर एरोसोल', summary: 'एक गर्मी की रीडिंग।' } } }), 'https://x.test/r', ['linkedin'], 'HI');
  assert.match(hi[0].text, /भारती पर एरोसोल/);
  assert.match(hi[0].text, /मशीन अनुवाद/);
});

test('station and place names are put in Hindi before machine translation', () => {
  assert.equal(applyGlossary('Bharati and Dakshin Gangotri, Antarctica'), 'भारती and दक्षिण गंगोत्री, अंटार्कटिका');
  assert.equal(applyGlossary('Bharatiya'), 'Bharatiya'); // whole words only
});
