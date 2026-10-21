// Adds a Hindi title and summary (meta.hi) to every approved record that lacks one, using the open
// opus-mt-en-hi model on this machine. Safe to re-run; reviewed translations are never touched.
//   npm run translate            all approved records without Hindi
//   npm run translate -- 50      at most 50 records
import 'dotenv/config';
import { connect } from '../server/pg.ts';
import { rowToItem } from '../server/db.ts';
import { HI_MODEL, translateRecord } from '../server/translate.ts';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');
const db = connect(url);
const limit = Number(process.argv[2]) || 100000;

const rows = await db.all(
  `SELECT * FROM archive_items WHERE review_status = 'APPROVED' AND (meta::jsonb -> 'hi' -> 'summary') IS NULL
   ORDER BY CASE WHEN owner_id IS NOT NULL THEN 0 WHEN (meta::jsonb ->> 'openData') IS NULL THEN 1 ELSE 2 END, rowid LIMIT ?`,
  limit
);
console.log(`${rows.length} records to translate with ${HI_MODEL}`);
const t0 = Date.now();
let done = 0;
for (const r of rows) {
  const item = rowToItem(r);
  try {
    if (await translateRecord(db, item)) done++;
  } catch (err: any) {
    console.warn(`  ${item.id}: ${err.message}`);
  }
  if (done && done % 25 === 0) console.log(`  ${done}/${rows.length} (${Math.round((Date.now() - t0) / 1000)} s)`);
}
console.log(`Translated ${done} records in ${Math.round((Date.now() - t0) / 1000)} s`);
process.exit(0);
