import { test } from "node:test";
import assert from "node:assert/strict";
import {
  D002, DEFAULT_SETTINGS, F001, F002, F003, F004, F005, F006, M001, M002, M003, M004, S001,
  V001, V002, V003, V004, V005, V006, V007, V010,
  RULES, evaluateStatus, motorFuelGallons, runRules, MATERIAL_FIELDS,
  type RuleContext, type RuleTransaction,
} from "./index";

const JURISDICTIONS = new Set(["ND", "MN", "SD", "MT", "TX", "ON", "QC"]);

function cleanTx(over: Partial<RuleTransaction> = {}): RuleTransaction {
  return {
    date: "2026-10-02",
    vendor: "NORTHSTAR TRAVEL CENTER",
    sellerAddress: "1200 US-2, Grand Forks, ND 58203",
    state: "ND",
    stateSource: "printed",
    unitNumber: "102",
    unitSource: "receipt",
    purchaserName: "Demo Freight LLC",
    receiptTotal: "461.72",
    currency: "USD",
    odometer: "412880",
    lines: [{ category: "MOTOR_FUEL", fuelType: "DIESEL", quantity: "118.420", unit: "gal", unitPrice: "3.899", amount: "461.72", legibility: "clear" }],
    fieldLegibility: { transaction_date: "clear", vendor: "clear", seller_address: "clear", state: "clear", receipt_total: "clear", "line_items.0.quantity": "clear" },
    passValues: null,
    imageQualityScore: "0.92",
    ...over,
  };
}

function ctx(over: Partial<RuleContext> = {}): RuleContext {
  return { period: { start: "2026-10-01", end: "2026-12-31" }, jurisdictions: JURISDICTIONS, vehicle: null, settings: DEFAULT_SETTINGS, ...over };
}

const codes = (issues: { code: string }[]) => issues.map((i) => i.code);

test("golden clean receipt yields zero issues and VERIFIED", () => {
  const tx = cleanTx();
  const issues = runRules(tx, ctx());
  assert.deepEqual(issues, []);
  assert.equal(evaluateStatus(issues, tx), "VERIFIED");
  assert.equal(motorFuelGallons(tx).toString(), "118.42");
});

test("RULES are sorted by code and every issue carries its rule version", () => {
  assert.deepEqual(RULES.map((r) => r.code), [...RULES.map((r) => r.code)].sort());
  assert.equal(RULES.length, 20);
  for (const r of RULES) assert.match(r.version, new RegExp(`^${r.code}-v\\d+$`));
  const tx = cleanTx({ vendor: null, unitNumber: null, unitSource: null, purchaserName: null });
  for (const i of runRules(tx, ctx())) assert.match(i.ruleVersion, new RegExp(`^${i.code}-v\\d+$`));
});

test("unreadable gallons line yields V001 + V006 and UNABLE_TO_VERIFY", () => {
  const tx = cleanTx({
    lines: [{ category: "MOTOR_FUEL", fuelType: "DIESEL", quantity: null, unit: "gal", unitPrice: "3.899", amount: "461.72", legibility: "unreadable" }],
    fieldLegibility: { "line_items.0.quantity": "unreadable" },
  });
  const issues = runRules(tx, ctx());
  assert.ok(codes(issues).includes("V001"));
  assert.ok(codes(issues).includes("V006"));
  assert.ok(issues.find((i) => i.code === "V001")!.fields.includes("line_items.0.quantity"));
  assert.equal(evaluateStatus(issues, tx), "UNABLE_TO_VERIFY");
});

test("liters receipt yields F006 and converts gallons to 119.485", () => {
  const tx = cleanTx({
    vendor: "FLYING J WINNIPEG",
    state: "MB",
    currency: "CAD",
    receiptTotal: "763.93",
    lines: [{ category: "MOTOR_FUEL", fuelType: "DIESEL", quantity: "452.300", unit: "L", unitPrice: "1.689", amount: "763.93" }],
  });
  assert.equal(motorFuelGallons(tx).toString(), "119.485");
  const f006 = F006.check(tx, ctx());
  assert.equal(f006.length, 1);
  assert.equal(f006[0]!.evidence.conversionFactorGalPerL, "0.264172");
  assert.equal((f006[0]!.evidence.litersLines as Array<{ gallons: string }>)[0]!.gallons, "119.485");
  assert.ok(f006[0]!.fields.includes("currency"));
  assert.deepEqual(F001.check(tx, ctx()), [], "F001 uses native units (liters × CAD)");
  assert.deepEqual(F003.check(tx, ctx()), [], "F003 only for USD gallons");
});

