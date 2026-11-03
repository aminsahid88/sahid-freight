/** V010 (error): the two independent extraction passes disagree on a material field. */
import { dec, issue, norm } from "./helpers";
import type { Rule } from "./types";

/** Top-level fields whose disagreement blocks verification. Line quantity/amount are matched by pattern. */
export const MATERIAL_FIELDS: readonly string[] = ["transaction_date", "state", "receipt_total", "currency", "vendor"];
const MATERIAL_LINE_FIELD = /^line_items\.\d+\.(quantity|amount)$/;
const DECIMAL_FIELD = /^(receipt_total|line_items\.\d+\.(quantity|amount))$/;

export function isMaterialField(key: string): boolean {
  return MATERIAL_FIELDS.includes(key) || MATERIAL_LINE_FIELD.test(key);
}

function present(v: unknown): v is string | number {
  return !(v === null || v === undefined || (typeof v === "string" && v.trim() === ""));
}

/** True when two normalized pass values agree. */
export function passValuesAgree(key: string, a: unknown, b: unknown): boolean {
  const pa = present(a);
  const pb = present(b);
  if (!pa && !pb) return true;
  if (pa !== pb) return false;
  const sa = String(a);
  const sb = String(b);
  if (DECIMAL_FIELD.test(key)) {
    const da = dec(sa);
    const db = dec(sb);
    if (da && db) return da.eq(db);
  }
  return norm(sa) === norm(sb);
}

export const V010: Rule = {
  code: "V010",
  version: "V010-v1",
  severity: "ERROR",
  check(tx) {
    const pv = tx.passValues;
    if (!pv) return [];
    const keys = Array.from(new Set([...Object.keys(pv.a), ...Object.keys(pv.b)])).filter(isMaterialField).sort();
    const disagreements = keys
      .filter((k) => !passValuesAgree(k, pv.a[k], pv.b[k]))
      .map((field) => ({ field, passA: pv.a[field] ?? null, passB: pv.b[field] ?? null }));
    if (disagreements.length === 0) return [];
    const fields = disagreements.map((d) => d.field);
    return [
      issue(this, `The two reads of this receipt disagree on ${fields.join(", ")}. A person needs to check the original.`, fields, {
        disagreements,
      }),
    ];
  },
};
