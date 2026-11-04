import { test } from "node:test";
import assert from "node:assert/strict";
import { bytesPerPixel, sharpnessVerdict } from "./sharpness";

test("bytes per pixel is computed and guarded", () => {
  assert.equal(bytesPerPixel({ bytes: 480_000, width: 2000, height: 1200 }), 0.2);
  assert.equal(bytesPerPixel({ bytes: 0, width: 2000, height: 1200 }), null);
  assert.equal(bytesPerPixel({ bytes: 100, width: 0, height: 1200 }), null);
  assert.equal(bytesPerPixel({ bytes: NaN, width: 10, height: 10 }), null);
});

test("verdicts follow the documented thresholds", () => {
  // 12 MP phone shot of a receipt, ~1.8 MB: clearly sharp.
  assert.equal(sharpnessVerdict({ bytes: 1_800_000, width: 4000, height: 3000 }).verdict, "ok");
  // Same shot, 500 KB: soft focus.
  assert.equal(sharpnessVerdict({ bytes: 900_000, width: 4000, height: 3000 }).verdict, "borderline");
  // 400 KB: smeared.
  assert.equal(sharpnessVerdict({ bytes: 400_000, width: 4000, height: 3000 }).verdict, "blurry");
  assert.equal(sharpnessVerdict({ bytes: 0, width: 4000, height: 3000 }).verdict, "unknown");
});

test("tiny images are flagged as too small even when sharp", () => {
  const r = sharpnessVerdict({ bytes: 60_000, width: 320, height: 240 });
  assert.equal(r.tooSmall, true);
  assert.equal(r.verdict, "ok");
});
