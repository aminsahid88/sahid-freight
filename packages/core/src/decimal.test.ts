import { test } from "node:test";
import assert from "node:assert/strict";
import { Decimal, DecimalInputError, formatFixed, gallons, money, sum, toDecimal, withinTolerance } from "./decimal";

test("money rounds half up to 2 places without float drift", () => {
  assert.equal(money("0.1").plus(money("0.2")).toString(), "0.3");
  assert.equal(money("2.675").toString(), "2.68");
  assert.equal(money("2.665").toString(), "2.67");
  assert.equal(money("-1.005").toString(), "-1.01");
});

test("gallons keep 3 places", () => {
  assert.equal(gallons("123.4567").toString(), "123.457");
  assert.equal(gallons("100").toString(), "100");
});

test("sum of many small amounts is exact", () => {
  const parts = Array.from({ length: 1000 }, () => "0.01");
  assert.equal(sum(parts).toString(), "10");
});

test("toDecimal rejects floats, exponents and junk", () => {
  assert.throws(() => toDecimal(12.34), DecimalInputError);
  assert.throws(() => toDecimal("1e5"), DecimalInputError);
  assert.throws(() => toDecimal("$12.00"), DecimalInputError);
  assert.throws(() => toDecimal("1,234.00"), DecimalInputError);
  assert.throws(() => toDecimal(NaN), DecimalInputError);
  assert.equal(toDecimal(42).toString(), "42");
  assert.equal(toDecimal(" 7.50 ").toString(), "7.5");
  assert.equal(toDecimal(10n).toString(), "10");
  assert.ok(toDecimal(new Decimal("1.1")) instanceof Decimal);
});

test("withinTolerance is inclusive", () => {
  assert.equal(withinTolerance("100.00", "100.02", "0.02"), true);
  assert.equal(withinTolerance("100.00", "100.03", "0.02"), false);
  assert.equal(withinTolerance("100.03", "100.00", "0.02"), false);
});

test("formatFixed pads and never uses exponent notation", () => {
  assert.equal(formatFixed("5", 2), "5.00");
  assert.equal(formatFixed("123456789012.5", 3), "123456789012.500");
  assert.equal(formatFixed("0.0000001", 3), "0.000");
});
