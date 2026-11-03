/** V006 (warning): some field is only partly readable or unreadable. */
import { issue } from "./helpers";
import type { Rule } from "./types";

export const V006: Rule = {
  code: "V006",
  version: "V006-v1",
  severity: "WARNING",
  check(tx) {
    const partial: string[] = [];
    const unreadable: string[] = [];
    for (const [field, leg] of Object.entries(tx.fieldLegibility)) {
      if (leg === "partial") partial.push(field);
      else if (leg === "unreadable") unreadable.push(field);
    }
    tx.lines.forEach((line, i) => {
      const key = `line_items.${i}`;
      if (line.legibility === "partial" && !partial.some((f) => f.startsWith(key))) partial.push(key);
      else if (line.legibility === "unreadable" && !unreadable.some((f) => f.startsWith(key))) unreadable.push(key);
    });
    const fields = [...unreadable, ...partial];
    if (fields.length === 0) return [];
    const parts: string[] = [];
    if (unreadable.length) parts.push(`${unreadable.length} field${unreadable.length > 1 ? "s" : ""} could not be read`);
    if (partial.length) parts.push(`${partial.length} field${partial.length > 1 ? "s" : ""} only partly readable`);
    return [issue(this, `${parts.join("; ")} on this receipt. A clearer photo may be needed.`, fields, { partial, unreadable })];
  },
};
