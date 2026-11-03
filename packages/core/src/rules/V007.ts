/** V007 (warning): image quality score is below the configured threshold. */
import { dec, issue } from "./helpers";
import type { Rule } from "./types";

export const V007: Rule = {
  code: "V007",
  version: "V007-v1",
  severity: "WARNING",
  check(tx, ctx) {
    const score = dec(tx.imageQualityScore ?? null);
    const threshold = dec(ctx.settings.qualityThreshold);
    if (score === null || threshold === null || score.gte(threshold)) return [];
    return [
      issue(this, "The photo of this receipt is low quality (blurry, dark or cropped). A clearer photo may be needed.", ["image_quality_score"], {
        imageQualityScore: score.toString(),
        qualityThreshold: threshold.toString(),
      }),
    ];
  },
};
