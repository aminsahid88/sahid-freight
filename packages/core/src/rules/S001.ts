/** S001 (warning): nothing attributes this document to a vehicle. */
import { issue } from "./helpers";
import type { Rule } from "./types";

export const S001: Rule = {
  code: "S001",
  version: "S001-v1",
  severity: "WARNING",
  check(tx) {
    if (tx.unitNumber !== null || tx.unitSource !== null) return [];
    return [issue(this, "This receipt is not linked to any truck. Pick the truck it belongs to.", ["unit_number"], { unitNumber: null, unitSource: null })];
  },
};