test("V001 pass/fail: reports each missing required field", () => {
  assert.deepEqual(V001.check(cleanTx(), ctx()), []);
  const tx = cleanTx({ date: null, vendor: null, sellerAddress: null, state: null, lines: [{ category: "MOTOR_FUEL", fuelType: null, quantity: "10", unit: "gal", unitPrice: null, amount: null }] });
  const [i] = V001.check(tx, ctx());
  assert.deepEqual(i!.fields, ["transaction_date", "vendor", "seller_address", "line_items.0.fuel_type", "line_items.0.amount"]);
  assert.equal(i!.severity, "ERROR");
  assert.ok(!/invent|guess/i.test(i!.message));
  // state alone satisfies the location requirement; unit price alone satisfies amount
  assert.deepEqual(V001.check(cleanTx({ sellerAddress: null, lines: [{ category: "MOTOR_FUEL", fuelType: "DIESEL", quantity: "1", unit: null, unitPrice: "3.5", amount: null }] }), ctx()), []);
  // no motor-fuel line at all
  assert.deepEqual(V001.check(cleanTx({ lines: [{ category: "DEF", quantity: "2", unit: "gal", unitPrice: "3", amount: "6" }] }), ctx())[0]!.fields, ["line_items.motor_fuel"]);
});

test("V002 pass/fail", () => {
  assert.deepEqual(V002.check(cleanTx(), ctx()), []);
  const [i] = V002.check(cleanTx({ unitNumber: null, unitSource: "card" }), ctx());
  assert.equal(i!.severity, "WARNING");
  assert.equal(i!.evidence.unitSource, "card");
  assert.equal(V002.check(cleanTx({ unitNumber: "102", unitSource: "card" }), ctx()).length, 1, "unit from card, not on receipt");
  assert.deepEqual(V002.check(cleanTx({ unitNumber: "102", unitSource: "user" }), ctx()), []);
});

test("V003 pass/fail", () => {
  assert.deepEqual(V003.check(cleanTx(), ctx()), []);
  assert.equal(V003.check(cleanTx({ purchaserName: "  " }), ctx())[0]!.code, "V003");
});

test("V004 pass/fail: invalid date, outside period, no period", () => {
  assert.deepEqual(V004.check(cleanTx(), ctx()), []);
  assert.equal(V004.check(cleanTx({ date: "2026-02-30" }), ctx())[0]!.code, "V004");
  const [out] = V004.check(cleanTx({ date: "2026-09-30" }), ctx());
  assert.equal(out!.severity, "ERROR");
  assert.deepEqual(out!.evidence, { date: "2026-09-30", period: { start: "2026-10-01", end: "2026-12-31" } });
  assert.deepEqual(V004.check(cleanTx({ date: "2026-09-30" }), ctx({ period: null })), []);
  assert.deepEqual(V004.check(cleanTx({ date: null }), ctx()), [], "missing date is V001's job");
});

test("V005 pass/fail: missing and non-member state", () => {
  assert.deepEqual(V005.check(cleanTx(), ctx()), []);
  assert.equal(V005.check(cleanTx({ state: null }), ctx())[0]!.severity, "ERROR");
  assert.equal(V005.check(cleanTx({ state: "AK" }), ctx())[0]!.code, "V005");
});

test("V006 pass/fail lists partial and unreadable fields", () => {
  assert.deepEqual(V006.check(cleanTx(), ctx()), []);
  const [i] = V006.check(cleanTx({ fieldLegibility: { vendor: "partial", "line_items.0.amount": "unreadable" } }), ctx());
  assert.deepEqual(i!.fields, ["line_items.0.amount", "vendor"]);
  assert.deepEqual(i!.evidence, { partial: ["vendor"], unreadable: ["line_items.0.amount"] });
  // partial on a required field is a warning only, status stays VERIFIED
  const tx = cleanTx({ fieldLegibility: { vendor: "partial" } });
  assert.equal(evaluateStatus(runRules(tx, ctx()), tx), "VERIFIED");
});

