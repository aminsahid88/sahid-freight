/** M002 (warning): fuel bought in a state where the truck shows zero miles this quarter. */
import { isBlank, issue, motorFuelGallons } from "./helpers";
import type { Rule } from "./types";

export const M002: Rule = {
  code: "M002",
  version: "M002-v1",
  severity: "WARNING",
  check(tx, ctx) {
    if (!ctx.mileage || isBlank(tx.state)) return [];
    const state = tx.state!.trim().toUpperCase();
    if (ctx.mileage.jurisdictionsWithMiles.has(state)) return [];
    const gal = motorFuelGallons(tx);
    if (gal.lte(0)) return [];
    return [
      issue(this, `Fuel was bought in ${state}, but this truck shows no miles there this quarter.`, ["state"], {
        state,
        motorFuelGallons: gal.toString(),
        jurisdictionsWithMiles: Array.from(ctx.mileage.jurisdictionsWithMiles).sort(),
      }),
    ];
  },
};
