# Roadmap

| Phase | Target | Ships | Gate |
| --- | --- | --- | --- |
| 0 — Foundations | 2026-11-16 | Repo, auth, companies/vehicles/drivers, document storage, audit log, golden dataset. | Upload → stored → visible with hash and audit entry. |
| 1 — Document & Audit Center + IFTA worksheet | 2027-01-15 | All phase-1 intake channels, two-pass extraction, rule catalog, card matching, mileage import, review, PDF/CSV/ZIP, IFTA worksheet, English + Somali. | A&H Q4 2026 worksheet matches their filer's numbers or every difference is explained. |
| 1b — Pilot | 2027-01-15 to 2027-03-31 | A&H plus 5–10 community carriers. | ≥ 5 paying carriers; touchless ≥ 70%; owners report hours saved. |
| 2 — Books & cost per mile | Q2 2027 | Bank/card import, expense categories, monthly P&L, cost per mile per truck, accountant export. | Pilots use it monthly without reminders. |
| 3 — Revenue & settlements + ELD/fuel-card APIs | Q3 2027 | Loads, invoices, AR, driver settlements, Motive/Samsara and fuel card integrations. | Retention ≥ 80% after two quarters. |
| 4 — Compliance & year-end | Q4 2027 | Compliance calendar (IFTA, IRP, UCR, HVUT 2290, permits), vehicle/maintenance records, year-end tax package, partner portal for bookkeepers. | First partner firm onboarded with ≥ 10 carriers. |

## Phase 0 task list (target 2026-11-16)
1. Monorepo scaffold (pnpm workspaces): apps/web, apps/api, apps/worker, packages/db, core, extraction, reports, i18n. TypeScript strict, ESLint, Prettier, Vitest.
2. `.env` loading with a startup preflight that checks every credential and fails with a readable message.
3. Prisma schema from `prisma/schema.prisma`; first migration; seed fictional "Demo Freight LLC" (3 trucks, 3 drivers, Q4 2026 period).
4. Auth (email magic link or password + phone OTP later); Company, Membership with roles; tenant scoping helper + cross-company access tests.
5. Object storage client with signed URLs; upload endpoint storing originals with SHA-256 and `retentionUntil`.
6. Documents inbox page (web) with upload, list, preview, status; mobile layout.
7. Append-only audit log for login, upload, view, edit, export.
8. Redis + BullMQ worker skeleton with one idempotent no-op `preprocess` job.
9. i18n wiring with `locales/en.json` and `locales/so.json`; language switcher.
10. Golden dataset folder with the first 20 fictional receipts and expected JSON.
11. CI: lint, typecheck, test on every push.
12. Deploy web + api + worker to staging; verify upload works on the deployed URL.

**Gate:** upload → stored → visible with hash and audit entry, on staging.

## Phase 1 order
Extraction pass A → golden-set evaluator → pass B + reconciliation → normalization → rules → review UI → fuel card import + matching → ELD mileage import → IFTA worksheet → PDF/CSV/ZIP → email + SMS intake → reviewer console → Somali strings complete.

## Pilot (A&H)
- One full quarter of paperwork: fuel receipts, fuel card statements, expense receipts, settlements, invoices.
- The ELD's IFTA mileage report for that quarter.
- Number of trucks, unit numbers and states run.
- Every vendor they pay today for software, bookkeeping, IFTA and factoring, with monthly cost.
- Their last filed IFTA return for comparison.
- A signed data-use agreement.
- 30 minutes of feedback weekly; introductions to 3–5 other owners.

Success: Q4 2026 worksheet delivered before 2027-02-01.; Owner spends under 30 minutes per month on paperwork after onboarding.; Zero invented values found in review.

Kill/pivot: If by 2027-04-30 fewer than 5 carriers pay, or touchless rate stays below 50%, stop and reassess the wedge (e.g. sell to bookkeepers first).
