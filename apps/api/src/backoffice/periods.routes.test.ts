import { test } from "node:test";
import assert from "node:assert/strict";
import { accessToken, addMember, companyWithOwner, createUser, prisma } from "../test/fixtures";
import { csvFile, seedDocument, seedIssue, seedJurisdictions, seedMileage, seedPeriod, seedRates, seedTransaction, seedVehicle, startTestServer, type TestServer } from "./test-harness";

let s: TestServer;
test.before(async () => {
  s = await startTestServer();
  await seedJurisdictions();
  // Fictional rate table for Q4 2026 (docs/05 fixture). Upserts, so safe across runs.
  await seedRates("2026Q4", [
    { jurisdiction: "OH", rate: "0.47" },
    { jurisdiction: "IN", rate: "0.55", surcharge: "0.21" },
    { jurisdiction: "IL", rate: "0.467" },
  ]);
});
test.after(async () => s.close());

test("summary: documents and transactions by status, verified %, open issues by severity, fuel by state, unassigned", async () => {
  const a = await companyWithOwner();
  const period = await seedPeriod(a.company.id);
  await seedDocument(a.company.id, { receivedAt: "2026-11-05T10:00:00Z", status: "RECEIVED" });
  await seedDocument(a.company.id, { receivedAt: "2026-12-31T23:30:00Z", status: "PROCESSED" });
  await seedDocument(a.company.id, { receivedAt: "2027-01-01T00:00:01Z", status: "PROCESSED" }); // outside
  const t1 = await seedTransaction(a.company.id, {
    periodId: period.id,
    status: "VERIFIED",
    state: "OH",
    date: "2026-10-15",
    lines: [
      { category: "MOTOR_FUEL", quantity: "100.000", unitPrice: "4.1250", amount: "412.50" },
      { category: "REEFER_FUEL", quantity: "20.000", amount: "82.00" },
      { category: "DEF", quantity: "2.500", amount: "12.00" },
    ],
  });
  await seedTransaction(a.company.id, { periodId: period.id, state: "OH", date: "2026-10-20", lines: [{ category: "MOTOR_FUEL", quantity: "50.500", amount: "200.00" }] });
  const t3 = await seedTransaction(a.company.id, { periodId: period.id, state: null, date: "2026-11-02" });
  await seedTransaction(a.company.id, { periodId: null, state: "IN", withDocument: false }); // not in period
  await seedIssue(a.company.id, { transactionId: t3.tx.id, code: "V005", severity: "ERROR" });
  await seedIssue(a.company.id, { transactionId: t1.tx.id, code: "F005", severity: "INFO" });
  await seedIssue(a.company.id, { transactionId: t1.tx.id, code: "F003", severity: "WARNING", status: "ACCEPTED" });

  const res = await s.api("GET", `/companies/${a.company.id}/periods/${period.id}/summary`, a.token);
  assert.equal(res.status, 200, res.text);
  const j = res.json as {
    documents: { total: number; byStatus: Record<string, number> };
    transactions: { total: number; byStatus: Record<string, number>; verifiedPercent: string };
    openIssues: Record<string, number>;
    fuelByState: unknown[];
    unassigned: number;
  };
  // 3 seeded transactions created their own documents inside the period (receivedAt = date) + 2 explicit = 5
  assert.equal(j.documents.total, 5);
  assert.equal(j.documents.byStatus.RECEIVED, 1);
  assert.equal(j.documents.byStatus.PROCESSED, 4);
  assert.equal(j.transactions.total, 3);
  assert.deepEqual(j.transactions.byStatus, { VERIFIED: 1, NEEDS_ATTENTION: 2, UNABLE_TO_VERIFY: 0 });
  assert.equal(j.transactions.verifiedPercent, "33.3");
  assert.deepEqual(j.openIssues, { ERROR: 1, WARNING: 0, INFO: 1 });
  assert.deepEqual(j.fuelByState, [{ state: "OH", motorFuelGallons: "150.500", motorFuelAmount: "612.50", reeferGallons: "20.000", defGallons: "2.500" }]);
  assert.equal(j.unassigned, 1);

  const empty = await seedPeriod(a.company.id, { start: "2026-07-01", end: "2026-09-30" });
  const e = await s.api("GET", `/companies/${a.company.id}/periods/${empty.id}/summary`, a.token);
  assert.equal((e.json as { transactions: { verifiedPercent: string } }).transactions.verifiedPercent, "0.0");
});

