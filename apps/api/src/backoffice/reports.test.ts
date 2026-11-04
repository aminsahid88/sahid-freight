import { test } from "node:test";
import assert from "node:assert/strict";
import { computeIftaWorksheet, iftaWorksheetToJson } from "@tbo/core";
import { buildIftaWorksheetCsv, buildTransactionsCsv, IFTA_CSV_COLUMNS, snapshotHash, TRANSACTIONS_CSV_COLUMNS, type TransactionCsvRow } from "./reports";
import { countBy, fuelByState, verifiedPercent } from "./summary";
import { parseCsv } from "./periods.routes";

function row(over: Partial<TransactionCsvRow> = {}): TransactionCsvRow {
  return {
    id: "tx-b",
    status: "VERIFIED",
    date: new Date("2026-10-15T00:00:00Z"),
    time: "08:15",
    vendor: 'Pilot "Flying J", Exit 4',
    sellerAddress: "1 Demo Rd, Columbus, OH",
    state: "OH",
    stateSource: "printed",
    vehicleUnit: "101",
    driver: "Demo Driver",
    lines: [
      { category: "MOTOR_FUEL", fuelType: "diesel", quantity: "100.5", unitPrice: "4.125", amount: "414.56" },
      { category: "REEFER_FUEL", fuelType: "diesel", quantity: "20", unitPrice: "4.1", amount: "82.00" },
      { category: "DEF", fuelType: null, quantity: "2.5", unitPrice: null, amount: "12.00" },
      { category: "NON_FUEL", fuelType: null, quantity: null, unitPrice: null, amount: "9.99" },
      { category: "TAX", fuelType: null, quantity: null, unitPrice: null, amount: "1.5" },
      { category: "FEE", fuelType: null, quantity: null, unitPrice: null, amount: "0.75" },
      { category: "DISCOUNT", fuelType: null, quantity: null, unitPrice: null, amount: "-5" },
    ],
    receiptTotal: "515.8",
    paymentMethod: "card",
    cardLast4: "4242",
    cardMatchId: null,
    corroboration: "TWO_PASS",
    openIssueCodes: ["F002", "D002"],
    sourceDocumentId: "doc-1",
    sourceFilename: "receipt.png",
    sourcePage: 1,
    lastEditedBy: "Reviewer One",
    lastEditedAt: new Date("2026-11-01T10:00:00Z"),
    ...over,
  };
}

test("transactions CSV has exactly the 31 columns of docs/08 in order", () => {
  assert.equal(TRANSACTIONS_CSV_COLUMNS.length, 31);
  assert.equal(TRANSACTIONS_CSV_COLUMNS[0], "transaction_id");
  assert.equal(TRANSACTIONS_CSV_COLUMNS[20], "receipt_total");
  assert.equal(TRANSACTIONS_CSV_COLUMNS[30], "last_edited_at");
  const csv = buildTransactionsCsv([row()]);
  const [header, line] = csv.split("\r\n");
  assert.equal(header, TRANSACTIONS_CSV_COLUMNS.join(","));
  assert.equal(
    line,
    'tx-b,VERIFIED,2026-10-15,08:15,"Pilot ""Flying J"", Exit 4","1 Demo Rd, Columbus, OH",OH,printed,101,Demo Driver,diesel,100.500,4.1250,414.56,20.000,2.500,9.99,1.50,0.75,-5.00,515.80,card,4242,,TWO_PASS,D002|F002,doc-1,receipt.png,1,Reviewer One,2026-11-01T10:00:00.000Z',
  );
  assert.ok(csv.endsWith("\r\n"));
});

test("rows sort by date then id, null dates last, and identical data hashes identically", () => {
  const rows = [row({ id: "tx-b" }), row({ id: "tx-a" }), row({ id: "tx-z", date: null }), row({ id: "tx-c", date: new Date("2026-10-01T00:00:00Z") })];
  const csv = buildTransactionsCsv(rows);
  const ids = csv.split("\r\n").slice(1, 5).map((l) => l.split(",")[0]);
  assert.deepEqual(ids, ["tx-c", "tx-a", "tx-b", "tx-z"]);
  assert.equal(snapshotHash(csv), snapshotHash(buildTransactionsCsv([...rows].reverse())));
  assert.notEqual(snapshotHash(csv), snapshotHash(buildTransactionsCsv(rows.slice(1))));
  // Empty values stay empty, never "null" or "0".
  const blank = buildTransactionsCsv([row({ lines: [], receiptTotal: null, vendor: null, lastEditedAt: null, lastEditedBy: null, sourcePage: null })]).split("\r\n")[1]!;
  assert.equal(blank, "tx-b,VERIFIED,2026-10-15,08:15,,\"1 Demo Rd, Columbus, OH\",OH,printed,101,Demo Driver,,,,,,,,,,,,card,4242,,TWO_PASS,D002|F002,doc-1,receipt.png,,,");
});

