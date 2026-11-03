import { test } from "node:test";
import assert from "node:assert/strict";
import { computeIftaWorksheet, iftaWorksheetToJson } from "./ifta";

/** Worked example from docs/05-ifta-logic.md: 2 trucks, 30,000 miles, 4,800 gal. */
const mileage = [
  { vehicleId: "truck-1", jurisdiction: "OH", totalMiles: "7000", taxableMiles: "7000" },
  { vehicleId: "truck-2", jurisdiction: "OH", totalMiles: "5500", taxableMiles: "5500" },
  { vehicleId: "truck-1", jurisdiction: "IN", totalMiles: "6000", taxableMiles: "6000" },
  { vehicleId: "truck-2", jurisdiction: "IN", totalMiles: "4000", taxableMiles: "4000" },
  { vehicleId: "truck-1", jurisdiction: "IL", totalMiles: "4000", taxableMiles: "4000" },
  { vehicleId: "truck-2", jurisdiction: "IL", totalMiles: "3500", taxableMiles: "3500" },
];
const fuel = [
  { jurisdiction: "OH", gallons: "2600" },
  { jurisdiction: "IN", gallons: "1200" },
  { jurisdiction: "IL", gallons: "1000" },
];
/** Fictional rate table; IN carries a surcharge. */
const rates = [
  { jurisdiction: "OH", rate: "0.47" },
  { jurisdiction: "IN", rate: "0.55", surcharge: "0.21" },
  { jurisdiction: "IL", rate: "0.467" },
];

test("worked example: MPG 6.25, consumed and net gallons per state match docs/05", () => {
  const w = computeIftaWorksheet({ mileage, fuel, rates: null });
  assert.equal(w.totals.totalMiles.toString(), "30000");
  assert.equal(w.totals.totalTaxableGallons.toString(), "4800");
  assert.equal(w.fleetMpg?.toString(), "6.25");
  assert.deepEqual(
    w.rows.map((r) => [r.jurisdiction, r.taxableMiles.toString(), r.gallonsConsumed?.toFixed(3), r.taxPaidGallons.toString(), r.netTaxableGallons?.toFixed(3)]),
    [
      ["IL", "7500", "1200.000", "1000", "200.000"],
      ["IN", "10000", "1600.000", "1200", "400.000"],
      ["OH", "12500", "2000.000", "2600", "-600.000"],
    ],
  );
  assert.equal(w.ratesMissing, true, "null rate table is reported as missing (I001)");
  assert.ok(w.rows.every((r) => r.rate === null && r.taxDue === null));
  assert.ok(w.roundingNotes.some((n) => /No rate table/.test(n)));
});

test("tax due uses the rate table and adds the surcharge where defined", () => {
  const w = computeIftaWorksheet({ mileage, fuel, rates });
  const byJ = Object.fromEntries(w.rows.map((r) => [r.jurisdiction, r]));
  assert.equal(byJ.OH!.taxDue?.toFixed(2), "-282.00", "−600 × 0.47 (credit)");
  assert.equal(byJ.IN!.taxDue?.toFixed(2), "304.00", "400 × 0.55 + 400 × 0.21");
  assert.equal(byJ.IN!.surcharge?.toString(), "0.21");
  assert.equal(byJ.IL!.taxDue?.toFixed(2), "93.40", "200 × 0.467");
  assert.equal(w.totals.totalTaxDue?.toFixed(2), "115.40");
  assert.equal(w.ratesMissing, false);
  assert.deepEqual(w.missingRateJurisdictions, []);
  // Every rounding step is documented.
  assert.ok(w.roundingNotes.some((n) => /Fleet MPG = total miles 30000 ÷ total motor-fuel gallons 4800/.test(n)));
  assert.ok(w.roundingNotes.some((n) => /^IN: tax due = 400.000 × rate 0.55 \+ 400.000 × surcharge 0.21/.test(n)));
  const json = iftaWorksheetToJson(w);
  assert.equal(json.fleetMpg, "6.25");
  assert.equal(json.rows[2]!.taxDue, "-282.00");
  assert.equal(json.rows[1]!.rate, "0.55000");
});

