/** V001 (error): required IFTA receipt fields are present. Reports what is missing; never fills it. */
import { dec, isBlank, lineGallons, motorFuelLines } from "./helpers";
import { issue } from "./helpers";
import type { Rule, RuleTransaction } from "./types";

const LABELS: Record<string, string> = {
  transaction_date: "date",
  vendor: "seller name",
  seller_address: "seller address or state",
  "line_items.motor_fuel": "motor-fuel gallons",
  fuel_type: "fuel type",
  amount: "amount or price per gallon",
};

/** Required-field keys that are missing on the transaction (shared with evaluateStatus). */
export function missingRequiredFields(tx: RuleTransaction): string[] {
  const missing: string[] = [];
  if (isBlank(tx.date)) missing.push("transaction_date");
  if (isBlank(tx.vendor)) missing.push("vendor");
  if (isBlank(tx.sellerAddress) && isBlank(tx.state)) missing.push("seller_address");
  const fuel = motorFuelLines(tx);
  if (fuel.length === 0) {
    missing.push("line_items.motor_fuel");
  } else {
    for (const { index, line } of fuel) {
      if (lineGallons(line) === null) missing.push(`line_items.${index}.quantity`);
      if (isBlank(line.fuelType)) missing.push(`line_items.${index}.fuel_type`);
      if (dec(line.amount) === null && dec(line.unitPrice) === null) missing.push(`line_items.${index}.amount`);
    }
  }
  return missing;
}

function label(field: string): string {
  const m = /^line_items\.\d+\.(\w+)$/.exec(field);
  if (m) {
    if (m[1] === "quantity") return "gallons";
    return LABELS[m[1]!] ?? m[1]!;
  }
  return LABELS[field] ?? field;
}

export const V001: Rule = {
  code: "V001",
  version: "V001-v1",
  severity: "ERROR",
  check(tx) {
    const missing = missingRequiredFields(tx);
    if (missing.length === 0) return [];
    const names = Array.from(new Set(missing.map(label)));
    return [
      issue(this, `The receipt is missing information IFTA needs: ${names.join(", ")}.`, missing, {
        missing,
      }),
    ];
  },
};
