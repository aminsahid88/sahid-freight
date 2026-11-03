/** F002 (error): line amounts (discounts/credits negative as stored) add up to the receipt total. */
import { Decimal } from "../decimal";
import { dec, issue } from "./helpers";
import type { Rule } from "./types";

export const F002: Rule = {
  code: "F002",
  version: "F002-v1",
  severity: "ERROR",
  check(tx, ctx) {
    const total = dec(tx.receiptTotal);
    if (total === null) return [];
    const tol = dec(ctx.settings.amountToleranceUsd) ?? new Decimal("0.02");
    let sum = new Decimal(0);
    let counted = 0;
    const skipped: number[] = [];
    tx.lines.forEach((line, i) => {
      const a = dec(line.amount);
      if (a === null) skipped.push(i);
      else {
        sum = sum.plus(a);
        counted += 1;
      }
    });
    if (counted === 0) return [];
    const diff = sum.minus(total).abs();
    if (diff.lte(tol)) return [];
    const fields = ["receipt_total", ...tx.lines.map((_, i) => `line_items.${i}.amount`)];
    return [
      issue(this, `The line items add up to ${sum.toFixed(2)}, but the receipt total is ${total.toFixed(2)}.`, fields, {
        lineSum: sum.toString(),
        receiptTotal: total.toString(),
        difference: diff.toString(),
        tolerance: tol.toString(),
        linesWithoutAmount: skipped,
      }),
    ];
  },
};