test("rounding is HALF_UP at every step and MPG honours mpgDecimals", () => {
  const w = computeIftaWorksheet({
    mileage: [{ vehicleId: "v", jurisdiction: "TX", totalMiles: "1000", taxableMiles: "1000" }],
    fuel: [{ jurisdiction: "TX", gallons: "300" }],
    rates: [{ jurisdiction: "TX", rate: "0.2" }],
  });
  // 1000 / 300 = 3.333… → 3.33; consumed 1000 / 3.33 = 300.3003… → 300.300; net 0.300; tax 0.06
  assert.equal(w.fleetMpg?.toString(), "3.33");
  assert.equal(w.rows[0]!.gallonsConsumed?.toFixed(3), "300.300");
  assert.equal(w.rows[0]!.netTaxableGallons?.toFixed(3), "0.300");
  assert.equal(w.rows[0]!.taxDue?.toFixed(2), "0.06");
  const w3 = computeIftaWorksheet({ mileage: [{ vehicleId: "v", jurisdiction: "TX", totalMiles: "1000", taxableMiles: "1000" }], fuel: [{ jurisdiction: "TX", gallons: "300" }], rates: null, mpgDecimals: 3 });
  assert.equal(w3.fleetMpg?.toString(), "3.333");
  // Half-up on the tax: 0.125 → 0.13 (banker's rounding would give 0.12).
  const half = computeIftaWorksheet({
    mileage: [{ vehicleId: "v", jurisdiction: "KY", totalMiles: "100", taxableMiles: "100" }],
    fuel: [{ jurisdiction: "KY", gallons: "10" }, { jurisdiction: "TN", gallons: "0.25" }],
    rates: [{ jurisdiction: "KY", rate: "1" }, { jurisdiction: "TN", rate: "0.5" }],
  });
  // MPG = 100 / 10.25 = 9.756… → 9.76; TN: consumed 0, net −0.250, tax −0.125 → −0.13 (half away from zero)
  assert.equal(half.fleetMpg?.toString(), "9.76");
  const tn = half.rows.find((r) => r.jurisdiction === "TN")!;
  assert.equal(tn.totalMiles.toString(), "0", "fuel without miles still appears with zero miles");
  assert.equal(tn.taxDue?.toFixed(2), "-0.13");
  assert.ok(half.roundingNotes.some((n) => /^TN: fuel purchased .* but no miles recorded/.test(n)));
});

test("no gallons: fleet MPG and consumed gallons are null with a note, never a float or Infinity", () => {
  const w = computeIftaWorksheet({ mileage: [{ vehicleId: "v", jurisdiction: "OH", totalMiles: "500", taxableMiles: "500" }], fuel: [], rates });
  assert.equal(w.fleetMpg, null);
  assert.equal(w.rows[0]!.gallonsConsumed, null);
  assert.equal(w.rows[0]!.netTaxableGallons, null);
  assert.equal(w.rows[0]!.taxDue, null);
  assert.equal(w.totals.totalGallonsConsumed, null);
  assert.ok(w.roundingNotes[0]!.startsWith("Fleet MPG undefined"));
  assert.equal(iftaWorksheetToJson(w).fleetMpg, null);
});

test("a jurisdiction with activity but no rate row is flagged while the others still compute", () => {
  const w = computeIftaWorksheet({ mileage, fuel, rates: rates.filter((r) => r.jurisdiction !== "IL") });
  assert.equal(w.ratesMissing, true);
  assert.deepEqual(w.missingRateJurisdictions, ["IL"]);
  assert.equal(w.rows.find((r) => r.jurisdiction === "IL")!.taxDue, null);
  assert.equal(w.rows.find((r) => r.jurisdiction === "OH")!.taxDue?.toFixed(2), "-282.00");
});

test("jurisdiction codes are normalised and sorted; floats are rejected", () => {
  const w = computeIftaWorksheet({
    mileage: [{ vehicleId: "v", jurisdiction: " oh ", totalMiles: "10", taxableMiles: "10" }],
    fuel: [{ jurisdiction: "in", gallons: "1" }],
    rates: null,
  });
  assert.deepEqual(
    w.rows.map((r) => r.jurisdiction),
    ["IN", "OH"],
  );
  assert.throws(() => computeIftaWorksheet({ mileage: [{ vehicleId: "v", jurisdiction: "OH", totalMiles: 12.5 as never, taxableMiles: "1" }], fuel: [], rates: null }));
});

test("only motor fuel may be passed as fuel: reefer/DEF exclusion is the caller's contract", () => {
  // The function has no fuel-type field by design: whatever is passed is treated as tax-paid
  // motor-fuel gallons. The API filters TransactionLine.category === MOTOR_FUEL (tested there).
  const motorOnly = computeIftaWorksheet({ mileage, fuel, rates: null });
  const withReefer = computeIftaWorksheet({ mileage, fuel: [...fuel, { jurisdiction: "OH", gallons: "150" }], rates: null });
  assert.equal(motorOnly.totals.totalTaxableGallons.toString(), "4800");
  assert.equal(withReefer.totals.totalTaxableGallons.toString(), "4950", "extra gallons change the result, so callers must exclude reefer/DEF");
});
