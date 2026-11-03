/** F006 (warning): liters or a non-USD currency; gallons converted with the factor shown, money left as printed. */
import { issue, lineGallons, LITERS_TO_GALLONS } from "./helpers";
import type { Rule } from "./types";

export const F006: Rule = {
  code: "F006",
  version: "F006-v1",
  severity: "WARNING",
  check(tx) {
    const liters = tx.lines
      .map((line, i) => ({ i, line }))
      .filter(({ line }) => line.unit === "L")
      .map(({ i, line }) => ({ line: i, liters: line.quantity, gallons: lineGallons(line)?.gallons.toString() ?? null }));
    const foreign = tx.currency !== null && tx.currency.toUpperCase() !== "USD";
    if (liters.length === 0 && !foreign) return [];
    const fields = liters.map((l) => `line_items.${l.line}.unit`);
    if (foreign) fields.push("currency");
    const parts: string[] = [];
    if (liters.length) parts.push(`fuel is in liters (converted at ${LITERS_TO_GALLONS} gal per liter)`);
    if (foreign) parts.push(`amounts are in ${tx.currency}, not USD, and were left as printed`);
    return [
      issue(this, `${parts.join("; ").replace(/^./, (c) => c.toUpperCase())}. Please confirm before filing.`, fields, {
        conversionFactorGalPerL: LITERS_TO_GALLONS,
        litersLines: liters,
        currency: tx.currency,
      }),
    ];
  },
};
