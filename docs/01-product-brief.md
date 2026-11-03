# Product Brief

**Mission:** Help trucking companies run their back office by turning documents into organized, verified, actionable business records.

**Promise:** Send us your paperwork. Every month you get clean books and IFTA-ready numbers, checked by AI and confirmed by a person, with every number traceable to its receipt.

**Guiding rule:** The owner never types data. They send documents, approve results, and download deliverables.

**Stance:** Do not try to replace the ELD, fuel card, dispatch or factoring provider. Ingest their outputs and become the verified record that sits on top of them.

## Customer
- Primary: U.S. for-hire carriers with 1–10 power units running interstate (IFTA-licensed), where the owner does the back office personally.
- First 50: Somali and East African owner-operators and small fleets reached through the founder's network, community groups and referrals.
- Secondary buyer: Trucking bookkeepers and IFTA/permit service firms who manage many carriers and need clean, traceable paperwork (partner role, multi-company access).
- Not now: Mid-size and enterprise fleets, brokers, intrastate-only carriers, Canadian-based carriers.

## Key dates
- 2026-11-02 (Q3 2026 IFTA returns due today)
- Pilot ready: 2027-01-15
- 2027-02-01 — Q4 2026 IFTA returns due. The pilot must deliver a complete, preparer-ready Q4 2026 IFTA package for A&H before this date.

## Service model
Hybrid AI + human service. AI extracts and checks everything; an internal reviewer resolves flagged items within an SLA; the owner approves anything consequential.

| Role | Can |
| --- | --- |
| Owner | See everything for their company, approve corrections, approve and download reports, manage users, vehicles and drivers. |
| Office staff | Upload, review and correct; cannot approve final reports unless granted. |
| Driver | Submit documents via phone camera, WhatsApp, SMS or email; see only their own submissions and statuses. |
| Reviewer (internal ops) | Work the cross-company review queue for assigned companies; resolve flags; every action logged; cannot export or delete customer data. |
| Partner (bookkeeper) | Access multiple client companies they are invited to; same rights as office staff per company. |
| Platform admin | Manage tenants, plans, rate tables and system config; access customer documents only through a logged break-glass action. |

Review SLA (temporary default): Flagged items resolved within 1 business day; quarter-end packages within 2 business days of the last document.

### Reviewer console
- Queue across assigned companies, sorted by deadline and severity.
- Side-by-side source image (zoomable, with highlighted field region) and extracted fields from both passes.
- One-click accept pass A / accept pass B / enter value / mark unreadable / request info from customer.
- Requests to the customer go out as a message in their chosen channel and language.
- Track reviewer minutes per document as a cost metric.

## MVP: Document Processing and Audit Center (with IFTA-ready output)
A trucking owner can upload a batch of receipts and receive an organized transaction ledger, state-by-state fuel summary when supported, an exception list, and a professional downloadable report with source documents. For IFTA, combine verified fuel purchases with imported jurisdiction mileage to produce a preparer-ready quarterly worksheet, clearly labeled preliminary until reviewed.

### In scope
- All intake channels marked phase 1
- Two-pass extraction with field-level provenance
- Validation rule catalog (codes V/F/D/M/I below)
- Receipt ↔ fuel card matching
- ELD mileage import and jurisdiction summaries
- Review queue (owner + internal reviewer) with edit history
- PDF report, CSV export, supporting-document package, IFTA worksheet
- Audit log, 4-year retention, English and Somali UI

### Out of scope
- Filing any return with any jurisdiction
- Payments, billing and subscriptions
- Direct ELD/fuel card APIs
- Invoicing, settlements, maintenance, full bookkeeping (later phases)
- Native iOS/Android apps (PWA only)

### Pipeline

**1. Intake**
- Allow multiple documents per batch.
- Associate uploads with a company and reporting period.
- Show progress, failures, and processing status.
- Preserve the original files unchanged.
- Accept documents from every phase-1 channel into one pipeline.
- Compute a SHA-256 hash of every original file; identical hashes are flagged as exact duplicates (D001) but still stored and linked.
- Store originals immutably in object storage; all processing works on derived copies.

