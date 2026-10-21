<p align="center">
  <img src="public/polaris-emblem.svg" alt="HIMAKSHA emblem" width="150">
</p>

# HIMAKSHA — Integrated Polar Science Outreach, Knowledge Repository & Media Dissemination Portal

**Smart India Hackathon 2026 · Problem Statement 26063** · Ministry of Earth Sciences (MoES) ·
National Centre for Polar and Ocean Research (NCPOR) · Theme: **Smart Education** · Team Pehchaan

*Codename **POLARIS** during early development.* **HIMAKSHA** (हिमाक्ष) joins Hindi *him* (snow) with Sanskrit *akṣa* (axis), the same word as English *axis*: the snow axis, India's polar knowledge axis.

HIMAKSHA is one home for India's polar science. Researchers upload expedition reports,
datasets, publications, photographs, videos and institutional activities. HIMAKSHA places
each record on the map, links it to its station, expedition and related work, and makes it
searchable once a reviewer approves it. **Ask HIMAKSHA** answers questions from those
records with an open-source language model, citing every record it used. From any record,
HIMAKSHA writes website and social media posts that are fact-checked against the record and
credited to the researcher who shared it.

| | |
|---|---|
| Live portal | https://polaris2-ecru.vercel.app |
| Ask HIMAKSHA | https://polaris2-ecru.vercel.app/ask |
| Accuracy of Ask HIMAKSHA (fixed questions, every answer published) | https://polaris2-ecru.vercel.app/accuracy |
| Verify a post (QR / 8-character code) | https://polaris2-ecru.vercel.app/verify |
| Deployment (Vercel, Docker, Render, Android) | [DEPLOY.md](DEPLOY.md) |
| Configuration | [.env.example](.env.example) |

## Demo sign-in

Open the live portal (or the Android app) and sign in. The sign-in page also lists these
accounts; tap one to fill the form.

| Role | Username | Password | What you can do |
|---|---|---|---|
| Contributor | `user1` | `1234` | Upload work, review the suggested mapping, generate posts from your records, see your public profile |
| Demo reviewer | `admin` | `0786` | Review, approve and publish **content created by the demo accounts**, see usage and the RAG index. Sandboxed: it cannot see or touch real contributors' work, accounts or proposals, cannot delete or edit records, and cannot approve anything it created itself |

These are shared demonstration accounts, so the server sandboxes them (`server/guards.ts`). To try the full
flow: sign in as `user1`, upload and generate posts; then sign in as `admin` to approve and publish them.
New accounts created at `/login` start as contributors. Set `DEMO_ACCOUNTS=off` to remove both logins.

![Ask HIMAKSHA: a cited answer, fact-checked sentence by sentence, with the records it used](docs/screenshots/02-ask.png)

---

## Ten-minute walkthrough

