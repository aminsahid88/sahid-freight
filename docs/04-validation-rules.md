# Validation Rules

Every rule is deterministic code with a unit test. LLMs may suggest; only rules and humans decide status.

| Code | Severity | Check |
| --- | --- | --- |
| V001 | error | Required IFTA receipt fields present: date, seller name, seller address/state, gallons, fuel type, amount or price per gallon. |
| V002 | warning | Truck unit number present on the receipt or attributed from another recorded source (receipts lacking it may be challenged in an audit). |
| V003 | warning | Purchaser/company name present on the receipt. |
| V004 | error | Transaction date is valid and within the selected reporting period (or flagged as belonging to another period). |
| V005 | error | State is a valid IFTA jurisdiction code. |
| V006 | warning | Field legibility is 'partial' or 'unreadable'. |
| V007 | warning | Image quality score below threshold. |
| V010 | error | Pass A and Pass B disagree on a material field (date, state, gallons, amounts, fuel type). |
| F001 | error | gallons × unit_price ≈ fuel line amount (tolerance $0.02 or 0.1%). |
| F002 | error | Sum of line items + taxes + fees − discounts ≈ receipt_total (tolerance $0.02). |
| F003 | warning | Diesel unit price outside the plausible range set in config for that date. |
| F004 | warning | Gallons in a single purchase exceed vehicle tank capacity (from vehicle profile) or 300 gal default. |
| F005 | info | Reefer fuel or DEF present; excluded from IFTA motor-fuel gallons pending preparer confirmation. |
| F006 | warning | Units are liters or currency is not USD; converted with the factor/rate shown and source recorded. |
| D001 | warning | Exact duplicate file (same SHA-256). |
| D002 | warning | Likely duplicate transaction: same vendor/location, date, gallons and total within tolerance — evidence listed. |
| D003 | info | Receipt and fuel card row describe the same purchase (expected; merged as corroboration, not counted twice). |
| M001 | error | Vehicle has fuel purchases in the quarter but no mileage records. |
| M002 | warning | Fuel purchased in a jurisdiction where the vehicle shows zero miles that quarter. |
| M003 | warning | Fleet MPG outside the configured plausible band (TEMPORARY DEFAULT 4.0–9.0). |
| M004 | warning | Odometer readings on receipts are not increasing over time for a vehicle, or conflict with ELD miles. |
| I001 | error | IFTA rate table for the quarter is not loaded. |
| I002 | warning | Quarter has unresolved error-severity issues; worksheet must be labeled preliminary. |
| I003 | warning | Fuel card purchase with no matching receipt. |
| I004 | info | Receipt paid by card with no matching card row (statement may be missing). |
| S001 | warning | Document not attributable to a vehicle. |

## Status logic
- Any open **error** → Needs Attention
- Unreadable or unresolvable after review → Unable to Verify
- All required fields corroborated or human-confirmed, no open errors → Verified

## Implementation
Each rule is a pure function in `packages/core/rules/<CODE>.ts` returning `Issue[]`, with a `version` and a test file covering pass and fail cases. Tolerances and bands come from `settings`.