**2. Pre-process**
- Split multi-page PDFs into pages; detect multiple receipts in one image and create one region per receipt.
- Run an image quality check (blur, glare, crop, resolution) and record a quality score; poor images trigger a re-capture request rather than a guess.
- Rotate and deskew derived copies only.

**3. Extract — two independent passes**
- Extract merchant, transaction date, location, state, fuel type, gallons, unit price, fuel subtotal, taxes, fees, parking, other charges, credits, currency, and receipt total when present.
- Record source filename and page or region reference where possible.
- Store original extracted text/value separately from normalized values.
- Use null for missing or unreadable values; never invent them.
- Track confidence per field and flag low-confidence fields for review.
- Pass A: vision-capable LLM reads the image and returns JSON matching the extraction contract.
- Pass B: an independent read using a different prompt and either a different model or an OCR-text-then-parse path. Pass B must not see Pass A's output.
- For every field store: raw text as printed, normalized value, confidence, bounding box/page reference, pass id, model id and prompt version.
- Fields where passes agree (after normalization) are 'corroborated'; fields that disagree raise V010 and go to review.
- Also extract when present: truck/unit number, odometer, driver name, card last 4, payment method, pump number, reefer fuel and DEF lines, purchaser name, seller address.

**4. Normalize and classify**
- Normalize dates, state abbreviations, currency, and measurement units.
- Classify fuel charges separately from non-fuel charges, taxes, fees, parking, credits, and refunds when evidence supports it.
- Keep source values available for comparison.
- Do not assume receipt total equals fuel spend.
- Split a receipt into line items: motor fuel (diesel, gasoline), reefer fuel, DEF, other non-fuel, taxes, fees, discounts/credits.
- Treat reefer fuel and DEF as separate fuel types; never add them to IFTA motor-fuel gallons. Flag for preparer confirmation.
- Resolve state from the printed address; if only a city or station number is present, use a station directory lookup and mark the source as 'lookup'.

**5. Validate**
- Flag likely duplicate documents and explain the matching evidence.
- Check arithmetic when line items and totals are available.
- Flag missing, conflicting, unreadable, or suspicious values.
- Check date, state, unit, and total consistency where possible.
- Link every issue to the relevant source document and field.
- Do not silently delete, merge, or overwrite records.
- Run every rule in validation_rule_catalog; rules are deterministic code, versioned, and each produces an issue with code, severity, evidence and the fields involved.
- Status logic: any error-severity issue → Needs Attention; unreadable or unresolvable after review → Unable to Verify; all required fields corroborated or human-confirmed and no open errors → Verified.

**6. Match and reconcile**
- Calculate supported totals by state and reporting period.
- Separate gallons, fuel amounts, non-fuel charges, taxes, fees, credits, and overall receipt totals.
- Show calculation formulas, included records, excluded records, and unresolved differences.
- Preserve edit history when users correct values.
- Label results preliminary until required information is reviewed and complete.
- Match receipts to fuel card rows by date (±1 day), gallons (±0.5%), amount (±$0.50) and state/location; record match score and the fields used.
- Matched pairs become one fuel purchase with two pieces of evidence (corroboration).
- Unmatched card rows → I003 'card purchase with no receipt'. Unmatched receipts paid by card → I004.
- Import ELD jurisdiction miles per vehicle; reconcile total miles against odometer readings where available (M001–M004).

**7. Human review**
- Use statuses Verified, Needs Attention, and Unable to Verify.
- Provide a review queue for uncertain fields and exceptions.
- Allow users to open the source document from each transaction.
- Require explicit approval for material corrections and consequential actions.
- Two-tier review: internal reviewer resolves extraction flags; owner approves material corrections and final reports.
- Every correction stores old value, new value, who, when, why and evidence; original extracted values are never overwritten.

**8. Deliver**
- Generate a professional PDF summary.
- Include company, reporting period, totals, state-by-state gallons where supported, exceptions, and reconciliation notes.
- Allow original receipts to be appended or included as a supporting-document package.
- Show report generation date and preliminary/reviewed status.
- Provide CSV export for structured records.
- Produce: period PDF report, transactions CSV, supporting-document package (ZIP with index), IFTA quarterly worksheet (PDF + CSV).
- Every deliverable records the data snapshot it was built from, so it can be regenerated identically.
- Notify the owner when a deliverable is ready, in their language and channel.

