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

function mileageForm(csv: string, fields: Record<string, string> = {}): FormData {
  const fd = csvFile("miles.csv", csv);
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

test("mileage preview: detects layout and columns, parses every row, lists unknown units and the saved mapping", async () => {
  const a = await companyWithOwner();
  const period = await seedPeriod(a.company.id);
  await seedVehicle(a.company.id, "101");
  const url = `/companies/${a.company.id}/periods/${period.id}/mileage-imports/preview`;

  const csv = "Vehicle,Jurisdiction,Total Distance (mi),Taxable Distance (mi)\r\n101,OH,1200,1200\r\n101,IN,300,\r\n104,MN,50,50\r\nTotal,,1550,\r\n";
  const res = await s.api("POST", url, a.token, mileageForm(csv, { provider: "motive" }));
  assert.equal(res.status, 200, res.text);
  const j = res.json as { layout: string; mapping: Record<string, string>; missing: string[]; distanceUnit: string; savedMapping: unknown; parse: { records: Array<{ unit: string; jurisdiction: string; totalMiles: string }>; errors: Array<{ row: number; field: string }>; skipped: number; unknownUnits: string[]; unitsSeen: string[] } };
  assert.equal(j.layout, "long");
  assert.equal(j.mapping.unit, "Vehicle");
  assert.equal(j.mapping.totalMiles, "Total Distance (mi)");
  assert.deepEqual(j.missing, []);
  assert.equal(j.distanceUnit, "mi");
  assert.equal(j.savedMapping, null);
  assert.deepEqual(j.parse.records.map((r) => [r.unit, r.jurisdiction, r.totalMiles]), [["101", "IN", "300.000"], ["101", "OH", "1200.000"]]);
  assert.deepEqual(j.parse.errors.map((e) => `${e.row}:${e.field}`), ["4:unit"]);
  assert.deepEqual(j.parse.unknownUnits, ["104"]);
  assert.equal(j.parse.skipped, 1);

  const wide = await s.api("POST", url, a.token, mileageForm("Unit,OH,IN,Total\n101,500,250,750\n", { provider: "generic" }));
  assert.equal(wide.status, 200, wide.text);
  assert.equal(wide.json.layout, "wide");
  assert.deepEqual(wide.json.jurisdictionColumns, ["OH", "IN"]);
  assert.deepEqual(wide.json.mapping, { unit: "Unit" });

  await prisma.setting.create({ data: { companyId: a.company.id, key: "mileage_mapping:motive", value: { layout: "long", distanceUnit: "km", mapping: { unit: "Vehicle", jurisdiction: "Jurisdiction", totalMiles: "Total Distance (mi)" } } } });
  const saved = await s.api("POST", url, a.token, mileageForm(csv, { provider: "motive" }));
  assert.equal(saved.json.distanceUnit, "km", "saved unit wins over the header suggestion");
  assert.equal((saved.json.parse as { records: Array<{ totalMiles: string }> }).records[1]!.totalMiles, "745.644", "1200 km in miles");
  assert.equal((await s.api("POST", url, a.token, mileageForm(csv, { provider: "motive", distanceUnit: "mi" }))).json.distanceUnit, "mi", "explicit choice wins");
  assert.equal((await s.api("POST", url, a.token)).status, 400, "no file");
});

test("mileage import: rejects the whole file on any row problem, writes records, supersedes earlier rows per vehicle, refuses the same file twice, lists history", async () => {
  const a = await companyWithOwner();
  const period = await seedPeriod(a.company.id);
  const v101 = await seedVehicle(a.company.id, "101");
  const v102 = await seedVehicle(a.company.id, "102");
  const url = `/companies/${a.company.id}/periods/${period.id}/mileage-imports`;

  const bad = await s.api("POST", url, a.token, mileageForm("Unit,State,Total Miles,Taxable Miles\r\n101,OH,1200,\r\n103,XX,-4,\r\n102,IN,abc,\r\n"));
  assert.equal(bad.status, 400, bad.text);
  assert.equal(bad.json.error, "mileage_rows_invalid");
  const details = bad.json.details as { errors: Array<{ row: number; field: string }>; unknownUnits: string[] };
  assert.deepEqual(details.errors.map((d) => `${d.row}:${d.field}`), ["3:unit", "3:jurisdiction", "3:totalMiles", "4:totalMiles"]);
  assert.deepEqual(details.unknownUnits, ["103"]);
  assert.equal(await prisma.mileageImport.count({ where: { companyId: a.company.id } }), 0, "nothing imported");
  assert.equal((await s.api("POST", url, a.token, csvFile("x.csv", "unit,miles\n101,5\n"))).status, 400, "missing jurisdiction column");
  assert.equal((await s.api("POST", url, a.token)).status, 400, "no file");

  const first = "unit,jurisdiction,total_miles,taxable_miles\n101,OH,7000,7000\n101,IN,6000,6000\n102,OH,5500,5500\n102,in,4000,3900\n";
  const ok = await s.api("POST", url, a.token, mileageForm(first, { provider: "motive", saveMapping: "true" }));
  assert.equal(ok.status, 201, ok.text);
  const imp = ok.json.mileageImport as { id: string; provider: string; rows: number; layout: string; distanceUnit: string; mappingVersion: string };
  assert.equal(imp.provider, "motive");
  assert.equal(imp.rows, 4);
  assert.equal(imp.layout, "long");
  assert.equal(imp.distanceUnit, "mi");
  assert.match(imp.mappingVersion, /^motive:long:mi:[0-9a-f]{8}$/);
  assert.deepEqual(ok.json.superseded, { records: 0, imports: 0 });
  const records = await prisma.mileageRecord.findMany({ where: { importId: imp.id }, orderBy: [{ vehicleId: "asc" }, { jurisdiction: "asc" }] });
  assert.equal(records.length, 4);
  assert.ok(records.every((r) => r.companyId === a.company.id && r.periodStart.toISOString().startsWith("2026-10-01") && r.periodEnd.toISOString().startsWith("2026-12-31") && r.supersededAt === null));
  assert.equal(records.find((r) => r.vehicleId === v101.id && r.jurisdiction === "IN")!.totalMiles.toString(), "6000");
  const log = await prisma.auditLog.findFirst({ where: { companyId: a.company.id, action: "upload", target: `MileageImport:${imp.id}` } });
  assert.equal((log!.meta as { rows: number }).rows, 4);
  const setting = await prisma.setting.findUnique({ where: { companyId_key: { companyId: a.company.id, key: "mileage_mapping:motive" } } });
  assert.deepEqual(setting!.value, { layout: "long", distanceUnit: "mi", mapping: { unit: "unit", jurisdiction: "jurisdiction", totalMiles: "total_miles", taxableMiles: "taxable_miles" } });

  // The same bytes again → 409, nothing written.
  const dup = await s.api("POST", url, a.token, mileageForm(first, { provider: "motive" }));
  assert.equal(dup.status, 409, dup.text);
  assert.equal(dup.json.error, "mileage_duplicate_file");
  assert.equal(await prisma.mileageImport.count({ where: { companyId: a.company.id } }), 1);

  // A corrected file for unit 101 only supersedes 101's rows; 102 keeps its rows from the first file.
  const second = "unit,jurisdiction,total_miles\n101,OH,7100\n101,MN,900\n";
  const again = await s.api("POST", url, a.token, mileageForm(second, { provider: "motive" }));
  assert.equal(again.status, 201, again.text);
  assert.deepEqual(again.json.superseded, { records: 2, imports: 1 });
  const superseded = await prisma.mileageRecord.findMany({ where: { importId: imp.id, supersededAt: { not: null } } });
  assert.deepEqual(superseded.map((r) => r.vehicleId).sort(), [v101.id, v101.id]);
  assert.ok(superseded.every((r) => r.supersededByImportId === (again.json.mileageImport as { id: string }).id));
  assert.equal(await prisma.mileageRecord.count({ where: { companyId: a.company.id } }), 6, "nothing deleted");

  const list = await s.api("GET", `/companies/${a.company.id}/periods/${period.id}/mileage`, a.token);
  assert.equal(list.status, 200, list.text);
  const m = list.json as { records: Array<{ vehicle: { unitNumber: string } }>; byVehicle: Array<{ unitNumber: string; jurisdictions: string[]; totalMiles: string; taxableMiles: string }>; byJurisdiction: Array<{ jurisdiction: string; totalMiles: string }>; totals: { totalMiles: string; taxableMiles: string } };
  assert.equal(m.records.length, 4, "active rows only");
  assert.deepEqual(
    m.byVehicle.map((x) => [x.unitNumber, x.jurisdictions, x.totalMiles, x.taxableMiles]),
    [
      ["101", ["MN", "OH"], "8000.000", "8000.000"],
      ["102", ["IN", "OH"], "9500.000", "9400.000"],
    ],
  );
  assert.deepEqual(m.byJurisdiction.map((x) => [x.jurisdiction, x.totalMiles]), [["IN", "4000.000"], ["MN", "900.000"], ["OH", "12600.000"]]);
  assert.deepEqual(m.totals, { totalMiles: "17500.000", taxableMiles: "17400.000" });

  const history = await s.api("GET", url, a.token);
  assert.equal(history.status, 200, history.text);
  const h = history.json.imports as Array<{ id: string; rows: number; activeRows: number; filename: string; layout: string }>;
  assert.equal(h.length, 2);
  assert.deepEqual(h.map((x) => [x.rows, x.activeRows]), [[2, 2], [4, 2]]);
  assert.equal(h[1]!.id, imp.id);
  assert.equal(h[0]!.filename, "miles.csv");

  // Records from another period are not listed.
  const q3 = await seedPeriod(a.company.id, { start: "2026-07-01", end: "2026-09-30" });
  const q3list = await s.api("GET", `/companies/${a.company.id}/periods/${q3.id}/mileage`, a.token);
  assert.deepEqual((q3list.json as { records: unknown[] }).records, []);
  void v102;
});

test("mileage import: wide layout in kilometres converts to miles; dates outside the quarter are refused", async () => {
  const a = await companyWithOwner();
  const period = await seedPeriod(a.company.id);
  await seedVehicle(a.company.id, "T1");
  const url = `/companies/${a.company.id}/periods/${period.id}/mileage-imports`;
  const res = await s.api("POST", url, a.token, mileageForm("Unit,OH,IN,MN,Total\nT1,\"1,000\",0,-,1000\nFleet total,1000,0,0,1000\n", { provider: "samsara", distanceUnit: "km" }));
  assert.equal(res.status, 201, res.text);
  const imp = res.json.mileageImport as { rows: number; layout: string; distanceUnit: string; skipped: number };
  assert.deepEqual([imp.rows, imp.layout, imp.distanceUnit, imp.skipped], [1, "wide", "km", 1]);
  const rec = await prisma.mileageRecord.findFirst({ where: { companyId: a.company.id } });
  assert.equal(rec!.jurisdiction, "OH");
  assert.equal(rec!.totalMiles.toString(), "621.37");

  const wrongQuarter = await s.api("POST", url, a.token, mileageForm("unit,state,miles,start date,end date\nT1,OH,10,2026-07-01,2026-09-30\n"));
  assert.equal(wrongQuarter.status, 400, wrongQuarter.text);
  assert.match((wrongQuarter.json.details as { errors: Array<{ message: string }> }).errors[0]!.message, /outside the quarter/);
});

test("mileage import re-evaluates M001/M002/M003 and transaction status; human-handled issues are kept", async () => {
  const a = await companyWithOwner();
  const period = await seedPeriod(a.company.id);
  const v101 = await seedVehicle(a.company.id, "101");
  const v102 = await seedVehicle(a.company.id, "102");
  const url = `/companies/${a.company.id}/periods/${period.id}/mileage-imports`;
  // 101 bought fuel in OH and IN; 102 in MN. Only an open M001 error keeps t1 from VERIFIED.
  const { tx: t1 } = await seedTransaction(a.company.id, { periodId: period.id, vehicleId: v101.id, state: "OH", status: "NEEDS_ATTENTION" });
  const { tx: t2 } = await seedTransaction(a.company.id, { periodId: period.id, vehicleId: v101.id, state: "IN", status: "NEEDS_ATTENTION" });
  const { tx: t3 } = await seedTransaction(a.company.id, { periodId: period.id, vehicleId: v102.id, state: "MN", status: "NEEDS_ATTENTION" });
  await seedIssue(a.company.id, { transactionId: t1.id, code: "M001", severity: "ERROR" });
  await seedIssue(a.company.id, { transactionId: t2.id, code: "M001", severity: "ERROR" });
  await seedIssue(a.company.id, { transactionId: t2.id, code: "F002", severity: "ERROR", status: "ACCEPTED" });
  await seedIssue(a.company.id, { transactionId: t3.id, code: "M001", severity: "ERROR" });

  // 101 drove OH only (no IN miles) → M001 resolved on t1/t2, M002 opens on t2; 102 has no mileage → M001 stays.
  // Fleet: 7000 mi / 300 gal = 23.33 MPG → above the 9.0 band → M003 once, on the period.
  const res = await s.api("POST", url, a.token, mileageForm("unit,jurisdiction,total_miles\n101,OH,7000\n", { provider: "generic" }));
  assert.equal(res.status, 201, res.text);
  const rules = res.json.rules as { transactionsChecked: number; fleetMpg: string; opened: Record<string, number>; resolved: number };
  assert.equal(rules.transactionsChecked, 3);
  assert.equal(rules.fleetMpg, "23.33");
  assert.deepEqual(rules.opened, { M001: 0, M002: 1, M003: 1 });
  assert.equal(rules.resolved, 2);

  const open = async (txId: string | null, code: string) => prisma.issue.findMany({ where: { companyId: a.company.id, transactionId: txId, code, status: "OPEN" } });
  assert.equal((await open(t1.id, "M001")).length, 0);
  assert.equal((await open(t2.id, "M001")).length, 0);
  assert.equal((await open(t2.id, "M002")).length, 1);
  assert.equal((await open(t3.id, "M001")).length, 1);
  assert.equal((await prisma.issue.findFirst({ where: { transactionId: t2.id, code: "F002" } }))!.status, "ACCEPTED", "human decision kept");
  const m003 = await open(null, "M003");
  assert.equal(m003.length, 1);
  assert.equal((m003[0]!.evidence as { periodId: string }).periodId, period.id);
  assert.equal((await prisma.issue.findFirst({ where: { transactionId: t1.id, code: "M001" } }))!.resolutionNote, "No longer flagged after the mileage import");

  assert.equal((await prisma.transaction.findUnique({ where: { id: t1.id } }))!.status, "VERIFIED", "no open error left");
  assert.equal((await prisma.transaction.findUnique({ where: { id: t2.id } }))!.status, "VERIFIED", "M002 is only a warning");
  assert.equal((await prisma.transaction.findUnique({ where: { id: t3.id } }))!.status, "NEEDS_ATTENTION");

  // Period summary counts the period-level M003 among open warnings.
  const summary = await s.api("GET", `/companies/${a.company.id}/periods/${period.id}/summary`, a.token);
  assert.equal((summary.json as { openIssues: { WARNING: number } }).openIssues.WARNING, 2);

  // Importing 102's miles and 101's IN miles clears the rest; MPG back in band resolves M003.
  const fix = await s.api("POST", url, a.token, mileageForm("unit,jurisdiction,total_miles\n101,OH,1000\n101,IN,200\n102,MN,600\n", { provider: "generic" }));
  assert.equal(fix.status, 201, fix.text);
  const r2 = fix.json.rules as { fleetMpg: string; opened: Record<string, number>; resolved: number };
  assert.equal(r2.fleetMpg, "6.00");
  assert.deepEqual(r2.opened, { M001: 0, M002: 0, M003: 0 });
  assert.equal(r2.resolved, 3, "M002 on t2, M001 on t3, M003 on the period");
  assert.equal((await prisma.transaction.findUnique({ where: { id: t3.id } }))!.status, "VERIFIED");
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
