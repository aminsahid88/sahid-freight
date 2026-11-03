/** M003 (warning): fleet MPG outside the configured plausible band. */
import { dec, issue } from "./helpers";
import type { Rule } from "./types";

export const M003: Rule = {
  code: "M003",
  version: "M003-v1",
  severity: "WARNING",
  check(_tx, ctx) {
    const mpg = dec(ctx.mileage?.fleetMpg ?? null);
    const min = dec(ctx.settings.mpgBandMin);
    const max = dec(ctx.settings.mpgBandMax);
    if (mpg === null || min === null || max === null) return [];
    if (mpg.gte(min) && mpg.lte(max)) return [];
    return [
      issue(this, `Fleet fuel economy of ${mpg.toFixed(2)} MPG is outside the expected ${min.toString()} to ${max.toString()} MPG. Miles or gallons may be missing.`, [], {
        fleetMpg: mpg.toString(),
        mpgBandMin: min.toString(),
        mpgBandMax: max.toString(),
      }),
    ];
  },
};
