# Deploying POLARIS

POLARIS is one Node process (Express API + built React app) with a SQLite file and an uploads folder.
Anything that runs a Docker image with a persistent disk works.

## Render (simplest)

1. Push this repo to GitHub (already done for `main`).
2. On https://render.com: **New → Blueprint**, pick the repo. `render.yaml` creates the web service and a 1 GB disk at `/data`.
3. When it asks for values, set `APP_URL` to the service URL (for example `https://polaris.onrender.com`). `GEMINI_API_KEY` is optional.
4. After the first deploy, open **Environment** to read the generated `ADMIN_TOKEN`. Sign in to `/admin` with it, then create your own account at `/login` and give it the admin role from the Accounts panel.

A persistent disk needs a paid instance on Render. Without a disk the app still runs, but accounts and uploads reset on every deploy.

## Railway / Fly.io / any Docker host

```bash
docker build -t polaris .
docker run -p 3000:3000 -v polaris-data:/data -e ADMIN_TOKEN=change-me -e APP_URL=https://your.domain polaris
```

Mount a volume at `/data`. Set `ADMIN_TOKEN` and `APP_URL`; the rest has defaults (see `.env.example`).

## Not included in the container

- The ML embedding service (`ml/`) needs Python and ideally a GPU. Without it search runs in keyword (BM25) mode. To add it, run `ml/serve.ps1` (or `python ml/service.py`) on a GPU machine and set `ML_SERVICE_URL`.
- Open-data records come from `server/data/open-data.json`. Refresh it with `npx tsx scripts/import-open-data.ts` and redeploy.
