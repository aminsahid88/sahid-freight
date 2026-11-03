/** F005 (info): reefer fuel or DEF present; excluded from IFTA motor-fuel gallons pending preparer confirmation. */
import { issue } from "./helpers";
import type { Rule } from "./types";

export const F005: Rule = {
  code: "F005",
  version: "F005-v1",
  severity: "INFO",
  check(tx) {
    const hits = tx.lines
      .map((line, i) => ({ i, category: line.category, quantity: line.quantity, amount: line.amount }))
      .filter((l) => l.category === "REEFER_FUEL" || l.category === "DEF");
    if (hits.length === 0) return [];
    const kinds = Array.from(new Set(hits.map((h) => (h.category === "DEF" ? "DEF" : "reefer fuel"))));
    return [
      issue(this, `This receipt includes ${kinds.join(" and ")}, excluded from IFTA gallons pending preparer confirmation.`, hits.map((h) => `line_items.${h.i}.category`), {
        lines: hits,
      }),
    ];
  },
};
