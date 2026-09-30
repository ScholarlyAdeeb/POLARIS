<img width="1708" height="1653" alt="polaris_emblem" src="https://github.com/user-attachments/assets/b2f7032e-782e-4e35-a830-9db2922f47b9" />



# POLARIS — Integrated Polar Science Outreach, Knowledge Repository & Media Dissemination Portal

**SIH 2026 · Problem Statement 26063** · Ministry of Earth Sciences (MoES) · National Centre for Polar and Ocean Research (NCPOR) · Theme: Smart Education

A portal that archives expedition reports, scientific datasets, publications, photographs,
videos and institutional activities, maps and links them, and generates website and social
media content from them, credited to the people who contributed the work.

## How it works for contributors

1. **Sign up** at `/login` (scientists, expedition members, outreach staff). New accounts are *contributors*.
2. **Share work** in `/workspace`: upload a photo, video, PDF, CSV/NetCDF dataset or report and describe it.
3. **Auto-mapping**: POLARIS suggests the station (nearest to your coordinates, or named in your text), the region,
   and related records (full-text search) with a relation for each (`documents`, `collected_during`, `uses_data`, …). You tick the right ones.
4. **Review**: the record stays private until a *reviewer* approves it under Admin → Contributor submissions.
   Then it appears on the atlas, knowledge graph, search, station pages and timeline.
5. **Content**: from your record, generate a website article and X / LinkedIn / Instagram posts. Every post is
   fact-checked sentence by sentence against the record and credited to you.
6. **Publish**: a reviewer approves the post in the Outreach studio; it then appears in the public `/newsroom`
   and on your profile at `/contributors/<id>`.

Roles: `contributor` → `reviewer` (approves records and posts) → `admin` (also manages accounts).
The `ADMIN_TOKEN` from `.env` still works as an admin login for the review tools.

## Run it

Requirements: **Node.js 22.13+** (developed on Node 24) and a **PostgreSQL** database (a free Neon project works).

```bash
npm install
cp .env.example .env      # then set DATABASE_URL
npm run dev               # http://localhost:3000
```

On first start the server creates the tables in `DATABASE_URL` and seeds them from `src/data/polarisData.ts`
plus a set of demo records. Point it at an empty database to reset. If `ADMIN_TOKEN` is not set, a random
admin token is printed in the server log.

| Script | What it does |
|---|---|
| `npm run dev` | Express API + Vite dev middleware on one port |
| `npm run build` | Production frontend build into `dist/` |
| `NODE_ENV=production npm start` | Serves the API and `dist/` |
| `npm run lint` | Type-check frontend and server |
| `npm run import:open-data` | Refresh `server/data/open-data.json` from Crossref + PANGAEA |
| `npm run android:apk` | Build the Android app (`android/app/build/outputs/apk/debug/app-debug.apk`) |

Deployment (Docker, Render blueprint) and the Android app: see [DEPLOY.md](DEPLOY.md).

## Architecture

```
server.ts                Express: /api, /uploads, Vite (dev) or dist/ (prod)
server/pg.ts             PostgreSQL pool and query helpers
server/db.ts             Schema: archive_items + weighted tsvector (GIN), item_links, proposals, outreach_posts
server/seed.ts           First-run seed from src/data/polarisData.ts + demo records
server/api.ts            REST routes, validation, search, reviewer endpoints
server/auth.ts           Accounts (scrypt), sessions (HttpOnly cookie), roles
server/contrib.ts        Contributor workspace: uploads, records, auto-mapping, per-user posts, newsroom
server/extras.ts         Live weather, citations, chart series, atlas, lessons + quiz, usage counters
server/openData.ts       Loads real open metadata (Crossref, PANGAEA) as EXTERNAL records
server/files.ts          Generated downloads: dataset extracts, synoptic CSV, BibTeX, ISO 19115 metadata
server/outreach.ts       Website / X / LinkedIn / Instagram copy generator (template-based)
server/claims.ts         Sentence-level claim check of generated posts against the source record
src/lib/api.ts           Typed API client used by the React app
src/context/PolarisDataContext.tsx   Loads /api/bootstrap; falls back to bundled data if the API is down
android/, mobile-shell/  Android app (Capacitor): opens the POLARIS server with downloads, camera and location
```

**One archive, seven record types.** `expedition`, `report`, `dataset`, `publication`, `photo`,
`video`, `activity` all live in `archive_items`, so search, linking, metadata export and outreach
generation work the same way for every kind of record. `item_links` holds directed relations
(`uses_data`, `documents`, `collected_during`, …), which drive the "Linked Records" panels and the
knowledge-graph view.

**Search** is PostgreSQL full-text search ranked with `ts_rank_cd` (title weighted highest). Natural-language questions
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

## Open data, live data and honesty labels

- **Open registry records** (`EXTERNAL`): NCPOR-affiliated journal articles from Crossref and polar datasets from
  PANGAEA, metadata only (title, authors, DOI, date, position, licence), loaded from `server/data/open-data.json`.
  The data itself stays with the publisher; "Get the data" links to the DOI.
- **Live conditions** on station pages come from the Open-Meteo forecast model at the station coordinates and are
  labelled as model values, not station instrument readings.
- Demo records remain labelled `SAMPLE` / `SYNTHETIC`; only those get generated sample downloads.

## Languages

Interface in English, Hindi and Tamil (header switch). Hindi and Tamil strings were drafted for the prototype and
need review by native speakers. Record content stays in the language it was submitted in.

## Not yet built

- Email verification and password reset for accounts.
- Translation of record content and generated posts.
- Direct posting to social networks (posts are copied or shared via the network's share link).

## Routes and provenance

| Route | What it is |
|---|---|
| `/` | Home |
| `/explore` | Full-text search (PostgreSQL) with region, station, year, theme, type and data-status filters |
| `/map` | Polar map |
| `/stations/:id` | Data-driven station page with a WebGL (React Three Fiber) conceptual model and database-backed hotspots |
| `/knowledge-graph` | React Flow graph of stations, expeditions, datasets and publications from `item_links` + `station_id` |
| `/content/review` | Outreach studio: template draft → claim check → named human reviewer → publish (never automatic) |
| `/admin` | Contributor submissions review, accounts and roles, usage analytics, database status, provenance, proposals |
| `/atlas` | Every approved record with a place, on polar / Himalaya / world maps (Natural Earth coastlines) |
| `/timeline` | Expeditions and activities by year |
| `/newsroom` | Published, reviewed posts with contributor credit |
| `/learn` | Lesson packs per region and a quiz generated from database fields |
| `/workspace` | Contributor upload → mapping → content workflow |
| `/login`, `/contributors/:id` | Accounts and public contributor profiles |

Every archive record carries `data_status` (`OFFICIAL`, `VERIFIED`, `EXTERNAL`, `SAMPLE`, `SYNTHETIC`, `UNVERIFIED`),
`provenance` and `review_status` (derived in `server/migrations.ts`; schema versions are tracked in `schema_migrations`). Demo downloads are labelled `SYNTHETIC SAMPLE EXTRACT`.