test("mileage import: validates every row, rejects the whole file, else writes import + records and audits; list groups totals", async () => {
  const a = await companyWithOwner();
  const period = await seedPeriod(a.company.id);
  const v101 = await seedVehicle(a.company.id, "101");
  await seedVehicle(a.company.id, "102");
  const url = `/companies/${a.company.id}/periods/${period.id}/mileage-imports`;

  const bad = await s.api("POST", url, a.token, csvFile("miles.csv", "Unit,State,Total Miles,Taxable Miles\r\n101,OH,1200,\r\n103,XX,-4,\r\n102,IN,abc,\r\n"));
  assert.equal(bad.status, 400, bad.text);
  assert.equal(bad.json.error, "mileage_rows_invalid");
  assert.deepEqual(
    (bad.json.details as Array<{ row: number; field: string }>).map((d) => `${d.row}:${d.field}`),
    ["3:unit", "3:jurisdiction", "3:total_miles", "3:taxable_miles", "4:total_miles", "4:taxable_miles"],
  );
  assert.equal(await prisma.mileageImport.count({ where: { companyId: a.company.id } }), 0, "nothing imported");
  assert.equal((await s.api("POST", url, a.token, csvFile("x.csv", "unit,miles\n101,5\n"))).status, 400, "missing jurisdiction column");
  assert.equal((await s.api("POST", url, a.token)).status, 400, "no file");

  const fd = csvFile("miles.csv", "unit,jurisdiction,total_miles,taxable_miles\n101,OH,7000,7000\n101,IN,6000,6000\n102,OH,5500,5500\n102,in,4000,3900\n");
  fd.append("provider", "motive");
  const ok = await s.api("POST", url, a.token, fd);
  assert.equal(ok.status, 201, ok.text);
  const imp = ok.json.mileageImport as { id: string; provider: string; rows: number };
  assert.equal(imp.provider, "motive");
  assert.equal(imp.rows, 4);
  const records = await prisma.mileageRecord.findMany({ where: { importId: imp.id }, orderBy: [{ vehicleId: "asc" }, { jurisdiction: "asc" }] });
  assert.equal(records.length, 4);
  assert.ok(records.every((r) => r.companyId === a.company.id && r.periodStart.toISOString().startsWith("2026-10-01") && r.periodEnd.toISOString().startsWith("2026-12-31")));
  assert.equal(records.find((r) => r.vehicleId === v101.id && r.jurisdiction === "IN")!.totalMiles.toString(), "6000");
  const log = await prisma.auditLog.findFirst({ where: { companyId: a.company.id, action: "upload", target: `MileageImport:${imp.id}` } });
  assert.equal((log!.meta as { rows: number }).rows, 4);

  const list = await s.api("GET", `/companies/${a.company.id}/periods/${period.id}/mileage`, a.token);
  assert.equal(list.status, 200, list.text);
  const m = list.json as { records: Array<{ vehicle: { unitNumber: string } }>; byVehicle: Array<{ unitNumber: string; totalMiles: string; taxableMiles: string }>; byJurisdiction: Array<{ jurisdiction: string; totalMiles: string }>; totals: { totalMiles: string; taxableMiles: string } };
  assert.equal(m.records.length, 4);
  assert.equal(m.records[0]!.vehicle.unitNumber, "101");
  assert.deepEqual(
    m.byVehicle.map((x) => [x.unitNumber, x.totalMiles, x.taxableMiles]),
    [
      ["101", "13000.000", "13000.000"],
      ["102", "9500.000", "9400.000"],
    ],
  );
  assert.deepEqual(
    m.byJurisdiction.map((x) => [x.jurisdiction, x.totalMiles]),
    [
      ["IN", "10000.000"],
      ["OH", "12500.000"],
    ],
  );
  assert.deepEqual(m.totals, { totalMiles: "22500.000", taxableMiles: "22400.000" });

  // Records from another period are not listed.
  const q3 = await seedPeriod(a.company.id, { start: "2026-07-01", end: "2026-09-30" });
  const q3list = await s.api("GET", `/companies/${a.company.id}/periods/${q3.id}/mileage`, a.token);
  assert.deepEqual((q3list.json as { records: unknown[] }).records, []);
});

