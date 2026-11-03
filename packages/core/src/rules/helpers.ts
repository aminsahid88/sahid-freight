/**
 * Small shared helpers for the rule files. No I/O, no floats on money/gallons.
 */
import { Decimal, gallons, toDecimal } from "../decimal";
import type { Legibility, Rule, RuleIssue, RuleLine, RuleTransaction } from "./types";

/** Gallons per liter, 6 significant figures (NIST). Reported in F006 evidence. */
export const LITERS_TO_GALLONS = "0.264172";

export const FUEL_CATEGORIES: ReadonlySet<RuleLine["category"]> = new Set(["MOTOR_FUEL", "REEFER_FUEL", "DEF"]);

/** Parse a decimal string leniently: null/blank/garbage → null instead of throwing. */
export function dec(value: string | null | undefined): Decimal | null {
  if (value === null || value === undefined) return null;
  try {
    return toDecimal(value);
  } catch {
    return null;
  }
}

export function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === "";
}

export function norm(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * A line's quantity expressed in gallons, 3 dp. Liters are converted with
 * LITERS_TO_GALLONS; "each" and unparseable quantities yield null.
 */
export function lineGallons(line: RuleLine): { gallons: Decimal; converted: boolean } | null {
  const q = dec(line.quantity);
  if (q === null) return null;
  if (line.unit === "L") return { gallons: gallons(q.times(LITERS_TO_GALLONS)), converted: true };
  if (line.unit === "each") return null;
  return { gallons: gallons(q), converted: false };
}

/** Sum of MOTOR_FUEL quantities in gallons (liters converted). Reefer and DEF never count. */
export function motorFuelGallons(tx: RuleTransaction): Decimal {
  let acc = new Decimal(0);
  for (const line of tx.lines) {
    if (line.category !== "MOTOR_FUEL") continue;
    const g = lineGallons(line);
    if (g) acc = acc.plus(g.gallons);
  }
  return gallons(acc);
}

export function motorFuelLines(tx: RuleTransaction): Array<{ index: number; line: RuleLine }> {
  return tx.lines.map((line, index) => ({ index, line })).filter((x) => x.line.category === "MOTOR_FUEL");
}

/** Legibility of a contract field, falling back to the line's own legibility for line fields. */
export function legibilityOf(tx: RuleTransaction, key: string): Legibility | undefined {
  const direct = tx.fieldLegibility[key];
  if (direct) return direct;
  const m = /^line_items\.(\d+)\./.exec(key);
  if (m) return tx.lines[Number(m[1])]?.legibility;
  return undefined;
}

export function issue(rule: Rule, message: string, fields: string[], evidence: Record<string, unknown> = {}): RuleIssue {
  return { code: rule.code, severity: rule.severity, message, fields, evidence, ruleVersion: rule.version };
}
