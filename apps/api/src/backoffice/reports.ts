/**
 * Deterministic CSV builders for reports. Pure: plain rows in, CSV text out,
 * no timestamps of generation, so the same data always hashes the same
 * (Report.snapshotHash = sha256 of the bytes).
 */
import { createHash } from "node:crypto";
import { type Decimal, formatFixed, type IftaWorksheetJson, toCsv, toDecimal, toIsoDate, ZERO } from "@tbo/core";

/** Column order fixed by docs/08-deliverables-spec.md. */
export const TRANSACTIONS_CSV_COLUMNS = [
  "transaction_id",
  "status",
  "date",
  "time",
  "vendor",
  "seller_address",
  "state",
  "state_source",
  "vehicle_unit",
  "driver",
  "fuel_type",
  "gallons",
  "unit_price",
  "fuel_amount",
  "reefer_gallons",
  "def_gallons",
  "non_fuel_amount",
  "taxes",
  "fees",
  "credits",
  "receipt_total",
  "payment_method",
  "card_last4",
  "card_match_id",
  "corroboration",
  "open_issue_codes",
  "source_document_id",
  "source_filename",
  "source_page",
  "last_edited_by",
  "last_edited_at",
] as const;

export type DecimalLike = Decimal | string | null;

export interface CsvLine {
  category: string;
  fuelType: string | null;
  quantity: DecimalLike;
  unitPrice: DecimalLike;
  amount: DecimalLike;
}

export interface TransactionCsvRow {
  id: string;
  status: string;
  date: Date | null;
  time: string | null;
  vendor: string | null;
  sellerAddress: string | null;
  state: string | null;
  stateSource: string | null;
  vehicleUnit: string | null;
  driver: string | null;
  lines: CsvLine[];
  receiptTotal: DecimalLike;
  paymentMethod: string | null;
  cardLast4: string | null;
  cardMatchId: string | null;
  corroboration: string;
  openIssueCodes: string[];
  sourceDocumentId: string | null;
  sourceFilename: string | null;
  sourcePage: number | null;
  lastEditedBy: string | null;
  lastEditedAt: Date | null;
}

function sumOf(lines: CsvLine[], categories: string[], field: "quantity" | "amount"): Decimal | null {
  let acc = ZERO;
  let any = false;
  for (const l of lines) {
    if (!categories.includes(l.category) || l[field] === null) continue;
    acc = acc.plus(toDecimal(l[field] as Decimal | string));
    any = true;
  }
  return any ? acc : null;
}

const fixed = (v: Decimal | string | null, places: number): string => (v === null ? "" : formatFixed(v, places));

export function transactionCsvCells(t: TransactionCsvRow): Array<string | number> {
  const motor = t.lines.filter((l) => l.category === "MOTOR_FUEL");
  const firstMotor = motor[0];
  return [
    t.id,
    t.status,
    t.date ? toIsoDate(t.date) : "",
    t.time ?? "",
    t.vendor ?? "",
    t.sellerAddress ?? "",
    t.state ?? "",
    t.stateSource ?? "",
    t.vehicleUnit ?? "",
    t.driver ?? "",
    firstMotor?.fuelType ?? "",
    fixed(sumOf(motor, ["MOTOR_FUEL"], "quantity"), 3),
    fixed(firstMotor?.unitPrice ?? null, 4),
    fixed(sumOf(motor, ["MOTOR_FUEL"], "amount"), 2),
    fixed(sumOf(t.lines, ["REEFER_FUEL"], "quantity"), 3),
    fixed(sumOf(t.lines, ["DEF"], "quantity"), 3),
    fixed(sumOf(t.lines, ["NON_FUEL"], "amount"), 2),
    fixed(sumOf(t.lines, ["TAX"], "amount"), 2),
    fixed(sumOf(t.lines, ["FEE"], "amount"), 2),
    fixed(sumOf(t.lines, ["CREDIT", "DISCOUNT"], "amount"), 2),
    fixed(t.receiptTotal, 2),
    t.paymentMethod ?? "",
    t.cardLast4 ?? "",
    t.cardMatchId ?? "",
    t.corroboration,
    [...t.openIssueCodes].sort().join("|"),
    t.sourceDocumentId ?? "",
    t.sourceFilename ?? "",
    t.sourcePage === null ? "" : t.sourcePage,
    t.lastEditedBy ?? "",
    t.lastEditedAt ? t.lastEditedAt.toISOString() : "",
  ];
}

/** Rows sorted by date (nulls last) then id, so the output is stable regardless of query order. */
export function buildTransactionsCsv(rows: TransactionCsvRow[]): string {
  const sorted = [...rows].sort((a, b) => {
    const ad = a.date ? toIsoDate(a.date) : "~";
    const bd = b.date ? toIsoDate(b.date) : "~";
    if (ad !== bd) return ad < bd ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return toCsv([...TRANSACTIONS_CSV_COLUMNS], sorted.map(transactionCsvCells));
}

export const IFTA_CSV_COLUMNS = [
  "status",
  "jurisdiction",
  "total_miles",
  "taxable_miles",
  "gallons_consumed",
  "tax_paid_gallons",
  "net_taxable_gallons",
  "rate",
  "surcharge",
  "tax_due",
  "fleet_mpg",
  "rate_quarter",
] as const;

export function buildIftaWorksheetCsv(w: IftaWorksheetJson, status: "PRELIMINARY" | "REVIEWED", quarter: string): string {
  const rows: Array<Array<string | null>> = w.rows.map((r) => [
    status,
    r.jurisdiction,
    r.totalMiles,
    r.taxableMiles,
    r.gallonsConsumed,
    r.taxPaidGallons,
    r.netTaxableGallons,
    r.rate,
    r.surcharge,
    r.taxDue,
    w.fleetMpg,
    quarter,
  ]);
  rows.push([
    status,
    "TOTAL",
    w.totals.totalMiles,
    w.totals.totalTaxableMiles,
    w.totals.totalGallonsConsumed,
    w.totals.totalTaxableGallons,
    w.totals.totalGallonsConsumed === null ? null : formatFixed(toDecimal(w.totals.totalGallonsConsumed).minus(toDecimal(w.totals.totalTaxableGallons)), 3),
    null,
    null,
    w.totals.totalTaxDue,
    w.fleetMpg,
    quarter,
  ]);
  return toCsv([...IFTA_CSV_COLUMNS], rows);
}

export function snapshotHash(csv: string): string {
  return createHash("sha256").update(Buffer.from(csv, "utf8")).digest("hex");
}

export function reportStorageKey(companyId: string, reportId: string): string {
  return `companies/${companyId}/reports/${reportId}.csv`;
}