| # | Do this | What it shows |
|---|---|---|
| 1 | Open the [live portal](https://polaris2-ecru.vercel.app) | Boot screen, then the home page with stations and live conditions |
| 2 | **Explore**, search `ozone Maitri` | Full-text search over 1,000+ records with region, station, year and status filters |
| 3 | Open any NCPOR expedition paper | Real metadata from NCPOR's DSpace, *Open registry* label, link to the paper |
| 4 | In the record, press **Why connected?** on a link, then **Trace this finding to its source** | Plain-language reasons for each link; the chain back to dataset, expedition, station and its instruments |
| 5 | Press **हिन्दी में पढ़ें**, then **Review history** | Hindi summary labelled as machine translation; every decision on the record with who and when |
| 6 | **Ask**: "Which ship took the first Indian expedition to Antarctica?" | Answer with `[S1]` citations and a sentence-by-sentence fact check; then **Accuracy** for every published test answer |
| 7 | Open the dataset *Arctic sea-ice extent … (NSIDC Sea Ice Index)* | Real satellite series since 1979, charted from the published CSVs |
| 8 | Sign in as `user1` / `1234`, **My workspace**: upload a photo, set **File access: Restricted** | Suggested station, region and related records; the restricted file will be hidden from the public |
| 9 | Generate posts: tick **Press release** and **Facebook**, choose **हिन्दी** for a second set | Drafts in six formats, each fact-checked against the record (Hindi against the Hindi summary) |
| 10 | Sign out, sign in as `admin` / `0786`, **Admin** | The submission queue with access and Hindi controls; the server refuses approval of anything the reviewer drafted itself (two-person rule) |
| 11 | Approve the record and the posts in **Outreach studio**, publish | The **Audit trail** panel records each step |
| 12 | **Newsroom**: scan a post's QR code, or open **Verify** and paste an edited copy | *Genuine* vs *Altered*, plus the trace from the post back to its evidence |
| 13 | **Learn**: answer the quiz, get 75% or more | A certificate with a code the server graded itself; check it on **Verify** |

---

## Contents

1. [Ten-minute walkthrough](#ten-minute-walkthrough)
1. [What HIMAKSHA does](#what-himaksha-does)
2. [From a researcher's upload to a published post](#from-a-researchers-upload-to-a-published-post)
3. [Ask HIMAKSHA (RAG)](#ask-himaksha-rag)
4. [Trust, provenance and honest labels](#trust-provenance-and-honest-labels)
5. [Screens](#screens)
6. [Architecture](#architecture)
7. [Security](#security)
8. [Run it](#run-it)
9. [Deploy](#deploy)
10. [API](#api)
11. [Repository layout](#repository-layout)
12. [What is not built](#what-is-not-built)

---

## What HIMAKSHA does

| Need in the problem statement | What HIMAKSHA does | How |
|---|---|---|
| **Archive** expedition reports, datasets, publications, photos, videos, activities | One archive with seven record types; uploads up to 100 MB (images, MP4/WebM, PDF, CSV, NetCDF, JSON, TXT) | `archive_items` in PostgreSQL; uploads on disk or Vercel Blob |
| **Map** the material | Every record with a place appears on polar, Himalaya and world maps; station pages show records as hotspots on a 3D model | Station coordinates, uploaded GPS, Natural Earth coastlines, React Three Fiber |
| **Link** related work | Suggested station, region and related records for each upload; a knowledge graph of stations, expeditions, datasets and publications | Nearest station, full-text matching, `item_links` relations (`documents`, `uses_data`, `collected_during`, …) |
| **Find** it again | Full-text search with region, station, year, theme, type and data-status filters; questions answered with citations | PostgreSQL `tsvector` + GIN; pgvector RAG |
| **Generate content** for websites and social media | Website article, press release, X, LinkedIn, Instagram and Facebook posts from any record, in English or Hindi | Template generator + sentence-level claim check (Hindi posts checked against the record's Hindi summary) |
| **For the respective users, per their uploaded work** | Posts and records are credited to the contributor and shown on their public profile and in the newsroom | Accounts, roles, contributor pages |
| **Outreach and education** | Timeline of 45 expeditions, lesson packs, a quiz with a verifiable certificate, live station weather, climate history since 1981, Arctic and Antarctic sea ice since 1979 | Database-generated lessons, server-graded certificates; Open-Meteo, ERA5, NSIDC Sea Ice Index |
| **Hindi** | Every record gets a Hindi title and summary; the interface is in English, Hindi and Tamil | Meta NLLB-200 (600M) on the server, with a place-name glossary; labelled *machine translation* until a reviewer checks it |
| **Sensitive material** | A record's file can be *restricted* (on request to NCPOR) or *embargoed* to a date while its catalogue entry stays public | `meta.access`, enforced on every record, search and download route (`server/access.ts`) |

The archive on the live portal holds **943 approved records**, including **790 papers from NCPOR's own
Scientific Reports of the Indian Expeditions to Antarctica** (1st to 30th expedition, harvested from NCPOR's
DSpace repository over OAI-PMH, metadata only with a link to each paper), 80 NCPOR-affiliated journal
articles (Crossref), 60 open-access NCPOR articles with free full text (OpenAlex), PANGAEA datasets, the NSIDC
Sea Ice Index for both poles, 32 photographs of Indian stations with their licences (Wikimedia Commons), ERA5
climate records per station, the expedition timeline and the demo records, across 6 stations (Bharati, Maitri, Dakshin Gangotri, Himadri, Himansh, ORV Sagar Kanya). The
interface is available in English, Hindi and Tamil.

---

## From a researcher's upload to a published post

```mermaid
flowchart LR
    U["Researcher uploads<br/>photo, video, PDF, dataset"] --> M["Auto-mapping<br/>station, region, related records"]
    M --> C["Researcher confirms<br/>links and details"]
    C --> R{"Reviewer<br/>approves?"}
    R -- changes requested --> C
    R -- approved --> P["Public record"]
    P --> S["Search, atlas,<br/>knowledge graph, timeline"]
    P --> A["Ask HIMAKSHA index<br/>(embedded automatically)"]
    P --> G["Generate posts<br/>website, X, LinkedIn, Instagram"]
    G --> F["Claim check<br/>sentence by sentence"]
    F --> H{"Named human<br/>reviewer"}
    H -- approved --> N["Newsroom + contributor profile<br/>credited to the researcher"]
```

| Step | What happens |
|---|---|
| 1. Share | In **My workspace**, a contributor uploads a file (or takes a photo on the phone and attaches its GPS position) and describes it. |
| 2. Auto-map | HIMAKSHA suggests the station (nearest to the coordinates, or named in the text), the region, and related records with a relation for each. The contributor ticks the right ones. |
| 3. Review | The record stays private until a reviewer approves it, asks for changes or rejects it, with a note the contributor sees. |
| 4. Publish the record | Approved records appear in search, the atlas, the knowledge graph, station pages and the timeline, and are embedded for Ask HIMAKSHA. |
| 5. Generate content | From the record, the contributor or the outreach team generates a website article and X / LinkedIn / Instagram posts. |
| 6. Fact check | Every sentence of a post is compared with the record: shared words and exact numbers. Unsupported sentences block approval unless a reviewer explains why. |
| 7. Publish the post | A named reviewer approves it in the **Outreach studio**; it then appears in the public **Newsroom** and on the contributor's profile at `/contributors/<id>`. Nothing is published automatically. |

Roles: `contributor` → `reviewer` (approves records and posts) → `admin` (also manages accounts).

---

## Ask HIMAKSHA (RAG)

`/ask` answers questions using only the records researchers have shared on the portal, and
names who shared them.

| Step | What happens | How |
|---|---|---|
| 1. Index | Every approved record is split into ~900-character chunks and embedded. The text inside uploaded PDF, TXT, CSV and JSON files is indexed with its record. | `BAAI/bge-small-en-v1.5` (384 dimensions) → pgvector, HNSW index (`server/rag/indexer.ts`) |
| 2. Keep it current | A content hash per record re-embeds edited records, adds newly approved ones and removes unpublished ones, before the next question. | `rag_index_state` |
| 3. Retrieve | Vector similarity and keyword search together, with a relevance floor: off-topic questions get no sources and no answer. | pgvector cosine + PostgreSQL full-text (`server/rag/ask.ts`) |
| 4. Answer | An open model answers only from the retrieved records, cites them as `[S1]`, copies numbers exactly, and says when the archive does not have the answer. | Qwen2.5 (see below) |
| 5. Check | Every sentence is compared with the records it cites. The page shows how many sentences are supported, which records are not official or verified, and who contributed each record. | `server/claims.ts` |

```mermaid
flowchart LR
    Q[Question] --> E["Embed question<br/>bge-small-en-v1.5"]
    E --> V[("pgvector<br/>rag_chunks")]
    Q --> K[("Full-text<br/>tsvector")]
    V --> F["Fuse + relevance floor"]
    K --> F
    F --> S["Top records<br/>S1 … S6"]
    S --> L["Open LLM<br/>answers with [S#] citations"]
    L --> C["Claim check<br/>per sentence"]
    C --> UI["Answer, sources,<br/>contributor credit"]
```

**Models.** All models are open and come from Hugging Face. Two backends share one index:

| | Local (PC, Docker, Android via the PC) | Hosted (Vercel) |
|---|---|---|
| Embeddings | `Xenova/bge-small-en-v1.5` (ONNX port of the same weights) | `BAAI/bge-small-en-v1.5` |
| Answers | `onnx-community/Qwen2.5-1.5B-Instruct`, 4-bit | `Qwen/Qwen2.5-72B-Instruct` (then `openai/gpt-oss-20b`, `Qwen/Qwen2.5-7B-Instruct` if a model is not served on the account) |
| Runs on | Inside the Node server (transformers.js, ONNX Runtime CPU); nothing leaves the machine | Hugging Face Inference Providers (`HF_TOKEN`) |
| Measured | Retrieval ~1–2 s, answer ~10–30 s (about 6 tokens/s on a laptop i9) | Retrieval ~150 ms, answer ~3–6 s |

Without a language model (`RAG_LLM=off`, or the service unavailable), Ask HIMAKSHA still
returns the best-matching sentences from the records, cited.

**Tested questions** on the live portal:

| Question | Result |
|---|---|
| Which ship took the first Indian expedition to Antarctica? | "MV Polar Circle … 1981", cited [S1], 2 of 2 sentences supported |
| What atmospheric studies were conducted at Maitri? | Aerosol, ozone, boundary layer and black-carbon studies, cited to four records |
| Who won the cricket world cup in 2011? | No matching record; the model is not called |

**Page citations.** Text inside uploaded PDFs is indexed page by page. When an answer draws on a PDF, the
source card says *From the attached file, page 4* and the link opens the PDF at that page.

**Measured, in public.** `/accuracy` shows the latest run of a fixed set of questions whose answers were
checked by hand against the records (`server/data/eval/questions.json`): whether the right record was found
and cited, whether the checked fact was stated, and whether off-topic questions were declined. Every answer
is shown, including the wrong ones. Re-run with `EVAL_BASE=https://polaris2-ecru.vercel.app npm run eval`.

---

## Trust, provenance and honest labels

Every record carries a **data status**, shown as a badge everywhere it appears:

| Status | Meaning |
|---|---|
| `OFFICIAL` / `VERIFIED` | Confirmed by NCPOR or a reviewer |
| `EXTERNAL` ("Open registry") | Real metadata from NCPOR's DSpace repository (expedition scientific reports), Crossref and OpenAlex (NCPOR-affiliated articles), PANGAEA (polar datasets), NSIDC (sea ice) or Wikimedia Commons (photographs, with author and licence); the paper or data stays with the publisher and the record links to it |
| `SAMPLE` | Demo record written for the prototype |
| `SYNTHETIC` | Demo dataset; its download is a small generated extract labelled `SYNTHETIC SAMPLE EXTRACT` inside the file |
| `UNVERIFIED` | Contributed, not yet confirmed |

- **Live conditions** on station pages come from the Open-Meteo forecast model at the station
  coordinates and are labelled as model values, not instrument readings.
- **Climate history** (daily, 1981 to about a week ago) comes from the ERA5 reanalysis and
  downloads as CSV.
- **Review gates**: contributor records are private until approved; posts need a named human
  reviewer; Ask HIMAKSHA only reads approved records.
- **Provenance**: who reviewed a record, when, and the decision are stored with it.
- **Audit trail**: every submission, review decision, access change, draft and publication is written to an
  append-only log. Approved records show their own history publicly; reviewers see the whole trail.
- **Why connected / trace**: each link explains itself (relation, shared station, years, keywords, who linked
  and who checked it), and any record or published post can be traced back to its data, expedition, station
  and instruments.
- **Two-person rule**: nobody approves their own submission or their own drafted post; the server refuses it.
- **Verifiable posts**: every published post carries an 8-character code and a QR code. `/verify/<code>`
  says whether a copy is a *genuine* published post, an *altered* copy (paste the text to compare), *not
  approved*, or *no match*.

---

## Screens

| Home | Explore |
|---|---|
| ![Home](docs/screenshots/01-home.png) | ![Explore: full-text search with filters](docs/screenshots/03-explore.png) |

**Station page**: a conceptual 3D model with every dataset, report and publication recorded
at the station as a hotspot, live conditions and climate history.

![Maitri station page](docs/screenshots/04-station.png)

| Data atlas | Knowledge graph |
|---|---|
| ![Every approved record with a place, on polar maps](docs/screenshots/05-atlas.png) | ![Stations, expeditions, datasets and publications linked from the database](docs/screenshots/06-knowledge-graph.png) |

| Timeline | Learn |
|---|---|
| ![Expedition timeline](docs/screenshots/07-timeline.png) | ![Lesson packs and a quiz generated from the database](docs/screenshots/08-learn.png) |

| My workspace (contributor) | Outreach studio (reviewer) |
|---|---|
| ![Upload, describe and map new work](docs/screenshots/10-workspace.png) | ![Draft, claim check, human review, publish](docs/screenshots/12-studio.png) |

**Admin**: contributor submissions, usage analytics, accounts and roles, database status
and the Ask HIMAKSHA index.

![Admin](docs/screenshots/11-admin.png)

**On a phone**: bottom tab bar, full-screen dialogs, camera capture and location in the
workspace. The same screens ship in the Android app.

<p>
  <img src="docs/screenshots/13-mobile-home.png" alt="Home on a phone" width="300">
  &nbsp;
  <img src="docs/screenshots/14-mobile-ask.png" alt="Ask HIMAKSHA on a phone" width="300">
</p>

---

## Architecture

```mermaid
flowchart TB
    subgraph Clients
      B["Browser / PWA<br/>React 19 + Vite + Tailwind"]
      A["Android app<br/>Capacitor"]
    end
    subgraph Server["Express API (Node, TypeScript)"]
      S1["Archive, search, atlas, graph"]
      S2["Accounts, roles, review"]
      S3["Outreach generator + claim check"]
      S4["Ask HIMAKSHA: indexer, retrieval, answers"]
    end
    B --> Server
    A --> Server
    Server --> DB[("PostgreSQL (Neon)<br/>archive + tsvector + pgvector")]
    Server --> FS[("Uploads<br/>disk or Vercel Blob")]
    S4 --> HF["Hugging Face<br/>open models"]
    Server --> OM["Open-Meteo<br/>live weather, ERA5"]
```

| Part | Stack |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind 4, React Router, React Three Fiber, React Flow, d3-geo |
| API | Express 4 on Node 22+, `pg`, one process locally or one Vercel function |
| Database | PostgreSQL with full-text search (`tsvector`, GIN) and pgvector (HNSW); tested on Neon (PostgreSQL 18) |
| RAG | transformers.js + ONNX Runtime (local) or Hugging Face Inference Providers (hosted), `unpdf` for PDF text |
| Android | Capacitor 8 shell with native downloads, camera, location and clipboard |
| Hosting | Vercel (static app + one function), or Docker / Render (`Dockerfile`, `render.yaml`) |

**One archive, seven record types.** `expedition`, `report`, `dataset`, `publication`,
`photo`, `video` and `activity` all live in `archive_items`, so search, linking, metadata
export, outreach and Ask HIMAKSHA work the same way for every kind of record.

---

## Security

| Area | Control | Where |
|---|---|---|
| Passwords | scrypt hashes; length limits | `server/auth.ts` |
| Sessions | Random token in an `HttpOnly`, `SameSite` cookie (`Secure` over HTTPS); only a SHA-256 of the token is stored; malformed cookies are treated as signed out | `server/auth.ts` |
| Roles | `contributor`, `reviewer`, `admin`, checked on the server for every route; contributors only see and edit their own unpublished records | `server/auth.ts`, `server/contrib.ts` |
| Review | Records and posts are published only by a named reviewer; the reviewer name comes from the signed-in account | `server/api.ts` |
| Two-person rule | A reviewer cannot approve a record they own or a post they drafted | `server/guards.ts` |
| Demo logins | The public demo reviewer reaches demo-owned content only; accounts, proposals, deletes and record edits are refused | `server/guards.ts` |
| Post integrity | Published posts carry a code derived from their exact text; `/verify` detects altered copies | `server/verify.ts` |
| Audit | Append-only log of submissions, decisions, access changes and publications, with the account that made them | `server/audit.ts` |
| Restricted files | Restricted and embargoed files lose their links for the public and their downloads return 403; owners and reviewers keep access | `server/access.ts` |
| Uploads | Allow-listed file types, 100 MB limit, generated file names, `dotfiles` denied | `server/uploads.ts` |
| Input | Length and format checks on every field; station ids, URLs and coordinates validated | `server/http.ts`, `server/contrib.ts` |
| Abuse | Per-client rate limits on sign-in, proposals and Ask HIMAKSHA, with the real client IP behind Vercel / Render proxies | `server/http.ts`, `server/app.ts` |
| Redirects | Sign-in `?next=` accepts same-site paths only | `src/pages/LoginPage.tsx` |
| Secrets | `DATABASE_URL`, `ADMIN_TOKEN`, `HF_TOKEN` only in environment variables; `.env` is git-ignored | `.env.example` |

---

## Run it

Requirements: **Node.js 22.13+** and a **PostgreSQL** database with pgvector (a free Neon
project works).

```bash
npm install
cp .env.example .env      # set DATABASE_URL
npm run dev               # http://localhost:3000
```

On Windows, `start_all.bat` does the same, pulls the latest code from GitHub, and prints
the address the Android app can use on the same Wi-Fi.

On first start the server creates the tables, seeds the archive and loads the open-data
records. If `ADMIN_TOKEN` is not set, a random admin token is printed in the server log.

**Ask HIMAKSHA locally**: download the open models once (about 1.8 GB, resumable):

```bash
npm run rag:models
```

The index builds itself on startup. To use Hugging Face instead of local models, set
`HF_TOKEN` and `RAG_BACKEND=hosted`.

| Script | What it does |
|---|---|
| `npm run dev` | Express API + Vite dev server on one port |
| `npm run build` | Production frontend build into `dist/` |
| `NODE_ENV=production npm start` | Serves the API and `dist/` |
| `npm run lint` | Type-check frontend and server |
| `npm test` | Unit tests (review rules, demo sandbox, post verification, evaluation scoring, PDF page chunking, GPS mapping, claim check, uploads, NCPOR snapshot); also run by GitHub Actions on every push |
| `npm run eval` | Ask the fixed evaluation questions and write `server/data/eval/results.json` for `/accuracy` (`EVAL_BASE` picks the server) |
| `npm run rag:models` | Download the local RAG models into `data/models` |
| `npm run import:open-data` | Refresh `server/data/open-data.json` from Crossref + PANGAEA |
| `npm run import:ncpor` | Refresh the NCPOR expedition-report papers from NCPOR's DSpace (OAI-PMH, metadata only) |
| `npm run import:extra` | Add the NSIDC Sea Ice Index, OpenAlex open-access articles and Wikimedia Commons photos to the snapshot |
| `npm run translate` | Write a Hindi title and summary for every approved record that lacks one (NLLB-200 on this machine; about 10 s per record on a laptop CPU) |
| `npm run vercel-build` | Build output for Vercel (static app + API function) |
| `npm run android:apk` | Build the Android app |

---

## Deploy

**Vercel** (the live portal): import the repository; `vercel.json` builds the app and the
API function. Environment variables:

| Variable | Needed for |
|---|---|
| `DATABASE_URL` | Everything (PostgreSQL with pgvector) |
| `HF_TOKEN` | Ask HIMAKSHA (a Hugging Face token with "Make calls to Inference Providers") |
| `ADMIN_TOKEN` | Admin access with a token (optional when admin accounts exist) |
| `BLOB_READ_WRITE_TOKEN` | Uploads on Vercel (connect a Vercel Blob store) |
| `DEMO_ACCOUNTS` | `on` to create the demo logins, `off` for a real deployment |

**Docker / Render**: `Dockerfile` and `render.yaml` run the same server with a disk for
uploads. Details in [DEPLOY.md](DEPLOY.md).

**Android app**: `android/` is a Capacitor project. The app opens the HIMAKSHA server
(the hosted portal, or a PC on the same Wi-Fi) and adds native file downloads, camera
capture, location, clipboard and the back button. Build with `npm run android:apk`
(JDK 21 and the Android SDK); set `POLARIS_SERVER_URL` to make the hosted portal the
default. The server address can be changed in the app.

---

## API

Public:

| Method & path | Purpose |
|---|---|
| `GET /api/health` | Liveness, database and record count |
| `GET /api/bootstrap` | Stations, hotspots, milestones, papers, simulations (first paint) |
| `GET /api/stations` · `/api/stations/:id` | Stations with live conditions and archive counts |
| `GET /api/stations/:id/weather` · `/climate` | Open-Meteo live conditions · ERA5 daily history |
| `GET /api/archive?type=&domain=&station=&year=&theme=&q=` | Browse and filter approved records |
| `GET /api/archive/:id` | One record with its linked records |
| `GET /api/archive/:id/cite?format=apa\|bibtex\|ris` | Citation |
| `GET /api/archive/:id/metadata.json` | ISO 19115-style metadata |
| `GET /api/search?q=` | Ranked full-text search with highlighted snippets |
| `GET /api/facets` · `/api/atlas` · `/api/graph` · `/api/learn` | Filters, map points, knowledge graph, lessons and quiz |
| `GET /api/content/published` | Newsroom posts |
| `GET /api/archive/:id/history` | Review history of an approved record and its published posts |
| `GET /api/archive/:id/trace` · `/api/links/explain?from=&to=` | Trace a record to its evidence · why two records are linked |
| `GET /api/verify/:code` · `/api/certificates/:code` | Check a post or a certificate |
| `POST /api/learn/certificate` | `{ name, seed, answers }`: the server re-grades the quiz and issues a certificate at 75% |
| `GET /api/rag/status` | Ask HIMAKSHA backend, models and index size |
| `POST /api/rag/ask` | `{ question, filters? }` → server-sent events: `sources`, `token`…, `done` (answer, citations, claim check) |

Signed in:

| Method & path | Purpose |
|---|---|
| `POST /api/auth/register` · `/login` · `/logout` · `GET /api/auth/me` | Accounts |
| `POST /api/me/uploads` · `/api/me/suggest` | Upload a file · suggested station, region and links |
| `GET` · `POST /api/me/records` · `PATCH` · `DELETE /api/me/records/:id` | Contributor records |
| `POST /api/me/records/:id/content` · `GET /api/me/content` | Generate and list the contributor's posts |
| `GET /api/admin/submissions` · `POST /api/admin/archive/:id/review` | Review contributor submissions (reviewer) |
| `POST /api/admin/outreach/draft` · `PATCH /api/admin/outreach/:id` | Draft, approve, publish posts (reviewer) |
| `POST /api/admin/rag/reindex` | Index new records, or `{ "full": true }` to rebuild (reviewer) |
| `PATCH /api/admin/archive/:id` `{ access }` · `{ meta: { hi } }` | Restrict / embargo a file · confirm the Hindi text (reviewer) |
| `GET /api/admin/audit` | Audit trail (reviewer) |
| `GET /api/admin/overview` · `/api/admin/users` | Status and accounts (admin) |

---

## Repository layout

```
src/                         React app
  pages/                     Ask, Explore, Atlas, Station, Knowledge graph, Timeline, Learn,
                             Newsroom, Workspace, Outreach studio, Admin, Login
  components/                header, mobile navigation, modals, charts, 3D station scene
  lib/                       API client, auth, i18n (English, Hindi, Tamil)
server/                      Express API
  app.ts, api.ts             app setup and routes
  pg.ts, db.ts, seed.ts      PostgreSQL pool, schema, first-run seed
  search.ts                  full-text search and filters
  auth.ts, contrib.ts        accounts, roles, contributor workspace and auto-mapping
  outreach.ts, claims.ts     post generator and sentence-level claim check
  rag/                       Ask HIMAKSHA: config, models, indexer, retrieval and answers
  openData.ts, realdata.ts   Crossref / PANGAEA records, Open-Meteo and ERA5
  files.ts, extras.ts        downloads, citations, atlas, lessons, usage counters
  uploads.ts, vercel.ts      uploads (disk or Vercel Blob), Vercel function entry
android/, mobile-shell/      Android app (Capacitor) and its launcher page
scripts/                     rag-models.ts, vercel-build.mjs, import-open-data.ts, android-config.mjs
public/                      emblem, PWA manifest and service worker
docs/screenshots/            screenshots used in this README
```

Model files (`data/models`), uploads, build output and `.env` are not in the repository.

---

## What is not built

| Area | Actual state |
|---|---|
| Real NCPOR data | 790 papers from NCPOR's expedition scientific reports, 80 Crossref articles and the PANGAEA datasets are real metadata (`EXTERNAL`) linking to the source; NCPOR's repository is "All Rights Reserved", so the full papers are not copied. A few seeded datasets, reports, photos and the video remain demo records labelled `SAMPLE` / `SYNTHETIC`. |
| Uploads on Vercel | Files go to the connected Vercel Blob store. With `BLOB_STORE_ID` (newer stores, OIDC) they pass through the server, so the limit is 4.5 MB per file; add `BLOB_READ_WRITE_TOKEN` to let browsers upload larger files (up to 100 MB) straight to Blob. |
| Ask HIMAKSHA quality | Answers are only as good as the records. Locally the 1.5B model sometimes includes a loosely related record; the claim check marks such sentences "partly supported". Questions in Hindi or Tamil are not tuned. |
| Free model usage | The hosted backend uses the Hugging Face free monthly allowance; beyond it, answers fall back to quoted sentences. |
| Accounts | No email verification or password reset. |
| Social networks | Posts are copied or opened in the network's share dialog; there is no direct posting. |
| Translation | Interface in English, Hindi and Tamil. Record titles and summaries get a machine Hindi translation (NLLB-200), which needs a reviewer's check; full texts are not translated, and there is no Tamil record translation yet. The model runs on a server with local models, so on Vercel new approvals get Hindi after `npm run translate` is run. |
| Restricted files | Restricted files uploaded to public Blob storage are hidden by the app, but anyone who already has the storage URL can still open it; a private store is needed for real sensitive data. |
| Android app | Tested on an Android 15 emulator, not yet on a physical phone. |
