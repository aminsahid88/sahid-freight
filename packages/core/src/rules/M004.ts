/** M004 (warning): odometer readings for this truck do not increase over time. */
import { dec, issue } from "./helpers";
import type { Rule } from "./types";

export const M004: Rule = {
  code: "M004",
  version: "M004-v1",
  severity: "WARNING",
  check(tx, ctx) {
    const odo = dec(tx.odometer);
    if (odo === null || tx.date === null) return [];
    const conflicts = [];
    for (const h of ctx.odometerHistory ?? []) {
      const ho = dec(h.odometer);
      if (ho === null || h.date === tx.date) continue;
      if ((h.date > tx.date && ho.lt(odo)) || (h.date < tx.date && ho.gt(odo))) {
        conflicts.push({ date: h.date, odometer: ho.toString() });
      }
    }
    if (conflicts.length === 0) return [];
    return [
      issue(this, `The odometer reading ${odo.toString()} on ${tx.date} does not line up with other readings for this truck.`, ["odometer", "transaction_date"], {
        odometer: odo.toString(),
        date: tx.date,
        conflicts,
      }),
    ];
  },
};
