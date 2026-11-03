/** F003 (warning): diesel price per gallon outside the configured plausible range (USD/gal lines only). */
import { dec, issue } from "./helpers";
import type { Rule } from "./types";

const DIESEL = /\b(diesel|dsl|ulsd|b\d{1,2})\b/i;

export const F003: Rule = {
  code: "F003",
  version: "F003-v1",
  severity: "WARNING",
  check(tx, ctx) {
    if (tx.currency !== null && tx.currency.toUpperCase() !== "USD") return [];
    const min = dec(ctx.settings.dieselPriceMin);
    const max = dec(ctx.settings.dieselPriceMax);
    if (min === null || max === null) return [];
    const out = [];
    for (const [i, line] of tx.lines.entries()) {
      if (line.category !== "MOTOR_FUEL" || !line.fuelType || !DIESEL.test(line.fuelType)) continue;
      if (line.unit !== null && line.unit !== "gal") continue;
      const p = dec(line.unitPrice);
      if (p === null || (p.gte(min) && p.lte(max))) continue;
      out.push(
        issue(this, `Diesel at ${p.toFixed(3)} per gallon is outside the expected range of ${min.toFixed(2)} to ${max.toFixed(2)}.`, [`line_items.${i}.unit_price`], {
          line: i,
          unitPrice: p.toString(),
          dieselPriceMin: min.toString(),
          dieselPriceMax: max.toString(),
        }),
      );
    }
    return out;
  },
};
