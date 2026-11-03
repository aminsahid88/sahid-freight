# Deployment (staging first; production untouched until Amin approves)

Branch map: `backoffice` → staging. `newmain` → production (marketplace, tagged `marketplace-final`).
Nothing is pushed to `newmain` or deployed to production without Amin's explicit approval.

## What changed for deployment
- The API is now bundled with esbuild (`apps/api/dist/index.js`, `dist/worker.js`) so workspace packages
  (`packages/core`, `packages/i18n`) ship inside the bundle. `prisma generate` must still run before the build.
- A second long-running process, the worker (`node dist/worker.js`), runs the Postgres-backed job queue.
- The API runs a preflight at boot and refuses to start in production when a required credential is missing.
- New env vars (see `docs/kit-env.example` and `apps/api/src/config/env.ts`):
  `BACKOFFICE_S3_BUCKET`, `BACKOFFICE_S3_REGION`, `S3_ENDPOINT` (R2/MinIO only), `SIGNED_URL_TTL_SECONDS`,
  `ANTHROPIC_API_KEY`, `EXTRACTION_MODEL_A`, `EXTRACTION_MODEL_B`, `RETENTION_YEARS`, `MPG_BAND_MIN/MAX`,
  `MAX_UPLOAD_MB`, `MAX_FILES_PER_BATCH`, `WORKER_POLL_MS`, `LEGACY_MARKETPLACE`.

## Railway (API + worker + Postgres) — staging environment
Railway login is interactive (`railway login`), so these steps need Amin at the keyboard.

1. In the existing Railway project, create an environment `staging` (duplicate of production's variables,
   but pointing at a **new** Postgres service; never reuse the production database).
2. Service `api` (staging): root directory = repository root (the monorepo), because the build needs
   `packages/*`. Build command:
   `npm ci && npx prisma generate --schema=apps/api/prisma/schema.prisma && npm run build -w apps/api`
   Start command: `cd apps/api && npx prisma migrate deploy && node dist/index.js`
   Branch: `backoffice`.
3. Service `worker` (staging): same root and build; start command `cd apps/api && node dist/worker.js`.
   No public domain.
4. Variables for both: everything from `apps/api/.env` plus the new ones above. Set
   `ALLOWED_ORIGINS` to the Vercel preview URL(s). Set `BACKOFFICE_S3_BUCKET` to a **U.S.-region** bucket
   (open decision in `docs/12-decisions-log.md`); until then the API falls back to `AWS_S3_BUCKET`.
5. Verify: `GET /health` is 200 and the boot log shows the preflight table with no FAIL rows.

## Vercel (web) — preview deployment
1. The existing Vercel project builds `apps/web` from `vercel.json` at the root. Vercel builds every branch as
   a preview automatically; the `backoffice` branch preview is the staging web.
2. Set `NEXT_PUBLIC_API_URL` for the Preview environment to the Railway staging API URL.
3. Do **not** promote to production or alias `sahidfreight.com` until the landing copy is approved.

## Gate check on staging (Phase 0)
1. Sign in with a staging-only account, create a company (or seed Demo Freight LLC against the staging DB
   with `DATABASE_URL=<staging> npx ts-node prisma/seed.backoffice.ts` — the seed refuses non-localhost by
   design, so run it from Railway's shell or temporarily relax the guard only there).
2. Upload `packages/extraction/golden/g001.png` from the Inbox.
3. Confirm: the row appears with its SHA-256; the detail drawer opens the original through a signed URL;
   `GET /companies/:id/audit` shows `upload` and `view_document` entries; the worker log shows
   `preprocess -> DONE` and the status flips to Processed.

## Not done yet (needs credentials)
- Creating the Railway staging environment and services (interactive login).
- U.S. S3 bucket.
- CI secrets: none needed; CI uses a Postgres service container.