test("IFTA worksheet: motor fuel only, rates from the table, docs/05 figures, PRELIMINARY until approved with no open errors", async () => {
  const a = await companyWithOwner();
  const period = await seedPeriod(a.company.id);
  const v1 = await seedVehicle(a.company.id, "T1");
  const v2 = await seedVehicle(a.company.id, "T2");
  await seedMileage(a.company.id, null, v1.id, [
    { jurisdiction: "OH", total: "7000" },
    { jurisdiction: "IN", total: "6000" },
    { jurisdiction: "IL", total: "4000" },
  ]);
  await seedMileage(a.company.id, null, v2.id, [
    { jurisdiction: "OH", total: "5500" },
    { jurisdiction: "IN", total: "4000" },
    { jurisdiction: "IL", total: "3500" },
  ]);
  // Fuel: OH 2600 (as 2000 + 600, with reefer and DEF that must be ignored), IN 1200, IL 1000.
  await seedTransaction(a.company.id, {
    periodId: period.id,
    state: "OH",
    lines: [
      { category: "MOTOR_FUEL", quantity: "2000.000", amount: "8000.00" },
      { category: "REEFER_FUEL", quantity: "300.000", amount: "1200.00" },
      { category: "DEF", quantity: "25.000", amount: "100.00" },
    ],
  });
  await seedTransaction(a.company.id, { periodId: period.id, state: "OH", lines: [{ category: "MOTOR_FUEL", quantity: "600.000", amount: "2400.00" }] });
  await seedTransaction(a.company.id, { periodId: period.id, state: "IN", lines: [{ category: "MOTOR_FUEL", quantity: "1200.000", amount: "4800.00" }] });
  await seedTransaction(a.company.id, { periodId: period.id, state: "IL", lines: [{ category: "MOTOR_FUEL", quantity: "1000.000", amount: "4000.00" }] });
  const unassigned = await seedTransaction(a.company.id, { periodId: period.id, state: null, lines: [{ category: "MOTOR_FUEL", quantity: "77.000", amount: "300.00" }] });
  await seedTransaction(a.company.id, { periodId: null, state: "OH", lines: [{ category: "MOTOR_FUEL", quantity: "500.000", amount: "2000.00" }] }); // other period

  const url = `/companies/${a.company.id}/periods/${period.id}/ifta-worksheet`;
  const res = await s.api("GET", url, a.token);
  assert.equal(res.status, 200, res.text);
  const j = res.json as {
    status: string;
    unassignedTransactions: number;
    worksheet: { fleetMpg: string; totals: { totalMiles: string; totalTaxableGallons: string; totalTaxDue: string }; rows: Array<Record<string, string | null>>; roundingNotes: string[]; ratesMissing: boolean };
    rateSource: { quarter: string; sourceUrl: string; importedAt: string };
    disclaimer: string;
  };
  assert.equal(j.status, "PRELIMINARY");
  assert.equal(j.unassignedTransactions, 1);
  assert.equal(j.worksheet.fleetMpg, "6.25");
  assert.equal(j.worksheet.totals.totalMiles, "30000.000");
  assert.equal(j.worksheet.totals.totalTaxableGallons, "4800.000", "reefer, DEF, unassigned and other-period gallons excluded");
  assert.deepEqual(
    j.worksheet.rows.map((r) => [r.jurisdiction, r.gallonsConsumed, r.taxPaidGallons, r.netTaxableGallons, r.rate, r.surcharge, r.taxDue]),
    [
      ["IL", "1200.000", "1000.000", "200.000", "0.46700", null, "93.40"],
      ["IN", "1600.000", "1200.000", "400.000", "0.55000", "0.21000", "304.00"],
      ["OH", "2000.000", "2600.000", "-600.000", "0.47000", null, "-282.00"],
    ],
  );
  assert.equal(j.worksheet.totals.totalTaxDue, "115.40");
  assert.equal(j.worksheet.ratesMissing, false);
  assert.ok(j.worksheet.roundingNotes.length >= 7);
  assert.equal(j.rateSource.quarter, "2026Q4");
  assert.equal(j.rateSource.sourceUrl, "https://example.test/rates");
  assert.equal(j.disclaimer, "Prepared for review by a qualified preparer; not a filed return.");

  // Approved period but an open ERROR issue → still PRELIMINARY; resolve it → REVIEWED.
  await prisma.reportingPeriod.update({ where: { id: period.id }, data: { status: "APPROVED" } });
  const issue = await seedIssue(a.company.id, { transactionId: unassigned.tx.id, code: "V005", severity: "ERROR" });
  assert.equal((await s.api("GET", url, a.token)).json.status, "PRELIMINARY");
  await s.api("POST", `/companies/${a.company.id}/issues/${issue.id}/resolve`, a.token, { note: "state set by hand" });
  const reviewed = await s.api("GET", url, a.token);
  assert.equal(reviewed.json.status, "REVIEWED");
  assert.equal(reviewed.json.openErrorIssues, 0);
});

