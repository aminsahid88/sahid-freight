/** F001 (error): quantity × unit price ≈ line amount, within max($tolerance, amount × ratio). */
import { Decimal } from "../decimal";
import { dec, FUEL_CATEGORIES, issue } from "./helpers";
import type { Rule } from "./types";

export const F001: Rule = {
  code: "F001",
  version: "F001-v1",
  severity: "ERROR",
  check(tx, ctx) {
    const absTol = dec(ctx.settings.amountToleranceUsd) ?? new Decimal("0.02");
    const ratio = dec(ctx.settings.ratioTolerance) ?? new Decimal("0.001");
    const out = [];
    for (const [i, line] of tx.lines.entries()) {
      if (!FUEL_CATEGORIES.has(line.category)) continue;
      const q = dec(line.quantity);
      const p = dec(line.unitPrice);
      const a = dec(line.amount);
      if (q === null || p === null || a === null) continue;
      const expected = q.times(p);
      const diff = expected.minus(a).abs();
      const tol = Decimal.max(absTol, a.abs().times(ratio));
      if (diff.lte(tol)) continue;
      const field = `line_items.${i}.amount`;
      out.push(
        issue(
          this,
          `Line ${i + 1}: ${q.toString()} × ${p.toString()} = ${expected.toFixed(2)}, but the receipt shows ${a.toFixed(2)}.`,
          [`line_items.${i}.quantity`, `line_items.${i}.unit_price`, field],
          { line: i, quantity: q.toString(), unitPrice: p.toString(), amount: a.toString(), expected: expected.toString(), difference: diff.toString(), tolerance: tol.toString() },
        ),
      );
    }
    return out;
  },
};
