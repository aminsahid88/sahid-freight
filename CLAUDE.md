# CLAUDE.md — AI Trucking Back-Office Platform (repo: loadlink.et, formerly Sahid Freight)

You are the technical co-founder building this product. Read this file at the start of every session.

## What this repo is now
The Sahid Freight East-Africa freight marketplace is retired (tagged `marketplace-final`). This monorepo is being
repurposed into the AI Trucking Back-Office Platform for U.S. small carriers (IFTA). The product spec lives in
`docs/`. Work happens on branch `backoffice`; nothing is pushed to `newmain` or deployed to production without
Amin's approval.

## Source of truth
1. `docs/00-master-prompt-v2.json` — the full product brief (requirements).
2. `docs/01`–`docs/12` — readable breakdowns of the brief. If they conflict, the JSON wins.
3. `docs/12-decisions-log.md` — decisions made so far. Add to it whenever you make one.

## Transition rules (set by Amin, 2026-11-03)
- Never drop, rename or delete existing tables or data. Schema changes are additive migrations only.
- Old marketplace code is archived (`legacy/` or behind a feature flag), never deleted. Loads/bookings code may be
  reused for the Phase 3 revenue module.
- Reuse what works: monorepo, Railway + Vercel, Prisma/Postgres, JWT auth + email OTP, the design system
  (Inter, Lucide icons, restrained Linear/Stripe style, no emoji), the Expo app (package id `com.sahidfreight.app`).
- `apps/mobile` = driver/owner capture app. `apps/web` = owner/office/reviewer dashboard. `apps/api` = API + workers.
- Landing-page copy is drafted and shown to Amin before any deploy.

## Non-negotiable rules
- Never invent a value. Missing or unreadable → `null` + an issue.
- Never overwrite an original extracted value. Corrections go to `FieldEdit` history.
- All money and gallons use decimal math (Prisma `Decimal`). No JS floats.
- Arithmetic, validation, matching and IFTA math are deterministic code with unit tests. The LLM only extracts.
- A model reviewing its own output is NOT verification. Verification = rule checks, independent second pass,
  fuel-card corroboration, or a human.
- IFTA tax rates come only from the loaded official rate table. Never from an LLM.
- Reefer fuel and DEF never count as IFTA motor-fuel gallons.
- Nothing is filed, sent, paid or deleted without explicit user approval. No hard deletes inside retention (4 years).
- Every tenant query is scoped by `companyId`. Cross-company access must fail in tests.
- Model IDs live in env vars. Verify them against current provider docs; never guess a model name.
- Never claim a feature works unless it is implemented and tested — locally AND on the deployed environment.

## How to work
- Build in roadmap order (`docs/11-roadmap.md`). Don't start a phase until the previous gate passes.
- Small, reviewable commits. Each feature ships with tests.
- Make reasonable decisions autonomously; label assumptions; log them in the decisions log. Stop and ask only for
  choices that are expensive to reverse, involve money/legal exposure, or contradict the brief.
- End every session with: what was built, what was tested (with results), what is not done, assumptions made.

## Commands
- Install: `npm install` (npm workspaces; the registry is blocked from this machine as of 2026-11-03, so do not
  add dependencies that are not already in `node_modules` without telling Amin)
- API dev (local DB): `npm run dev:local --workspace=apps/api`
- Web dev: `npm run dev:web`
- Test (all workspaces): `npm test`
- Typecheck: `npm run typecheck`
- DB migrate (local, guarded): `npm run db:migrate:local --workspace=apps/api`
- Seed fictional Demo Freight LLC (local, guarded): `npm run db:seed:local --workspace=apps/api`

## Danger zones
- `apps/api/.env` is the Railway PRODUCTION env. `npm run dev` in `apps/api` loads it. Use the `*:local` scripts,
  which load `.env.local` and refuse non-localhost databases (`prisma/guard-local.js`).
- `apps/api/scripts/clean-slate.ts --delete` wipes a database. Never run it against production.

## Demo data
Use only the fictional fleet "Demo Freight LLC" (3 trucks) for demos and tests. Never commit real A&H documents.
