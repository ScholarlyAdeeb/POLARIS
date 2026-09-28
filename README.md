<img width="1024" height="1024" alt="screen" src="https://github.com/user-attachments/assets/f0631941-3035-4093-ac92-dded5c24846d" />


# POLARIS — Integrated Polar Science Outreach, Knowledge Repository & Media Dissemination Portal

**SIH 2026 · Problem Statement 26063** · Ministry of Earth Sciences (MoES) · National Centre for Polar and Ocean Research (NCPOR) · Theme: Smart Education

A portal that archives expedition reports, scientific datasets, publications, photographs,
videos and institutional activities, links them to each other, and generates content for
websites and social media from any archived record.

## Run it

Requirements: **Node.js 22.13+** (uses the built-in `node:sqlite`; developed on Node 24).

```bash
npm install
cp .env.example .env      # optional; everything has a default
npm run dev               # http://localhost:3000
```

On first start the server creates `data/polaris.db` and seeds it from `src/data/polarisData.ts`
plus a set of demo records. Delete `data/` to reset. If `ADMIN_TOKEN` is not set, a random
admin token is printed in the server log.

| Script | What it does |
|---|---|
| `npm run dev` | Express API + Vite dev middleware on one port |
| `npm run build` | Production frontend build into `dist/` |
| `NODE_ENV=production npm start` | Serves the API and `dist/` |
| `npm run lint` | Type-check frontend and server |

## Architecture

```
server.ts                Express: /api, /uploads, Vite (dev) or dist/ (prod)
server/db.ts             SQLite schema: archive_items + FTS5 index, item_links, proposals, outreach_posts
server/seed.ts           First-run seed from src/data/polarisData.ts + demo records
server/api.ts            REST routes, validation, admin auth, search
server/files.ts          Generated downloads: dataset extracts, synoptic CSV, BibTeX, ISO 19115 metadata
server/outreach.ts       Website / X / LinkedIn / Instagram copy generator (template-based)
src/lib/api.ts           Typed API client used by the React app
src/context/PolarisDataContext.tsx   Loads /api/bootstrap; falls back to bundled data if the API is down
```

**One archive, seven record types.** `expedition`, `report`, `dataset`, `publication`, `photo`,
`video`, `activity` all live in `archive_items`, so search, linking, metadata export and outreach
generation work the same way for every kind of record. `item_links` holds directed relations
(`uses_data`, `documents`, `collected_during`, …), which drive the "Linked Records" panels and the
knowledge-graph view.

**Search** is SQLite FTS5 with BM25 ranking (title weighted highest). Natural-language questions
work: stopwords are dropped and years become filters, so *"What atmospheric studies were
conducted at Maitri in 2023?"* returns the 2023 Maitri records first. If no record matches every
term, it falls back to the closest matches and says so.

## Demo data

The 45 expedition seasons, station facts and hotspot payloads come from the original frontend
data. **Datasets, reports, photos, the video and activities added by the seed are demo
records** and carry `meta.sample = true`, which the UI shows as "SAMPLE RECORD".
Dataset downloads are small synthetic extracts (CDL text or CSV) generated from the record's
metadata and labelled as such inside the file. The archive does not hold the real multi-GB
products or paper PDFs. Replace demo records through the admin API.

## API

Public:

| Method & path | Purpose |
|---|---|
| `GET /api/health` | Liveness + record count |
| `GET /api/bootstrap` | Stations, hotspots, milestones, papers, simulations, value graph (first paint) |
| `GET /api/stats` | Counts by type, downloads, proposals, outreach posts |
| `GET /api/stations` · `/api/stations/:id` | Stations (+ archive counts per station) |
| `GET /api/stations/:id/synoptic.csv` | 72 h hourly surface export (sample values) |
| `GET /api/archive?type=&domain=&station=&year=&q=&sort=&limit=&offset=` | Browse/filter the archive (`type` accepts a comma list) |
| `GET /api/archive/:id` | One record with its linked records |
| `GET /api/archive/:id/metadata.json` | ISO 19115-style metadata download |
| `GET /api/datasets/:ref` | Dataset + generated CDL header (`ref` = id, file name or title) |
| `GET /api/datasets/:ref/download` | Sample extract download (counts downloads) |
| `GET /api/publications/:id/citation.bib` | BibTeX |
| `GET /api/search?q=` | Ranked full-text search with highlighted snippets + matching stations |
| `GET /api/simulations` | Polar Academy missions |
| `GET /api/proposals/template` | Proposal template (.txt) |
| `POST /api/proposals` | Submit a research proposal → `{ reference }` (rate-limited, 300-word summary cap) |
| `POST /api/outreach/generate` | `{ itemId, channels? }` → website article + X/LinkedIn/Instagram posts |

Admin (`Authorization: Bearer $ADMIN_TOKEN`):

| Method & path | Purpose |
|---|---|
| `POST /api/admin/archive` | Create a record (optional `links: [{ to, relation }]`) |
| `PATCH /api/admin/archive/:id` | Update fields (`meta` is merged) |
| `DELETE /api/admin/archive/:id` | Delete a record (links cascade) |
| `POST /api/admin/uploads` | Raw file body + `X-Filename` header → `{ url }` served from `/uploads/` (images, mp4/webm, pdf, csv, nc, txt, json) |
| `GET /api/admin/proposals` · `PATCH /api/admin/proposals/:reference` | Review proposals (`SUBMITTED` → `UNDER_REVIEW` → `SHORTLISTED` / `ACCEPTED` / `DECLINED`) |
| `POST /api/admin/outreach` · `GET` · `PATCH /:id` | Save generated posts as drafts and move them `DRAFT` → `APPROVED` → `PUBLISHED` |

Example: archive a new photo.

```bash
TOKEN=...   # from .env or the server log
curl -X POST http://localhost:3000/api/admin/uploads \
  -H "Authorization: Bearer $TOKEN" -H "X-Filename: aurora.jpg" --data-binary @aurora.jpg
# → {"url":"/uploads/1790...-aurora.jpg", ...}

curl -X POST http://localhost:3000/api/admin/archive \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"type":"photo","title":"Aurora australis over Maitri","summary":"...","stationId":"maitri",
       "year":2026,"domain":"ANTARCTICA","tags":["aurora","polar night"],
       "url":"/uploads/1790...-aurora.jpg","thumbnailUrl":"/uploads/1790...-aurora.jpg"}'
```

The new record is immediately searchable, appears in the media gallery, and can be turned into
social posts from its record view. Generated posts link back to `/?record=<id>`, which opens that
record in the portal.

## Not yet built

- An admin **UI**. Archive management, proposal review and the outreach approval queue are API-only.
- Real telemetry. Station readings are the static values from the original design.
- Hindi versions of generated outreach copy.
