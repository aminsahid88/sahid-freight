/** V003 (warning): purchaser / company name is on the receipt. */
import { isBlank, issue } from "./helpers";
import type { Rule } from "./types";

export const V003: Rule = {
  code: "V003",
  version: "V003-v1",
  severity: "WARNING",
  check(tx) {
    if (!isBlank(tx.purchaserName)) return [];
    return [issue(this, "The receipt does not show who bought the fuel (purchaser or company name).", ["purchaser_name"], { purchaserName: tx.purchaserName })];
  },
};
