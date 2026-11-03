/** M001 (error): the truck bought motor fuel this quarter but has no mileage records. */
import { issue, motorFuelGallons } from "./helpers";
import type { Rule } from "./types";

export const M001: Rule = {
  code: "M001",
  version: "M001-v1",
  severity: "ERROR",
  check(tx, ctx) {
    if (!ctx.mileage || ctx.mileage.vehicleHasMileage) return [];
    const gal = motorFuelGallons(tx);
    if (gal.lte(0)) return [];
    return [
      issue(this, `This truck bought ${gal.toFixed(3)} gallons but has no mileage records for the quarter. Miles are needed to file IFTA.`, ["unit_number"], {
        unitNumber: tx.unitNumber,
        motorFuelGallons: gal.toString(),
      }),
    ];
  },
};
