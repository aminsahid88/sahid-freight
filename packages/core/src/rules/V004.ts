/** V004 (error): transaction date is valid and inside the reporting period. */
import { isInPeriod, parseIsoDate } from "../period";
import { issue } from "./helpers";
import type { Rule } from "./types";

export const V004: Rule = {
  code: "V004",
  version: "V004-v1",
  severity: "ERROR",
  check(tx, ctx) {
    if (tx.date === null) return []; // V001 reports the missing date
    const evidence = { date: tx.date, period: ctx.period };
    try {
      parseIsoDate(tx.date);
    } catch {
      return [issue(this, `The receipt date "${tx.date}" is not a valid calendar date.`, ["transaction_date"], evidence)];
    }
    if (ctx.period && !isInPeriod(tx.date, ctx.period.start, ctx.period.end)) {
      return [
        issue(
          this,
          `The receipt date ${tx.date} is outside the reporting period ${ctx.period.start} to ${ctx.period.end}. It may belong to another quarter.`,
          ["transaction_date"],
          evidence,
        ),
      ];
    }
    return [];
  },
};