test("V007 pass/fail", () => {
  assert.deepEqual(V007.check(cleanTx(), ctx()), []);
  assert.deepEqual(V007.check(cleanTx({ imageQualityScore: null }), ctx()), []);
  assert.equal(V007.check(cleanTx({ imageQualityScore: "0.35" }), ctx())[0]!.evidence.qualityThreshold, "0.5");
});

test("V010 pass/fail: numeric and case-insensitive comparison", () => {
  assert.deepEqual(MATERIAL_FIELDS, ["transaction_date", "state", "receipt_total", "currency", "vendor"]);
  const agree = cleanTx({
    passValues: {
      a: { transaction_date: "2026-10-02", receipt_total: "461.72", vendor: "Northstar Travel Center", "line_items.0.quantity": "118.42", pump_number: "4" },
      b: { transaction_date: "2026-10-02", receipt_total: "461.720", vendor: " NORTHSTAR  TRAVEL CENTER ", "line_items.0.quantity": "118.420", pump_number: "5" },
    },
  });
  assert.deepEqual(V010.check(agree, ctx()), []);
  const disagree = cleanTx({ passValues: { a: { state: "ND", receipt_total: "461.72", "line_items.0.amount": "461.72" }, b: { state: "MN", receipt_total: "416.72", "line_items.0.amount": "461.72" } } });
  const [i] = V010.check(disagree, ctx());
  assert.equal(i!.severity, "ERROR");
  assert.deepEqual(i!.fields, ["receipt_total", "state"]);
  assert.deepEqual(i!.evidence.disagreements, [
    { field: "receipt_total", passA: "461.72", passB: "416.72" },
    { field: "state", passA: "ND", passB: "MN" },
  ]);
  // one pass null, other present = not corroborated
  assert.equal(V010.check(cleanTx({ passValues: { a: { vendor: "X" }, b: {} } }), ctx()).length, 1);
  assert.deepEqual(V010.check(cleanTx({ passValues: null }), ctx()), []);
});

test("F001 pass/fail with absolute and ratio tolerance", () => {
  assert.deepEqual(F001.check(cleanTx(), ctx()), []);
  const bad = cleanTx({ lines: [{ category: "MOTOR_FUEL", fuelType: "DIESEL", quantity: "100", unit: "gal", unitPrice: "3.899", amount: "392.00" }] });
  const [i] = F001.check(bad, ctx());
  assert.equal(i!.severity, "ERROR");
  assert.equal(i!.evidence.expected, "389.9");
  assert.equal(i!.evidence.tolerance, "0.392");
  // within 0.1% of a big amount passes even though > $0.02
  const big = cleanTx({ lines: [{ category: "MOTOR_FUEL", fuelType: "DIESEL", quantity: "1000", unit: "gal", unitPrice: "4", amount: "4003.00" }] });
  assert.deepEqual(F001.check(big, ctx()), []);
  assert.deepEqual(F001.check(cleanTx({ lines: [{ category: "MOTOR_FUEL", fuelType: "DIESEL", quantity: "1", unit: "gal", unitPrice: null, amount: "9" }] }), ctx()), []);
});

test("F002 pass/fail: lines sum to total, discounts negative", () => {
  const tx = cleanTx({
    receiptTotal: "470.72",
    lines: [
      { category: "MOTOR_FUEL", fuelType: "DIESEL", quantity: "118.420", unit: "gal", unitPrice: "3.899", amount: "461.72" },
      { category: "NON_FUEL", quantity: "1", unit: "each", unitPrice: "12.00", amount: "12.00" },
      { category: "DISCOUNT", quantity: null, unit: null, unitPrice: null, amount: "-3.00" },
    ],
  });
  assert.deepEqual(F002.check(tx, ctx()), []);
  const [i] = F002.check(cleanTx({ receiptTotal: "461.80" }), ctx());
  assert.equal(i!.severity, "ERROR");
  assert.equal(i!.evidence.difference, "0.08");
  assert.deepEqual(F002.check(cleanTx({ receiptTotal: null }), ctx()), []);
  assert.deepEqual(F002.check(cleanTx({ lines: [{ category: "MOTOR_FUEL", fuelType: "DIESEL", quantity: "1", unit: "gal", unitPrice: "3", amount: null }] }), ctx()), []);
});

