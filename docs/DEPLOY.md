# Deployment

Branch map: `backoffice` → the live site (Amin's decision on 2026-11-05: the marketplace is retired, the back
office goes live for the demo). `newmain` still holds the marketplace, tagged `marketplace-final`.

## Shape (2026-11-08, live)
- One Railway service runs the API **and** the job queue (`WORKER_IN_PROCESS=true`). Split the worker into its
  own service (`node dist/worker.js`, no public domain) when load grows.
- The Railway service's root directory is `apps/api`, so the bundle is built **locally** (`npm run build` in
  `apps/api` → `dist/index.js`, `dist/worker.js`, `dist/seed.backoffice.js`, shared packages inlined) and uploaded
  with `railway up --service sahid-freight --detach` from `apps/api`. `apps/api/.gitignore` re-includes `dist/`
  for the upload; never commit it. (`railway.json` at the repo root is the alternative when the service root is
  changed to the monorepo root.)
- Documents are stored on a Railway volume mounted at `/data` (`STORAGE_DRIVER=local`,
  `LOCAL_STORAGE_DIR=/data/documents`, `STORAGE_LOCAL_PERSISTENT=true`, `API_URL=<public API URL>`); the preflight
  only allows the local driver in production when the directory is on a mounted volume. Move to a U.S. S3 bucket
  when a working AWS key exists.
- The service is also connected to GitHub: a push to its configured branch redeploys from git. Do not push the
  marketplace branch (`newmain`) while the live service runs the back office. To deploy from git instead of the CLI,
  set the service's Source branch to `backoffice` and its Root Directory to `/` (the repo root `railway.json` then
  builds the bundle on Railway).
- An empty `worker` service exists for the queue split; it can only take over once storage is on S3, because it
  cannot read the API's volume. Until then keep `WORKER_IN_PROCESS=true` on `sahid-freight`.
- The API is bundled (`apps/api/dist/index.js`, `dist/worker.js`); `prisma generate` runs before the build and
  `prisma migrate deploy` runs at start. Every migration since the pivot is additive.
- The API runs a preflight at boot and refuses to start in production when a required credential is missing.

## Railway (API + queue + Postgres)
Railway login is interactive (`railway login`, from any folder); the CLI token expires, so log in first.

1. Variables on the `api` service (everything the marketplace had, plus):
   - `ALLOWED_ORIGINS=https://sahidfreight.com,https://www.sahidfreight.com` (preflight fails when empty)
   - `JWT_SECRET` / `JWT_REFRESH_SECRET`: at least 32 random characters each, different from each other
   - `WORKER_IN_PROCESS=true`
   - `ANTHROPIC_API_KEY` (set by Amin in the Railway dashboard; never in chat or git) — without it receipts stay
     in PROCESSING and only the deterministic features work
   - optional: `EXTRACTION_MODEL_A` / `EXTRACTION_MODEL_B` (defaults claude-opus-5-5 / claude-sonnet-5-5),
     `AI_MONTHLY_BUDGET_USD`, `BACKOFFICE_S3_BUCKET` (falls back to `AWS_S3_BUCKET`)
2. From `apps/api` after `npm run build`: `railway up --service sahid-freight --detach`, then
   `railway logs -d -n 120 <deployment id>` until the preflight table (no FAIL rows) and `API running on port`.
3. `GET https://<api>/health` → 200.

## Vercel (web)
1. The root is linked to project `sahid-freight` (www.sahidfreight.com); root `vercel.json` builds `apps/web`
   from the workspace and `.vercelignore` keeps the upload small.
2. Preview: `vercel --yes --archive=tgz`. Production: `vercel --prod --yes --archive=tgz`.
3. `NEXT_PUBLIC_API_URL` is set on the project for every environment (the Railway API URL).

## Demo data on the live database
The production database is not reachable from the dev machine, so the seed runs inside the container: set
`SEED_DEMO=yes` on the service, deploy, then set it back to `no`. It upserts the fictional Demo Freight LLC
(3 trucks, owner/office/reviewer/driver accounts, Q4 2026 period) and nothing else. Done on 2026-11-08.

## Known gaps for the live demo
- The official IFTA rate table for 2026Q4 must be loaded by a platform admin through
  `POST /admin/ifta-rates` (iftach.org is unreachable from the dev machine). Until then the worksheet shows I001.
- No worker/API split, no U.S.-region S3 bucket yet (open decision), PDF/ZIP reports not built.

## Rate tables

Official IFTA rate tables live in `apps/api/rates/<quarter>-<fuelType>.csv` and load themselves on API boot (see `docs/ifta-rates/README.md`). To update a quarter, edit the file, bump `# version=`, build and `railway up`. The boot log prints `Rate tables: 2026Q4/diesel inserted (47)` (or `unchanged`, `updated`, `admin_table_kept`).
