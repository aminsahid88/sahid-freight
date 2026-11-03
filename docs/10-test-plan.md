# Test Plan

## Golden dataset
Create at least 60 fictional receipt images and PDFs with known correct answers: clean, faded thermal, crumpled, angled, multi-receipt photo, multi-page PDF, reefer + tractor fuel on one receipt, DEF, liters/CAD, missing unit number, duplicates, refunds/credits, and a matching fuel card CSV and ELD mileage CSV for a fictional 3-truck fleet quarter.

Store under `packages/extraction/golden/` as `<id>.<ext>` + `<id>.expected.json`.

## Automated tests
- Every validation rule (pass and fail cases).
- IFTA math with decimal rounding against hand-calculated fixtures.
- Receipt ↔ card matching including near-misses.
- Duplicate detection (exact and likely).
- Tenant isolation (cross-company access must fail).
- Edit history immutability.
- Report regeneration from snapshot is byte-identical in data.
- Extraction regression run against the golden set with an accuracy report on every prompt/model change.

## Metrics
- **quality:** Field accuracy vs golden set (target ≥ 98% on material fields); Touchless rate: % receipts Verified with no human edit (target ≥ 70% at pilot end); False-verified rate: Verified records later corrected (target < 0.5%)
- **speed:** Median time from upload to Verified; Time from last document to period report
- **cost:** AI cost per document; Reviewer minutes per document
- **customer:** Weekly active companies; Documents per truck per week; Owner hours saved (self-reported); Retention after two quarters

## Rule
Never publish accuracy numbers that were not measured on the golden set or real pilot data.

## Acceptance criteria
- A user can upload multiple fuel receipts for one company and reporting period.
- Every transaction links to its source document.
- Missing and uncertain fields are flagged instead of invented.
- Likely duplicate receipts are flagged with explanations.
- State-by-state gallons are calculated from supported records only.
- Fuel charges are separated from non-fuel charges and credits where supported.
- PDF reports identify the company, reporting period, generation date, and review status.
- Users can correct extracted data while preserving the original value and change history.
- Users can download PDF and CSV deliverables.
- The app works on desktop and mobile layouts.
- Automated tests cover calculations, rounding, duplicate detection, missing data, and conflicting records.
- A driver can send a receipt photo by SMS/WhatsApp or email and it appears in the company's inbox attributed to the right truck or is flagged S001.
- A fuel card CSV can be imported with a saved mapping and matched to receipts without double-counting gallons.
- An ELD mileage report can be imported and the IFTA worksheet computes fleet MPG and per-jurisdiction net gallons with decimal math matching hand-calculated fixtures.
- Reefer fuel and DEF are never included in IFTA motor-fuel gallons.
- Every material field shows both extraction passes and the final source.
- The worksheet and report say PRELIMINARY while any error-severity issue is open.
- Owner-facing screens and notifications are available in English and Somali.
- Cross-company data access attempts fail in automated tests.
- Documents cannot be hard-deleted inside their retention period.
