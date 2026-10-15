import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { ordinal } from '../server/openData.ts';
import { chunkText, fileChunks, limitPages } from '../server/rag/indexer.ts';
import { distanceKm, nearestStation, validLatLon } from '../server/geo.ts';
import { STATIONS_DATA } from '../src/data/polarisData.ts';
import { splitSentences, verifyClaims } from '../server/claims.ts';
import { describeBlobUpload } from '../server/uploads.ts';

test('ordinals for expedition numbers', () => {
  const cases: [number, string][] = [[1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'], [11, '11th'], [12, '12th'], [13, '13th'], [21, '21st'], [22, '22nd'], [23, '23rd'], [45, '45th'], [101, '101st'], [111, '111th']];
  for (const [n, want] of cases) assert.equal(ordinal(n), want);
});

test('chunking keeps short text whole and splits long text with overlap', () => {
  assert.deepEqual(chunkText('Short note about Maitri.'), ['Short note about Maitri.']);
  const long = Array.from({ length: 60 }, (_, i) => `Sentence ${i} about ice cores and aerosol at Maitri station.`).join(' ');
  const chunks = chunkText(long, 900, 150);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((c) => c.length <= 900));
});

test('PDF pages keep their numbers through chunking and the size budget', () => {
  const pages = limitPages(
    [
      { page: 1, text: 'Front matter.' },
      { page: 2, text: '   ' },
      { page: 3, text: 'Ozone was measured at Maitri.' },
      { page: 4, text: 'x'.repeat(50) },
    ],
    60
  );
  assert.deepEqual(pages.map((p) => p.page), [1, 3, 4]); // empty page dropped
  assert.ok(pages.reduce((n, p) => n + p.text.length, 0) <= 60); // budget respected
  const parts = fileChunks('HEADER', [{ page: 3, text: 'Ozone was measured at Maitri.' }]);
  assert.equal(parts[0].page, 3);
  assert.match(parts[0].content, /\(from the attached file, page 3\)/);
  assert.match(fileChunks('H', [{ page: null, text: 'csv text here' }])[0].content, /\(from the attached file\)/);
});

test('GPS coordinates map to the nearest Indian station', () => {
  const stations = STATIONS_DATA; // the server's listStations() is a cache filled from the database
  const maitri = nearestStation({ lat: -70.7658, lon: 11.7358 }, stations);
  assert.equal(maitri?.station.id, 'maitri');
  assert.ok((maitri?.km ?? 99) < 5);
  assert.equal(nearestStation({ lat: 0, lon: 0 }, stations, 400), null); // middle of the Atlantic
  assert.ok(Math.abs(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }) - 111.2) < 1);
  assert.equal(validLatLon(-91, 0), null);
  assert.deepEqual(validLatLon('-70.7', '11.7'), { lat: -70.7, lon: 11.7 });
});

test('claim check marks supported and unsupported sentences', () => {
  assert.equal(splitSentences('First one. Second one!').length, 2);
  const sources = [{ ref: 'S1', id: 'R1', type: 'report', title: 'Maitri ozone', dataStatus: 'SAMPLE', year: 2023, stationId: 'maitri', text: 'Total ozone at Maitri was measured with a Dobson spectrophotometer in 2023.' }] as any;
  const ok = verifyClaims('Ozone at Maitri was measured with a Dobson spectrophotometer in 2023 [S1].', sources);
  assert.ok(ok.supported >= 1);
  assert.equal(ok.unsupported, 0);
  const bad = verifyClaims('Bharati recorded 900 penguins in 1975 [S1].', sources);
  assert.equal(bad.unsupported, 1);
  assert.deepEqual(bad.claims[0].missingNumbers, ["900", "1975"]); // invented numbers are caught
});

test('browser uploads must be files in this app’s Blob store with an allowed type', () => {
  const url = 'https://abc123.public.blob.vercel-storage.com/uploads/photo-x1.jpg';
  assert.equal(describeBlobUpload({ url, originalName: 'Aurora.jpg', bytes: 1000 }).kind, 'image');
  assert.throws(() => describeBlobUpload({ url: 'https://evil.example.com/a.jpg', originalName: 'a.jpg', bytes: 10 }), /Blob store/);
  assert.throws(() => describeBlobUpload({ url, originalName: 'run.exe', bytes: 10 }), /not allowed/);
  assert.throws(() => describeBlobUpload({ url, originalName: 'a.jpg', bytes: 0 }), /out of range/);
});

test('NCPOR snapshot records are real, linked and unique', () => {
  const snap = JSON.parse(fs.readFileSync('server/data/open-data.json', 'utf8'));
  const r = snap.ncporReports ?? [];
  assert.ok(r.length > 500, 'expected the harvested NCPOR expedition-report papers');
  assert.equal(new Set(r.map((x: any) => x.handle)).size, r.length);
  assert.ok(r.every((x: any) => /\/dspace\/handle\//.test(x.url) && x.title));
});

test('keyword fallback coverage: loose matches are dropped, close ones kept', async () => {
  const { termCoverage, KEYWORD_FALLBACK_COVERAGE } = await import('../server/rag/ask.ts');
  assert.equal(termCoverage(['metapel', 'dakshin', 'gangotri'], 'Geochemistry of metapelite from Dakshin Gangotri'), 1);
  // "Who won the FIFA World Cup?" must not be answered from a record that merely says "World"
  assert.ok(termCoverage(['won', 'fifa', 'world', 'cup'], 'World Data Centre for glaciology') < KEYWORD_FALLBACK_COVERAGE);
  assert.equal(termCoverage([], 'anything'), 0);
});
