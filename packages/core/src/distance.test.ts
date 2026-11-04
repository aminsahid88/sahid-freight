import { test } from "node:test";
import assert from "node:assert/strict";
import { isDistanceUnit, toMiles } from "./distance";

test("toMiles: miles pass through at 3 dp, kilometres convert with the IFTA factor", () => {
  assert.equal(toMiles("1234.5678", "mi").toString(), "1234.568");
  assert.equal(toMiles("100", "km").toString(), "62.137");
  assert.equal(toMiles("0", "km").toString(), "0");
  // The published factor is rounded, so a statute mile in km lands 2 thousandths short; documented, not corrected.
  assert.equal(toMiles("1609.344", "km").toString(), "999.998");
});

test("isDistanceUnit", () => {
  assert.equal(isDistanceUnit("mi"), true);
  assert.equal(isDistanceUnit("km"), true);
  assert.equal(isDistanceUnit("miles"), false);
});
