# Extraction Contract

## Rules
- Return only JSON matching the schema; no prose.
- Use null for anything not clearly printed. Never infer, estimate, or compute a value the receipt does not show.
- Copy raw text exactly as printed in a raw_text field alongside each normalized value.
- Report a bounding box or region description for each field when possible.
- List every line item separately; do not sum lines yourself.
- If more than one receipt is visible, return an array with one object per receipt.
- Set legibility per field: clear | partial | unreadable.

## Models
Model IDs and prompt versions come from environment/config (e.g. EXTRACTION_MODEL_A, EXTRACTION_MODEL_B). Verify every model ID against the provider's current documentation before use; never hard-code a guessed model name.

## Confidence
Model-reported confidence is a hint, not proof. Status depends on corroboration and rule checks, not on confidence alone.

## Pass B
Pass B must not see pass A's output. Use a different prompt and, ideally, a different model or an OCR-then-parse path. Compare after normalization; disagreements on material fields raise V010.

## JSON schema (both passes)
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ReceiptExtraction",
  "type": "object",
  "required": [
    "receipts"
  ],
  "properties": {
    "receipts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "fields",
          "line_items"
        ],
        "properties": {
          "region_hint": {
            "type": [
              "string",
              "null"
            ]
          },
          "fields": {
            "type": "object",
            "additionalProperties": {
              "type": "object",
              "required": [
                "raw_text",
                "value",
                "legibility"
              ],
              "properties": {
                "raw_text": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "value": {},
                "legibility": {
                  "enum": [
                    "clear",
                    "partial",
                    "unreadable"
                  ]
                },
                "confidence": {
                  "type": [
                    "number",
                    "null"
                  ]
                },
                "bbox": {
                  "type": [
                    "array",
                    "null"
                  ],
                  "items": {
                    "type": "number"
                  }
                }
              }
            },
            "description": "Keys: transaction_date, time, vendor, seller_address, state, unit_number, odometer, driver_name, purchaser_name, payment_method, card_last4, pump_number, receipt_total, currency"
          },
          "line_items": {
            "type": "array",
            "items": {
              "type": "object",
              "required": [
                "description_raw",
                "category"
              ],
              "properties": {
                "description_raw": {
                  "type": "string"
                },
                "category": {
                  "enum": [
                    "motor_fuel",
                    "reefer_fuel",
                    "def",
                    "non_fuel",
                    "tax",
                    "fee",
                    "discount",
                    "credit"
                  ]
                },
                "fuel_type": {
                  "type": [
                    "string",
                    "null"
                  ]
                },
                "quantity": {
                  "type": [
                    "number",
                    "null"
                  ]
                },
                "unit": {
                  "enum": [
                    "gal",
                    "L",
                    "each",
                    null
                  ]
                },
                "unit_price": {
                  "type": [
                    "number",
                    "null"
                  ]
                },
                "amount": {
                  "type": [
                    "number",
                    "null"
                  ]
                }
              }
            }
          }
        }
      }
    }
  }
}
```
