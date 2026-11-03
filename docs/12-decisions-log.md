# Decisions Log

Add a row for every decision: date, decision, why, reversible?

## Open decisions (temporary defaults)
| Decision | Temporary default |
| --- | --- |
| Brand name and domain | Use working name in code; keep branding in config. |
| Final pricing | Plans in config as listed; no billing integration yet. |
| WhatsApp Business approval | Start with SMS + email; add WhatsApp when approved. |
| Second-pass extraction method | Second Claude prompt with different instructions; evaluate OCR + parse on the golden set. |
| Hosting region/provider | U.S. region on Railway + Vercel. |
| Who staffs the reviewer role during the pilot | Founder or one trained part-time reviewer. |

## Decided
| Date | Decision | Why |
| --- | --- | --- |
| 2026-11-02 | Software owned by founder's venture; A&H is pilot customer | Keeps IP separate; data-use agreement required |
| 2026-11-02 | First wedge is IFTA quarter, Q4 2026 deadline 2027-02-01 | Hard recurring deadline, clear pain |
| 2026-11-02 | Two-pass extraction + deterministic rules, no self-review | Self-review is not verification |
| 2026-11-02 | English + Somali UI at launch | First customers from Somali/East African community |
| 2026-11-03 | Repurpose the existing Sahid Freight monorepo (`loadlink.et`) instead of a fresh repo; tag `marketplace-final`, build on branch `backoffice` | Amin's call: reuse Railway/Vercel/Prisma/auth/design system/Expo app; nothing to newmain or production without approval |
| 2026-11-03 | Keep npm workspaces (not pnpm) | Lockfile, Railway nixpacks and Vercel are already wired for npm; switching buys nothing now. Reversible. |
| 2026-11-03 | Tests run on Node's built-in `node:test` via `tsx`; no Vitest | The npm registry is blocked from the dev machine (TLS-intercepting proxy returns 403), so no new packages can be installed. `tsx`, `zod`, `sharp`, `esbuild` are already present. Swap to Vitest later if wanted; test files use the standard `*.test.ts` layout. Reversible. |
| 2026-11-03 | Decimal math uses `Decimal` exported from `@prisma/client/runtime/library` (decimal.js) | Satisfies the no-float rule without a new dependency. Reversible. |
| 2026-11-03 | Phase 0 background jobs use a Postgres-backed queue (the `Job` table, `FOR UPDATE SKIP LOCKED`), not Redis + BullMQ | Trade-off: BullMQ/ioredis cannot be installed (registry blocked) and Redis is an extra Railway service. At pilot scale (tens of documents/day) Postgres is enough, keeps idempotency in one transaction with the document row, and the worker interface (`enqueue`, `process`, idempotency key `documentId:step:version`) is kept so BullMQ can replace it in Phase 1 with no caller changes. Reversible. |
| 2026-11-03 | Golden receipts are generated from SVG templates rendered with `sharp`, plus a minimal in-repo PDF writer | Playwright cannot be installed. Output is deterministic and committed. Reversible. |
| 2026-11-03 | Schema merge: kit `User` merges into the existing `User`; kit `Role` becomes `CompanyRole`; kit `Language` reuses existing enum (EN/SO; AM kept but unused); new `Vehicle` table stays separate from marketplace `Truck`; new `Document` separate from `VerificationDocument`; all new tables additive | Only `User` collides by name. `Truck` has required Ethiopia-specific columns (country, city, capacity) so it cannot hold IFTA vehicles cleanly. Expensive to reverse once data exists, flagged to Amin in the audit. |
| 2026-11-03 | Extraction model IDs: `EXTRACTION_MODEL_A=claude-opus-5-5`, `EXTRACTION_MODEL_B=claude-sonnet-5-5` | Verified 2026-11-03 against the Claude API reference (model table cached 2026-10-06). Two different models satisfy the independent-pass rule. Preflight re-checks each ID against `GET /v1/models/{id}` when a key is present. Reversible. |
| 2026-11-03 | Phase 0 auth keeps the existing phone+password login and JWT/refresh flow; email magic link deferred | Reuse rule. Owners who are email-first need `User.phone` to become optional (additive nullable change) — deferred to Phase 1 with Amin's OK. Reversible. |
| 2026-11-03 | Retention: `retentionUntil` = IFTA due date of the quarter containing `receivedAt` (quarter end + 1 month) + `RETENTION_YEARS` (4); recomputed later from the filing date when known | Matches "4 years from the later of due date or filing date"; filing date is unknown at upload. Reversible. |

## Open for Amin (from the 2026-11-03 audit)
| Decision | Why it needs you | Temporary default |
| --- | --- | --- |
| U.S. object-storage bucket/region | Current bucket `sahidfreight-docs` is in eu-north-1; U.S. carrier documents should live in a U.S. region (cost + data-location expectations) | New env `BACKOFFICE_S3_BUCKET`/`BACKOFFICE_S3_REGION`; falls back to the existing bucket for local testing |
| Unblock the npm registry on the dev machine | Blocks Vitest, BullMQ, Anthropic SDK, Playwright installs | Build with what is installed (see decisions above) |
| Make `User.phone` optional | Owners signing up by email cannot register today | Deferred to Phase 1 |
| 2026-11-03 | Marketplace code archived behind flags: API `LEGACY_MARKETPLACE` (default true; routes for loads/bookings/trucks/tracking/uploads/drivers/bids/messages/payments are not mounted when false) and web `NEXT_PUBLIC_LEGACY_MARKETPLACE` (default true; when false the dashboard/driver/tracking/admin marketplace routes redirect to /office). Files stay in place for Phase 3 reuse. | Amin's rule: archive, don't delete. A flag keeps the diff small and reversible; a `legacy/` move can follow once the Phase 0 gate passes on staging. Reversible. |