test("IFTA worksheet without a loaded rate table answers 409 I001 and never invents rates", async () => {
  const a = await companyWithOwner();
  const period = await seedPeriod(a.company.id, { start: "2019-01-01", end: "2019-03-31" });
  const v = await seedVehicle(a.company.id, "T9");
  await seedMileage(a.company.id, null, v.id, [{ jurisdiction: "OH", total: "100" }], { start: "2019-01-01", end: "2019-03-31" });
  const res = await s.api("GET", `/companies/${a.company.id}/periods/${period.id}/ifta-worksheet`, a.token);
  assert.equal(res.status, 409, res.text);
  assert.equal(res.json.error, "ifta_rates_missing");
  assert.equal(res.json.code, "I001");
  assert.equal(res.json.quarter, "2019Q1");
  assert.equal(res.json.worksheet, undefined);
});

test("tenancy and roles on period routes", async () => {
  const a = await companyWithOwner();
  const b = await companyWithOwner();
  const period = await seedPeriod(a.company.id);
  const driver = await createUser("DRIVER");
  await addMember(driver.id, a.company.id, "DRIVER");
  const dt = accessToken(driver.id, "DRIVER");
  for (const path of ["summary", "mileage", "ifta-worksheet"]) {
    assert.equal((await s.api("GET", `/companies/${a.company.id}/periods/${period.id}/${path}`, b.token)).status, 404, path);
    assert.equal((await s.api("GET", `/companies/${b.company.id}/periods/${period.id}/${path}`, b.token)).status, 404, `${path} via own prefix`);
  }
  assert.equal((await s.api("POST", `/companies/${a.company.id}/periods/${period.id}/mileage-imports`, b.token, csvFile("m.csv", "unit,state,miles\n1,OH,1\n"))).status, 404);
  assert.equal((await s.api("POST", `/companies/${a.company.id}/periods/${period.id}/mileage-imports`, dt, csvFile("m.csv", "unit,state,miles\n1,OH,1\n"))).status, 403);
  assert.equal(await prisma.mileageImport.count({ where: { companyId: a.company.id } }), 0);
});
