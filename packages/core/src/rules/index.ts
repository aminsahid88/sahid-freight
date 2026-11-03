/**
 * Deterministic validation rule catalog (docs/04-validation-rules.md).
 *
 * `runRules` evaluates every rule in stable code order; `evaluateStatus`
 * turns the resulting issues into the transaction status. Rules report —
 * they never fill a value.
 */
import { D002 } from "./D002";
import { F001 } from "./F001";
import { F002 } from "./F002";
import { F003 } from "./F003";
import { F004 } from "./F004";
import { F005 } from "./F005";
import { F006 } from "./F006";
import { legibilityOf, lineGallons, motorFuelGallons, motorFuelLines, LITERS_TO_GALLONS } from "./helpers";
import { M001 } from "./M001";
import { M002 } from "./M002";
import { M003 } from "./M003";
import { M004 } from "./M004";
import { S001 } from "./S001";
import type { Rule, RuleContext, RuleIssue, RuleTransaction } from "./types";
import { V001, missingRequiredFields } from "./V001";
import { V002 } from "./V002";
import { V003 } from "./V003";
import { V004 } from "./V004";
import { V005 } from "./V005";
import { V006 } from "./V006";
import { V007 } from "./V007";
import { V010, MATERIAL_FIELDS, isMaterialField, passValuesAgree } from "./V010";

export * from "./types";
export { D002, F001, F002, F003, F004, F005, F006, M001, M002, M003, M004, S001, V001, V002, V003, V004, V005, V006, V007, V010 };
export { MATERIAL_FIELDS, isMaterialField, passValuesAgree, missingRequiredFields, motorFuelGallons, lineGallons, LITERS_TO_GALLONS };

/** Every rule, sorted by code so issue order is stable. */
export const RULES: Rule[] = [V001, V002, V003, V004, V005, V006, V007, V010, F001, F002, F003, F004, F005, F006, D002, M001, M002, M003, M004, S001].sort(
  (a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0),
);

export function runRules(tx: RuleTransaction, ctx: RuleContext): RuleIssue[] {
  return RULES.flatMap((rule) => rule.check(tx, ctx));
}

export type TransactionStatus = "VERIFIED" | "NEEDS_ATTENTION" | "UNABLE_TO_VERIFY";

/**
 * Required (V001) fields that are marked unreadable. Alternatives follow V001:
 * an unreadable seller address is fine when the state is present, and an
 * unreadable amount is fine when the unit price is present.
 */
export function unreadableRequiredFields(tx: RuleTransaction): string[] {
  const out: string[] = [];
  const unreadable = (key: string) => legibilityOf(tx, key) === "unreadable";
  if (unreadable("transaction_date")) out.push("transaction_date");
  if (unreadable("vendor")) out.push("vendor");
  if (unreadable("seller_address") && (tx.state === null || unreadable("state"))) out.push("seller_address");
  if (unreadable("state") && (tx.sellerAddress === null || unreadable("seller_address"))) out.push("state");
  for (const { index, line } of motorFuelLines(tx)) {
    const k = (f: string) => `line_items.${index}.${f}`;
    if (line.legibility === "unreadable" || unreadable(k("quantity"))) out.push(k("quantity"));
    if (unreadable(k("fuel_type")) || (index === 0 && unreadable("fuel_type"))) out.push(k("fuel_type"));
    const amountBad = line.amount === null || unreadable(k("amount"));
    const priceBad = line.unitPrice === null || unreadable(k("unit_price"));
    if (amountBad && priceBad && (unreadable(k("amount")) || unreadable(k("unit_price")))) out.push(k("amount"));
  }
  return Array.from(new Set(out));
}

/**
 * Status logic: a required field that cannot be read → UNABLE_TO_VERIFY;
 * any open ERROR → NEEDS_ATTENTION; otherwise VERIFIED.
 */
export function evaluateStatus(issues: RuleIssue[], tx: RuleTransaction): TransactionStatus {
  if (unreadableRequiredFields(tx).length > 0) return "UNABLE_TO_VERIFY";
  if (issues.some((i) => i.severity === "ERROR")) return "NEEDS_ATTENTION";
  return "VERIFIED";
}
