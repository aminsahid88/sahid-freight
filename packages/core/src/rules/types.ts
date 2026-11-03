/**
 * Shapes shared by every validation rule (docs/04-validation-rules.md).
 *
 * The API maps Prisma rows onto `RuleTransaction` / `RuleContext`; rules are
 * pure functions over these shapes and never touch the database. Money and
 * gallons travel as decimal strings so no float is ever formed.
 */

export type Severity = "ERROR" | "WARNING" | "INFO";
export type Legibility = "clear" | "partial" | "unreadable";
export type LineCategory =
  | "MOTOR_FUEL"
  | "REEFER_FUEL"
  | "DEF"
  | "NON_FUEL"
  | "TAX"
  | "FEE"
  | "DISCOUNT"
  | "CREDIT";

export interface RuleLine {
  category: LineCategory;
  fuelType?: string | null;
  quantity: string | null;
  unit: "gal" | "L" | "each" | null;
  unitPrice: string | null;
  amount: string | null;
  legibility?: Legibility;
}

export interface RuleTransaction {
  /** Normalized YYYY-MM-DD or null. */
  date: string | null;
  vendor: string | null;
  sellerAddress: string | null;
  state: string | null;
  stateSource: "printed" | "lookup" | "user" | null;
  unitNumber: string | null;
  unitSource: "receipt" | "card" | "driver_default" | "user" | null;
  purchaserName: string | null;
  /** Decimal strings. */
  receiptTotal: string | null;
  currency: string | null;
  odometer: string | null;
  lines: RuleLine[];
  /** Keys = contract field names (transaction_date, vendor, …) and line_items.N.quantity etc. */
  fieldLegibility: Record<string, Legibility>;
  /** Normalized values per extraction pass, for V010. */
  passValues?: { a: Record<string, unknown>; b: Record<string, unknown> } | null;
  /** 0..1 decimal string. */
  imageQualityScore?: string | null;
}

export interface RuleSettings {
  amountToleranceUsd: string;
  ratioTolerance: string;
  defaultTankCapacityGal: string;
  dieselPriceMin: string;
  dieselPriceMax: string;
  qualityThreshold: string;
  mpgBandMin: string;
  mpgBandMax: string;
}

export const DEFAULT_SETTINGS: RuleSettings = {
  amountToleranceUsd: "0.02",
  ratioTolerance: "0.001",
  defaultTankCapacityGal: "300",
  dieselPriceMin: "2.00",
  dieselPriceMax: "7.00",
  qualityThreshold: "0.5",
  mpgBandMin: "4.0",
  mpgBandMax: "9.0",
};

export interface RuleContext {
  /** YYYY-MM-DD inclusive. */
  period: { start: string; end: string } | null;
  /** Valid IFTA member codes. */
  jurisdictions: ReadonlySet<string>;
  vehicle: { tankCapacityGal: string | null } | null;
  settings: RuleSettings;
  /** Other transactions in the company, for D002. */
  similarTransactions?: Array<{
    id: string;
    vendor: string | null;
    sellerAddress: string | null;
    date: string | null;
    motorFuelGallons: string | null;
    receiptTotal: string | null;
  }>;
  /** M-rules; undefined = not evaluated. */
  mileage?: {
    vehicleHasMileage: boolean;
    jurisdictionsWithMiles: ReadonlySet<string>;
    fleetMpg: string | null;
  } | null;
  /** Same vehicle, for M004. */
  odometerHistory?: Array<{ date: string; odometer: string }>;
}

export interface RuleIssue {
  code: string;
  severity: Severity;
  message: string;
  fields: string[];
  evidence: Record<string, unknown>;
  ruleVersion: string;
}

export interface Rule {
  code: string;
  version: string;
  severity: Severity;
  check(tx: RuleTransaction, ctx: RuleContext): RuleIssue[];
}
