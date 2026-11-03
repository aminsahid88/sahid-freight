/** V002 (warning): truck unit number is not on the receipt itself. */
import { issue } from "./helpers";
import type { Rule } from "./types";

export const V002: Rule = {
  code: "V002",
  version: "V002-v1",
  severity: "WARNING",
  check(tx) {
    const evidence = { unitNumber: tx.unitNumber, unitSource: tx.unitSource };
    if (tx.unitNumber === null) {
      return [issue(this, "No truck unit number was found on this receipt. An auditor may question which truck it belongs to.", ["unit_number"], evidence)];
    }
    if (tx.unitSource === "card" || tx.unitSource === "driver_default") {
      const from = tx.unitSource === "card" ? "the fuel card" : "the driver's default truck";
      return [issue(this, `The receipt does not show a truck unit number; unit ${tx.unitNumber} was taken from ${from}.`, ["unit_number"], evidence)];
    }
    return [];
  },
};
