/** F004 (warning): a single line's gallons exceed the truck's tank capacity (or the default). */
import { dec, FUEL_CATEGORIES, issue, lineGallons } from "./helpers";
import type { Rule } from "./types";

export const F004: Rule = {
  code: "F004",
  version: "F004-v1",
  severity: "WARNING",
  check(tx, ctx) {
    const vehicleCap = dec(ctx.vehicle?.tankCapacityGal ?? null);
    const capacity = vehicleCap ?? dec(ctx.settings.defaultTankCapacityGal);
    if (capacity === null) return [];
    const source = vehicleCap ? "vehicle" : "default";
    const out = [];
    for (const [i, line] of tx.lines.entries()) {
      if (!FUEL_CATEGORIES.has(line.category)) continue;
      const g = lineGallons(line);
      if (g === null || g.gallons.lte(capacity)) continue;
      out.push(
        issue(this, `Line ${i + 1} shows ${g.gallons.toFixed(3)} gallons, more than the ${capacity.toString()}-gallon tank capacity.`, [`line_items.${i}.quantity`], {
          line: i,
          gallons: g.gallons.toString(),
          tankCapacityGal: capacity.toString(),
          capacitySource: source,
        }),
      );
    }
    return out;
  },
};
