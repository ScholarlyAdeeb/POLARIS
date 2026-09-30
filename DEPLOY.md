# Deploying POLARIS

POLARIS is one Node process (Express API + built React app) backed by PostgreSQL (`DATABASE_URL`), plus an uploads folder.
Anything that runs a Docker image works; a persistent disk keeps uploaded files.

## Render (simplest)

1. Push this repo to GitHub (already done for `main`).
2. On https://render.com: **New → Blueprint**, pick the repo. `render.yaml` creates the web service and a 1 GB disk at `/data`.
3. When it asks for values, set `APP_URL` to the service URL (for example `https://polaris.onrender.com`). Set `DATABASE_URL` to your PostgreSQL connection string (for example from neon.tech).
4. After the first deploy, open **Environment** to read the generated `ADMIN_TOKEN`. Sign in to `/admin` with it, then create your own account at `/login` and give it the admin role from the Accounts panel.

Accounts and records live in PostgreSQL, so they survive redeploys. A persistent disk (paid instance on Render) keeps uploaded files; without it uploads reset on every deploy.

## Railway / Fly.io / any Docker host

```bash
docker build -t polaris .
docker run -p 3000:3000 -v polaris-data:/data -e DATABASE_URL=postgresql://... -e ADMIN_TOKEN=change-me -e APP_URL=https://your.domain polaris
```

Mount a volume at `/data`. Set `DATABASE_URL`, `ADMIN_TOKEN` and `APP_URL`; the rest has defaults (see `.env.example`).

## Not included in the container

- Open-data records come from `server/data/open-data.json`. Refresh it with `npx tsx scripts/import-open-data.ts` and redeploy.

## Android app

`android/` is a Capacitor project. The app opens the POLARIS server (a hosted URL, or your PC on the same Wi-Fi), so every web feature works in it, plus file downloads, camera capture and location.

```bash
npm run android:apk
```

Needs JDK 21 and the Android SDK (`ANDROID_HOME`, or `sdk.dir` in `android/local.properties`). The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. Set `POLARIS_SERVER_URL=https://your.domain` before building to make a hosted server the default; otherwise the app defaults to this PC's Wi-Fi address on port 3000. The address can be changed in the app.