test("IFTA worksheet CSV carries a status column, one row per jurisdiction and a totals row", () => {
  const w = iftaWorksheetToJson(
    computeIftaWorksheet({
      mileage: [
        { vehicleId: "v", jurisdiction: "OH", totalMiles: "12500", taxableMiles: "12500" },
        { vehicleId: "v", jurisdiction: "IN", totalMiles: "10000", taxableMiles: "10000" },
        { vehicleId: "v", jurisdiction: "IL", totalMiles: "7500", taxableMiles: "7500" },
      ],
      fuel: [
        { jurisdiction: "OH", gallons: "2600" },
        { jurisdiction: "IN", gallons: "1200" },
        { jurisdiction: "IL", gallons: "1000" },
      ],
      rates: [
        { jurisdiction: "OH", rate: "0.47" },
        { jurisdiction: "IN", rate: "0.55", surcharge: "0.21" },
        { jurisdiction: "IL", rate: "0.467" },
      ],
    }),
  );
  const csv = buildIftaWorksheetCsv(w, "PRELIMINARY", "2026Q4");
  const lines = csv.trimEnd().split("\r\n");
  assert.equal(lines[0], IFTA_CSV_COLUMNS.join(","));
  assert.equal(lines.length, 5);
  assert.equal(lines[1], "PRELIMINARY,IL,7500.000,7500.000,1200.000,1000.000,200.000,0.46700,,93.40,6.25,2026Q4");
  assert.equal(lines[2], "PRELIMINARY,IN,10000.000,10000.000,1600.000,1200.000,400.000,0.55000,0.21000,304.00,6.25,2026Q4");
  assert.equal(lines[3], "PRELIMINARY,OH,12500.000,12500.000,2000.000,2600.000,-600.000,0.47000,,-282.00,6.25,2026Q4");
  assert.equal(lines[4], "PRELIMINARY,TOTAL,30000.000,30000.000,4800.000,4800.000,0.000,,,115.40,6.25,2026Q4");
  assert.notEqual(snapshotHash(csv), snapshotHash(buildIftaWorksheetCsv(w, "REVIEWED", "2026Q4")));
});

test("summary: fuel by state separates motor fuel, reefer and DEF; null states are skipped", () => {
  const out = fuelByState([
    { state: "OH", category: "MOTOR_FUEL", quantity: "100.5", amount: "414.56" },
    { state: "OH", category: "MOTOR_FUEL", quantity: "50", amount: "200" },
    { state: "OH", category: "REEFER_FUEL", quantity: "20", amount: "82" },
    { state: "OH", category: "DEF", quantity: "2.5", amount: "12" },
    { state: "OH", category: "NON_FUEL", quantity: null, amount: "9.99" },
    { state: "IN", category: "MOTOR_FUEL", quantity: null, amount: "10" },
    { state: null, category: "MOTOR_FUEL", quantity: "999", amount: "999" },
  ]);
  assert.deepEqual(out, [
    { state: "IN", motorFuelGallons: "0.000", motorFuelAmount: "10.00", reeferGallons: "0.000", defGallons: "0.000" },
    { state: "OH", motorFuelGallons: "150.500", motorFuelAmount: "614.56", reeferGallons: "20.000", defGallons: "2.500" },
  ]);
  assert.equal(verifiedPercent(0, 0), "0.0");
  assert.equal(verifiedPercent(1, 3), "33.3");
  assert.equal(verifiedPercent(2, 3), "66.7");
  assert.equal(verifiedPercent(3, 3), "100.0");
  assert.deepEqual(countBy([{ key: "ERROR", count: 2 }], ["ERROR", "WARNING", "INFO"] as const), { ERROR: 2, WARNING: 0, INFO: 0 });
});

test("CSV reader: quotes, CRLF, BOM, blank lines", () => {
  assert.deepEqual(parseCsv('a,b\r\n"x, y","say ""hi"""\n\n1,2\r\n'), [
    ["a", "b"],
    ["x, y", 'say "hi"'],
    ["1", "2"],
  ]);
  assert.deepEqual(parseCsv("\ufeffunit,state\r\n101,oh\r\n"), [
    ["unit", "state"],
    ["101", "oh"],
  ]);
});
