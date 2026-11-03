/**
 * Decimal math for money, gallons and miles.
 *
 * Rule (CLAUDE.md): never use JS floats for money or gallons. `Decimal` here is
 * decimal.js as bundled by Prisma, so values round-trip to Prisma `Decimal`
 * columns without conversion.
 */
import { Decimal } from "@prisma/client/runtime/library";

export { Decimal };

/** Values we accept as decimal input. Floats are rejected unless they are integers. */
export type DecimalInput = Decimal | string | number | bigint;

export class DecimalInputError extends Error {
  constructor(value: unknown, reason: string) {
    super(`Invalid decimal input ${JSON.stringify(value)}: ${reason}`);
    this.name = "DecimalInputError";
  }
}

const NUMERIC = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

/**
 * Parse a value into a Decimal. Strings must be plain decimal numerals
 * (no exponents, no thousands separators, no currency symbols); trim first.
 * Numbers are only accepted when they are safe integers, because a float like
 * 12.34 is already imprecise before we see it.
 */
export function toDecimal(value: DecimalInput): Decimal {
  if (value instanceof Decimal) return value;
  if (typeof value === "bigint") return new Decimal(value.toString());
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new DecimalInputError(value, "only integers may be passed as numbers; pass money/gallons as strings");
    }
    return new Decimal(value);
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!NUMERIC.test(s)) throw new DecimalInputError(value, "not a plain decimal numeral");
    return new Decimal(s);
  }
  throw new DecimalInputError(value, "unsupported type");
}

export const ZERO = new Decimal(0);

/** Money: 2 decimal places, round half up (what receipts and tax forms expect). */
export function money(value: DecimalInput): Decimal {
  return toDecimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Gallons: 3 decimal places (pump precision). */
export function gallons(value: DecimalInput): Decimal {
  return toDecimal(value).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
}

/** Miles: 3 decimal places, matching the schema's Decimal(12,3). */
export function miles(value: DecimalInput): Decimal {
  return toDecimal(value).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
}

export function sum(values: Iterable<DecimalInput>): Decimal {
  let acc = ZERO;
  for (const v of values) acc = acc.plus(toDecimal(v));
  return acc;
}

/** |a - b| <= tolerance. Used by arithmetic rules (F001/F002) with tolerances from settings. */
export function withinTolerance(a: DecimalInput, b: DecimalInput, tolerance: DecimalInput): boolean {
  return toDecimal(a).minus(toDecimal(b)).abs().lte(toDecimal(tolerance));
}

/** Format for storage/CSV: fixed decimals, no exponent. */
export function formatFixed(value: DecimalInput, places: number): string {
  return toDecimal(value).toFixed(places, Decimal.ROUND_HALF_UP);
}
