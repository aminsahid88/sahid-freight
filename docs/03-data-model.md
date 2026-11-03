# Data Model

PostgreSQL. Every tenant-owned table has company_id and is protected by row-level security or an enforced query scope. Money stored as NUMERIC(12,2); gallons as NUMERIC(12,3).

| Table | Purpose |
| --- | --- |
| organizations | Billing/tenant root (a carrier, or a partner firm). |
| companies | Carrier entity: legal name, DBA, USDOT, MC, IFTA base jurisdiction, IFTA account number (encrypted), preferred language, timezone. |
| users | Login identity, phone, email, language. |
| memberships | user ↔ company with role (owner, staff, driver, reviewer, partner). |
| vehicles | Unit number, VIN, plate, axles, weight class, IFTA-qualified flag, tank capacity, ELD provider, active dates. |
| drivers | Name, phone(s), default vehicle, active dates. |
| reporting_periods | Company + type (month/quarter/year) + start/end + status (open, in_review, approved, locked). |
| intake_messages | Raw inbound email/WhatsApp/SMS envelope, sender, channel, attribution result. |
| batches | Upload group with counts and processing status. |
| documents | Original file: storage key, SHA-256, mime, size, channel, uploader, received_at, quality score, retention_until. |
| document_regions | Page/receipt regions within a document. |
| extraction_runs | Per region and pass: model id, prompt version, raw JSON response, tokens, cost, latency, status. |
| extracted_fields | Field name, raw text, normalized value, confidence, legibility, bbox, run id. |
| transactions | Final reconciled record (schema above) with status and corroboration. |
| transaction_lines | Line items by category. |
| fuel_card_imports / fuel_card_transactions | Imported statements and rows with provider mapping version. |
| mileage_imports / mileage_records | Vehicle × jurisdiction × period miles (taxable/non-taxable), source file, provider. |
| matches | Receipt ↔ card row ↔ transaction links with score and fields used. |
| issues | Rule code, severity, evidence JSON, fields, status, resolved_by, resolution note. |
| field_edits | Immutable history: entity, field, old, new, user, reason, evidence, timestamp. |
| approvals | Who approved what (correction, period, report) and when. |
| ifta_rate_tables | Quarter × jurisdiction × fuel type rate and surcharge, source URL, import date. |
| jurisdictions | Codes, names, IFTA membership. |
| station_directory | Known truck stops/fuel stations → address and state (for 'lookup' state resolution). |
| reports | Type, period, snapshot hash, status, file keys, generated_by. |
| audit_log | Append-only log of logins, views of documents, edits, approvals, exports, deletions, admin break-glass. |
| jobs | Background job state for idempotency and retries. |
| settings | Per-company and global config (tolerances, MPG band, price bands, language). |

The draft Prisma schema is in `prisma/schema.prisma`.

## Transaction record shape
```json
{
  "company_id": "string",
  "document_id": "string",
  "source_filename": "string|null",
  "source_page_or_region": "string|null",
  "transaction_date": "YYYY-MM-DD|null",
  "vendor": "string|null",
  "location": "string|null",
  "state": "two-letter US state abbreviation|null",
  "transaction_type": "fuel|expense|refund|credit|other|unknown",
  "fuel_type": "diesel|gasoline|reefer_diesel|def|propane|other|null",
  "gallons": "number|null",
  "unit_price": "number|null",
  "fuel_subtotal": "number|null",
  "taxes": "number|null",
  "fees": "number|null",
  "non_fuel_charges": "number|null",
  "credits": "number|null",
  "receipt_total": "number|null",
  "currency": "ISO currency code|null",
  "extraction_confidence": "number from 0 to 1|null",
  "validation_status": "Verified|Needs Attention|Unable to Verify",
  "issues": [
    {
      "code": "string",
      "severity": "error|warning|info",
      "message": "string",
      "fields": [
        "string"
      ],
      "status": "open|resolved|accepted"
    }
  ],
  "review_notes": "string|null",
  "transaction_id": "string",
  "reporting_period_id": "string",
  "vehicle_id": "string|null",
  "unit_number_raw": "string|null",
  "driver_id": "string|null",
  "odometer": "number|null",
  "time": "HH:MM|null",
  "seller_address": "string|null",
  "state_source": "printed|lookup|user|null",
  "payment_method": "fuel_card|credit_card|cash|other|null",
  "card_last4": "string|null",
  "line_items": [
    {
      "description_raw": "string",
      "category": "motor_fuel|reefer_fuel|def|non_fuel|tax|fee|discount|credit",
      "quantity": "number|null",
      "unit": "gal|L|each|null",
      "unit_price": "number|null",
      "amount": "number|null"
    }
  ],
  "ifta_taxable_gallons": "number|null (motor fuel only, computed by code)",
  "fuel_card_match_id": "string|null",
  "corroboration": "single_source|two_pass|receipt_and_card|human_confirmed",
  "field_provenance": "map of field \u2192 {raw_text, pass_a_value, pass_b_value, final_value, final_source: pass_a|pass_b|human|card|lookup, confidence, bbox}",
  "edit_history_ref": "string",
  "created_at": "timestamp",
  "verified_at": "timestamp|null",
  "verified_by": "user_id|null"
}
```
