/**
 * The extraction contract (docs/06-extraction-contract.md) as a zod schema.
 * Both extraction passes must return JSON matching `ReceiptExtraction`; the
 * golden dataset's expected files use the same shape so the Phase 1 evaluator
 * compares like with like.
 */
import { z } from "zod";

export const legibility = z.enum(["clear", "partial", "unreadable"]);
export type Legibility = z.infer<typeof legibility>;

export const extractedField = z.object({
  raw_text: z.string().nullable(),
  value: z.unknown(),
  legibility,
  confidence: z.number().min(0).max(1).nullable().optional(),
  bbox: z.array(z.number()).nullable().optional(),
});
export type ExtractedField = z.infer<typeof extractedField>;

export const FIELD_KEYS = [
  "transaction_date",
  "time",
  "vendor",
  "seller_address",
  "state",
  "unit_number",
  "odometer",
  "driver_name",
  "purchaser_name",
  "payment_method",
  "card_last4",
  "pump_number",
  "receipt_total",
  "currency",
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

/** Fields that decide money and IFTA outcomes; disagreement between passes raises V010. */
export const MATERIAL_FIELDS: readonly FieldKey[] = ["transaction_date", "state", "receipt_total", "currency", "vendor"];

export const lineCategory = z.enum(["motor_fuel", "reefer_fuel", "def", "non_fuel", "tax", "fee", "discount", "credit"]);

export const lineItem = z.object({
  description_raw: z.string(),
  category: lineCategory,
  fuel_type: z.string().nullable().optional(),
  quantity: z.number().nullable().optional(),
  unit: z.enum(["gal", "L", "each"]).nullable().optional(),
  unit_price: z.number().nullable().optional(),
  amount: z.number().nullable().optional(),
  legibility: legibility.optional(),
});
export type LineItem = z.infer<typeof lineItem>;

export const receipt = z.object({
  region_hint: z.string().nullable().optional(),
  fields: z.record(z.string(), extractedField),
  line_items: z.array(lineItem),
});
export type Receipt = z.infer<typeof receipt>;

export const receiptExtraction = z.object({
  receipts: z.array(receipt),
});
export type ReceiptExtraction = z.infer<typeof receiptExtraction>;

/** A golden fixture: the contract output plus bookkeeping for the evaluator. */
export const goldenExpected = receiptExtraction.extend({
  id: z.string(),
  variant: z.string(),
  file: z.string(),
  notes: z.string().optional(),
});
export type GoldenExpected = z.infer<typeof goldenExpected>;