## Pages
- **Dashboard:** Recent batches, processing status, pending reviews, summary metrics, and alerts.
- **Documents:** Upload, search, filter, preview, and manage source files.
- **Transactions:** Structured transaction ledger with source links, confidence, and edit history.
- **Audit Center:** Duplicate candidates, missing fields, arithmetic issues, mismatches, and exceptions.
- **Reports:** Generate, preview, and download PDF reports and CSV exports.
- **Company Settings:** Manage company profiles, reporting preferences, trucks, users, and permissions.
- **Home:** What needs me now: items awaiting owner approval, next deadline countdown (e.g. 'Q4 IFTA due Feb 1'), documents received this week, % verified, missing receipts.
- **Inbox (Documents):** All incoming documents from every channel with channel icon, status, thumbnail, attribution; 'Unassigned' tab.
- **Review:** Owner approval queue; reviewers see the cross-company console. Side-by-side source and fields.
- **Fuel & IFTA:** Quarter workspace: fuel by state, mileage import, card matching, MPG, worksheet preview, issues blocking 'Reviewed'.
- **Vehicles & Drivers:** Unit profiles, tank capacity, ELD provider, driver phones for WhatsApp/SMS attribution.

## Design principles
- Built for a busy owner on a phone: large tap targets, one primary action per screen, plain words, no accounting jargon without explanation.
- Every number is tappable and opens its source evidence.
- Status colors are consistent everywhere: Verified (green), Needs Attention (amber), Unable to Verify (red/grey), with text labels for accessibility.
- All UI strings externalized for i18n; English and Somali at launch; dates, money and numbers localized.
- Loading, empty, success and error states on every screen.
- WCAG 2.1 AA contrast and keyboard navigation on desktop.

## Notifications
- Document received (optional, per channel).
- Information needed (e.g. 'Which truck was this?') with one-tap or one-word reply.
- Report ready / approval needed.
- Deadline reminders: 30, 14, 7 and 2 days before each IFTA due date.
- Messages are sent in the user's language and channel; respect quiet hours.

## Market context
- Fleets of 1–6 tractors are about 86% of U.S. carriers; fleets of 7–19 are another 9%. (https://www.freightwaves.com/news/small-carriers-owner-operators-remain-lifeblood-of-transportation-during-market-downturn)
- About 88,000 carrier authorities were lost between January 2025 and February 2026; surviving carriers are cost-sensitive. (https://truckdispatchexperts.com/resources/carrier-exodus-reshaping-freight-2026/)
- IFTA records must be kept 4 years from the return due date or filing date, whichever is later; burden of proof is on the carrier. (https://www.cpapracticeadvisor.com/?p=192588)
- Fuel receipts missing required details can be disallowed as tax-paid credits in an audit. (https://Tax.Colorado.Gov/sites/tax/files/Excise%2010.pdf)
- Software: Rigbooks $19–$149/mo; TruckingOffice $25–$90/mo; TruckLogics $39.95–$249.95/mo plus ~$20–$25 per IFTA report. (https://toolradar.com/tools/rigbooks ; https://toolradar.com/tools/truckingoffice ; https://www.rfp.wiki/supply-chain-logistics-transportation/transportation-logistics/trucking-erp-software/truckbase/trucklogics)
- Trucking-specialist bookkeepers charge about $200–$450/mo. (https://loadwrap.com/services/company/owner-operator-books-llc-2)
- Factoring costs small carriers roughly 2–5% of invoice value. (https://otrucking.com/resources/guides/freight-factoring-rates-2026/)
- Funded AI-native players (Datatruck $12M Series A, Bubba, Transflo Workflow AI) target growing and mid-size fleets willing to replace their whole system. (https://seedtable.com/companies/datatruck/funding-rounds/series-a-2026-01)

## Success
A trucking owner can upload a batch of receipts, get an organized and traceable transaction ledger, understand flagged problems, review the results, and export a professional report without manually organizing every receipt. A small-fleet owner sends paperwork from their phone, never types data, and receives a verified, audit-ready monthly report and a preparer-ready IFTA worksheet on time — with every number traceable to its source and nothing invented.