test("F003 pass/fail: diesel price band, USD gallons only", () => {
  assert.deepEqual(F003.check(cleanTx(), ctx()), []);
  const high = cleanTx({ lines: [{ category: "MOTOR_FUEL", fuelType: "Diesel #2", quantity: "10", unit: "gal", unitPrice: "7.25", amount: "72.50" }] });
  assert.equal(F003.check(high, ctx())[0]!.severity, "WARNING");
  const low = cleanTx({ lines: [{ category: "MOTOR_FUEL", fuelType: "DSL", quantity: "10", unit: null, unitPrice: "1.50", amount: "15.00" }] });
  assert.equal(F003.check(low, ctx()).length, 1);
  const gas = cleanTx({ lines: [{ category: "MOTOR_FUEL", fuelType: "UNLEADED", quantity: "10", unit: "gal", unitPrice: "1.50", amount: "15.00" }] });
  assert.deepEqual(F003.check(gas, ctx()), []);
});

test("F004 pass/fail: tank capacity from vehicle or default", () => {
  assert.deepEqual(F004.check(cleanTx(), ctx()), []);
  const big = cleanTx({ lines: [{ category: "MOTOR_FUEL", fuelType: "DIESEL", quantity: "301.000", unit: "gal", unitPrice: "3.899", amount: "1173.60" }] });
  const [i] = F004.check(big, ctx());
  assert.equal(i!.evidence.capacitySource, "default");
  assert.equal(i!.evidence.tankCapacityGal, "300");
  assert.deepEqual(F004.check(big, ctx({ vehicle: { tankCapacityGal: "350" } })), []);
  assert.equal(F004.check(cleanTx(), ctx({ vehicle: { tankCapacityGal: "100" } }))[0]!.evidence.capacitySource, "vehicle");
});

test("F005 pass/fail: reefer and DEF are reported, never counted", () => {
  assert.deepEqual(F005.check(cleanTx(), ctx()), []);
  const tx = cleanTx({ lines: [...cleanTx().lines, { category: "REEFER_FUEL", fuelType: "DIESEL", quantity: "40", unit: "gal", unitPrice: "3.5", amount: "140" }, { category: "DEF", quantity: "5", unit: "gal", unitPrice: "3", amount: "15" }] });
  const [i] = F005.check(tx, ctx());
  assert.equal(i!.severity, "INFO");
  assert.match(i!.message, /excluded from IFTA gallons pending preparer confirmation/);
  assert.deepEqual(i!.fields, ["line_items.1.category", "line_items.2.category"]);
  assert.equal(motorFuelGallons(tx).toString(), "118.42");
});

test("F006 passes on USD gallons", () => {
  assert.deepEqual(F006.check(cleanTx(), ctx()), []);
  assert.deepEqual(F006.check(cleanTx({ currency: null }), ctx()), []);
});

test("D002 pass/fail: duplicate within tolerances, evidence lists ids", () => {
  const dup = { id: "tx_2", vendor: "Northstar Travel Center", sellerAddress: null, date: "2026-10-02", motorFuelGallons: "118.900", receiptTotal: "461.73" };
  const far = { id: "tx_3", vendor: "NORTHSTAR TRAVEL CENTER", sellerAddress: null, date: "2026-10-02", motorFuelGallons: "120.000", receiptTotal: "461.72" };
  const otherDay = { ...dup, id: "tx_4", date: "2026-10-03" };
  const [i] = D002.check(cleanTx(), ctx({ similarTransactions: [dup, far, otherDay] }));
  assert.equal(i!.severity, "WARNING");
  assert.deepEqual(i!.evidence.matchingTransactionIds, ["tx_2"]);
  assert.deepEqual(D002.check(cleanTx(), ctx({ similarTransactions: [far, otherDay] })), []);
  assert.deepEqual(D002.check(cleanTx(), ctx()), []);
});

