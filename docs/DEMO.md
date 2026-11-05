# Live demo walkthrough (Demo Freight LLC)

Everything in the demo is fictional. Demo Freight LLC is seeded on the live database at the first boot with
`SEED_DEMO=yes` (see docs/DEPLOY.md). The seed password is printed by the seed and lives only there.

## Logins (seeded)
| Role | Email | Phone |
|---|---|---|
| Owner | owner@demofreight.test | +1 612 555 0100 |
| Office | office@demofreight.test | +1 612 555 0101 |
| Reviewer | reviewer@demofreight.test | +1 612 555 0102 |
| Drivers | driver1..3@demofreight.test | +1 612 555 0111..0113 |

Trucks 101, 102, 103 and the Q4 2026 quarter exist already.

## Files to have on the laptop
From `packages/extraction/golden/`:
- `g001.png` … `g020.png` / `.pdf` — fictional receipts (clean, faded, crumpled, multi-receipt, reefer + DEF, liters/CAD, duplicates).
- `demo-fuel-card-comdata.csv` — a Comdata statement for the quarter (24 rows, includes a reefer and a DEF line).
- `demo-eld-mileage-q4-2026.csv` — the ELD jurisdiction mileage report (long layout).
- `demo-eld-mileage-q4-2026-wide.csv` — the same for units 101/102 in the wide layout (shows the replace flow).

## Flow (about 10 minutes)
1. **Home** — sign in as the owner. The dashboard shows the quarter, counts, open issues.
2. **Inbox** — drag in five receipts (g001, g003, g007, g012, g015). Each row shows its SHA-256 and status. Open one: the
   original opens through a signed link; the audit log records the view.
   With `ANTHROPIC_API_KEY` set, the worker runs two independent passes and the rows flip to Processed within a minute.
3. **Transactions** — open a receipt: every field shows pass A, pass B, the final value and its source. Correct a field
   (reason required) and show the edit history; the original is never overwritten.
4. **Review** — open issues sorted by severity. Resolve one with a note, accept one with a reason.
5. **Fuel & IFTA** — import the Comdata CSV: columns are detected, 24 rows imported, matches to receipts shown, I003 for
   card rows without a receipt. Import the ELD file: 15 rows, totals by jurisdiction and by truck. Import the wide file:
   101/102 rows replaced, nothing deleted, history shows "5 of 15 rows in use".
6. **Worksheet** — with the 2026Q4 rate table loaded, the per-jurisdiction worksheet with fleet MPG, labelled
   PRELIMINARY with the preparer disclaimer. Without the table it shows the I001 block (we never guess rates).
7. **Reports** — generate the transactions CSV and the IFTA worksheet CSV; each has a snapshot hash.
8. **Settings / Vehicles** — Somali toggle; trucks with tank capacity and ELD provider.
9. **Phone** — the capture app (Expo) is not in the store yet; show the camera flow on a simulator if needed.

## What to say when asked
- Nothing is invented: a field the two passes disagree on stays empty and opens V010.
- Reefer fuel and DEF never count as IFTA gallons.
- Rates come only from the loaded official table; every number traces to a receipt line, a card row or an ELD row.
