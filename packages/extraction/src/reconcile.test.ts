import { test } from "node:test";
import assert from "node:assert/strict";
import type { NormalizedReceipt } from "./normalize";
import { reconcile } from "./reconcile";

function base(over: Partial<NormalizedReceipt> = {}): NormalizedReceipt {
  return {
    regionHint: null,
    date: "2026-10-02",
    time: "06:41",
    vendor: "NORTHSTAR TRAVEL CENTER",
    sellerAddress: "1450 Industrial Blvd, Fargo, ND 58102",
    state: "ND",
    unitNumber: "102",
    odometer: "412885.0",
    driverName: "M YUSUF",
    purchaserName: "DEMO FREIGHT LLC",
    paymentMethod: "fuel_card",
    cardLast4: "4417",
    pumpNumber: "07",
    receiptTotal: "461.72",
    currency: "USD",
    lines: [{ descriptionRaw: "DIESEL #2", category: "MOTOR_FUEL", fuelType: "diesel", quantity: "118.420", unit: "gal", unitPrice: "3.8990", amount: "461.72", legibility: "clear" }],
    rawText: { vendor: "NORTHSTAR TRAVEL CENTER #214" },
    legibility: {},
    ...over,
  };
}

test("agreeing passes corroborate every field", () => {
  const r = reconcile(base(), base({ receiptTotal: "461.720" }));
  assert.equal(r.corroboration, "TWO_PASS");
  assert.deepEqual(r.disagreements, []);
  assert.equal(r.provenance.receiptTotal?.finalSource, "both");
  assert.equal(r.provenance.vendor?.rawText, "NORTHSTAR TRAVEL CENTER #214");
  assert.equal(r.final.receiptTotal, "461.72");
  assert.equal(r.provenance["line_items.0.quantity"]?.agree, true);
});

test("a material disagreement leaves the final value empty and is reported", () => {
  const r = reconcile(base(), base({ receiptTotal: "416.72", state: "NB" }));
  assert.equal(r.final.receiptTotal, null);
  assert.equal(r.final.state, null);
  assert.equal(r.provenance.receiptTotal?.finalSource, null);
  const fields = r.disagreements.map((d) => d.field).sort();
  assert.deepEqual(fields, ["receiptTotal", "state"]);
  assert.ok(r.disagreements.every((d) => d.material));
});

test("when one pass is null the other fills in and the source says which", () => {
  const r = reconcile(base({ unitNumber: null }), base());
  assert.equal(r.final.unitNumber, "102");
  assert.equal(r.provenance.unitNumber?.finalSource, "pass_b");
  assert.equal(r.disagreements.find((d) => d.field === "unitNumber")?.material, false);
});

test("line count mismatch is a material disagreement; single pass is SINGLE_SOURCE", () => {
  const r = reconcile(base(), base({ lines: [] }));
  assert.ok(r.disagreements.some((d) => d.field === "line_items.count" && d.material));
  const s = reconcile(base(), null);
  assert.equal(s.corroboration, "SINGLE_SOURCE");
  assert.equal(s.provenance.date?.finalSource, "pass_a");
  assert.equal(s.disagreements.length, 0);
});
