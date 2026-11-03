/** V005 (error): state is a valid IFTA jurisdiction code. */
import { isBlank, issue } from "./helpers";
import type { Rule } from "./types";

export const V005: Rule = {
  code: "V005",
  version: "V005-v1",
  severity: "ERROR",
  check(tx, ctx) {
    const evidence = { state: tx.state, stateSource: tx.stateSource };
    if (isBlank(tx.state)) {
      return [issue(this, "The state where the fuel was bought could not be determined.", ["state"], evidence)];
    }
    if (!ctx.jurisdictions.has(tx.state!.trim().toUpperCase())) {
      return [issue(this, `"${tx.state}" is not an IFTA member jurisdiction.`, ["state"], evidence)];
    }
    return [];
  },
};
