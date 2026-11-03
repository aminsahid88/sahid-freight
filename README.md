# AI Trucking Back-Office Platform

Turns a small carrier's paperwork (fuel receipts, fuel-card statements, ELD mileage) into verified,
audit-ready records and a preparer-ready IFTA worksheet. Every number is traceable to its receipt;
nothing is invented. Product spec: `docs/` (`docs/00-master-prompt-v2.json` is the source of truth).

This repository was the Sahid Freight freight marketplace until November 2026 (tag `marketplace-final`).
The marketplace code is archived behind the `LEGACY_MARKETPLACE` flags, not deleted.

## Repository structure

- `apps/api/` — Express + Prisma API and the background worker (Railway)
- `apps/web/` — Next.js dashboard for owners, office staff and reviewers (Vercel). Back-office screens live under `/office`
- `apps/mobile/` — Expo app (becomes the driver/owner receipt-capture app in Phase 1)
- `packages/core/` — pure domain logic: decimal math, periods and retention, upload validation (unit-tested, no I/O)
- `packages/i18n/` — English and Somali UI strings
- `packages/extraction/` — extraction contract and the fictional golden dataset (`golden/`)
- `docs/` — product brief, architecture, data model, rules, roadmap, decisions log, deploy notes

## Local development

Requirements: Node 20 (`.nvmrc`), Docker (Postgres), npm.

```bash
npm install                      # workspaces; registry access needed only for new dependencies
docker compose up -d postgres    # local Postgres on localhost:5432
npm run db:migrate               # guarded: refuses non-localhost databases
npm run db:seed                  # marketplace fixtures + fictional "Demo Freight LLC" (3 trucks, 3 drivers)
npm run dev:api                  # API on :8000 against apps/api/.env.local
npm run dev:web                  # web on :3000 (NEXT_PUBLIC_API_URL=http://localhost:8000)
npm run worker:local -w apps/api # background worker
npm test                         # all workspaces; API tests use the loadlink_test database
npm run typecheck
```

Demo login (local only): phone `+16125550100`, password `DemoFreight123!`, then open `/office`.

Danger: `apps/api/.env` is the production environment. Use the `*:local` scripts, which load `.env.local`.

## Deployment

See `docs/DEPLOY.md`. Branch `backoffice` deploys to staging; `newmain` is production and is not touched
without approval.
