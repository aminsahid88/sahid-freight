/** D002 (warning): likely duplicate transaction — same vendor and date, gallons within 0.5%, total within tolerance. */
import { Decimal } from "../decimal";
import { dec, isBlank, issue, motorFuelGallons, norm } from "./helpers";
import type { Rule } from "./types";

const GALLON_RATIO = new Decimal("0.005");

export const D002: Rule = {
  code: "D002",
  version: "D002-v1",
  severity: "WARNING",
  check(tx, ctx) {
    const others = ctx.similarTransactions ?? [];
    if (others.length === 0 || isBlank(tx.vendor) || tx.date === null) return [];
    const vendor = norm(tx.vendor!);
    const gal = motorFuelGallons(tx);
    const total = dec(tx.receiptTotal);
    const tol = dec(ctx.settings.amountToleranceUsd) ?? new Decimal("0.02");
    const matches = [];
    for (const o of others) {
      if (isBlank(o.vendor) || norm(o.vendor!) !== vendor || o.date !== tx.date) continue;
      const og = dec(o.motorFuelGallons);
      if (og === null || og.minus(gal).abs().gt(Decimal.max(gal, og).times(GALLON_RATIO))) continue;
      const ot = dec(o.receiptTotal);
      if (total === null || ot === null || ot.minus(total).abs().gt(tol)) continue;
      matches.push({ id: o.id, vendor: o.vendor, date: o.date, motorFuelGallons: og.toString(), receiptTotal: ot.toString() });
    }
    if (matches.length === 0) return [];
    return [
      issue(this, `This looks like a duplicate of ${matches.length} other receipt${matches.length > 1 ? "s" : ""} from ${tx.vendor} on ${tx.date} with the same gallons and total.`, ["vendor", "transaction_date", "receipt_total"], {
        matchingTransactionIds: matches.map((m) => m.id),
        matches,
        thisGallons: gal.toString(),
        thisTotal: total?.toString() ?? null,
      }),
    ];
  },
};