test("M001 pass/fail", () => {
  assert.deepEqual(M001.check(cleanTx(), ctx()), [], "not evaluated without mileage context");
  const mileage = { vehicleHasMileage: false, jurisdictionsWithMiles: new Set<string>(), fleetMpg: null };
  assert.equal(M001.check(cleanTx(), ctx({ mileage }))[0]!.severity, "ERROR");
  assert.deepEqual(M001.check(cleanTx(), ctx({ mileage: { ...mileage, vehicleHasMileage: true } })), []);
  assert.deepEqual(M001.check(cleanTx({ lines: [{ category: "DEF", quantity: "5", unit: "gal", unitPrice: "3", amount: "15" }] }), ctx({ mileage })), []);
});

test("M002 pass/fail", () => {
  const mileage = { vehicleHasMileage: true, jurisdictionsWithMiles: new Set(["ND", "MN"]), fleetMpg: "6.5" };
  assert.deepEqual(M002.check(cleanTx(), ctx({ mileage })), []);
  const [i] = M002.check(cleanTx({ state: "TX" }), ctx({ mileage }));
  assert.equal(i!.code, "M002");
  assert.deepEqual(i!.evidence.jurisdictionsWithMiles, ["MN", "ND"]);
  assert.deepEqual(M002.check(cleanTx({ state: "TX" }), ctx()), []);
  assert.deepEqual(M002.check(cleanTx({ state: "TX" }), ctx({ mileage: { ...mileage, vehicleHasMileage: false, jurisdictionsWithMiles: new Set() } })), [], "M001 covers a truck with no mileage");
});

test("M003 pass/fail", () => {
  const ok = { vehicleHasMileage: true, jurisdictionsWithMiles: new Set(["ND"]), fleetMpg: "6.50" };
  assert.deepEqual(M003.check(cleanTx(), ctx({ mileage: ok })), []);
  assert.equal(M003.check(cleanTx(), ctx({ mileage: { ...ok, fleetMpg: "12.3" } }))[0]!.severity, "WARNING");
  assert.equal(M003.check(cleanTx(), ctx({ mileage: { ...ok, fleetMpg: "3.99" } })).length, 1);
  assert.deepEqual(M003.check(cleanTx(), ctx({ mileage: { ...ok, fleetMpg: null } })), []);
});

test("M004 pass/fail: odometer must increase over time", () => {
  const history = [{ date: "2026-09-28", odometer: "412100" }, { date: "2026-10-05", odometer: "413500" }];
  assert.deepEqual(M004.check(cleanTx(), ctx({ odometerHistory: history })), []);
  const [i] = M004.check(cleanTx({ odometer: "411000" }), ctx({ odometerHistory: history }));
  assert.deepEqual(i!.evidence.conflicts, [{ date: "2026-09-28", odometer: "412100" }]);
  assert.equal((M004.check(cleanTx({ odometer: "414000" }), ctx({ odometerHistory: history }))[0]!.evidence.conflicts as unknown[]).length, 1);
  assert.deepEqual(M004.check(cleanTx({ odometer: null }), ctx({ odometerHistory: history })), []);
});

test("S001 pass/fail: distinct from V002", () => {
  assert.deepEqual(S001.check(cleanTx(), ctx()), []);
  assert.deepEqual(S001.check(cleanTx({ unitNumber: null, unitSource: "card" }), ctx()), []);
  const tx = cleanTx({ unitNumber: null, unitSource: null });
  assert.equal(S001.check(tx, ctx())[0]!.severity, "WARNING");
  assert.deepEqual(codes(runRules(tx, ctx())).filter((c) => c === "S001" || c === "V002"), ["S001", "V002"]);
});

test("evaluateStatus: error → NEEDS_ATTENTION, unreadable wins over error", () => {
  const tx = cleanTx({ state: "AK" });
  assert.equal(evaluateStatus(runRules(tx, ctx()), tx), "NEEDS_ATTENTION");
  const warnOnly = cleanTx({ purchaserName: null });
  assert.equal(evaluateStatus(runRules(warnOnly, ctx()), warnOnly), "VERIFIED");
  const unreadable = cleanTx({ state: "AK", date: null, fieldLegibility: { transaction_date: "unreadable" } });
  assert.equal(evaluateStatus(runRules(unreadable, ctx()), unreadable), "UNABLE_TO_VERIFY");
  // unreadable address is fine when the state is readable
  const addr = cleanTx({ sellerAddress: null, fieldLegibility: { seller_address: "unreadable", state: "clear" } });
  assert.equal(evaluateStatus(runRules(addr, ctx()), addr), "VERIFIED");
});
