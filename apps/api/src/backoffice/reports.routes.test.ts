import { test } from "node:test";
import assert from "node:assert/strict";
import { accessToken, addMember, companyWithOwner, createUser, prisma } from "../test/fixtures";
import { parseCsv } from "./periods.routes";
import { TRANSACTIONS_CSV_COLUMNS } from "./reports";
import { seedIssue, seedJurisdictions, seedMileage, seedPeriod, seedRates, seedTransaction, seedVehicle, startTestServer, type TestServer } from "./test-harness";

let s: TestServer;
test.before(async () => {
  s = await startTestServer();
  await seedJurisdictions();
  await seedRates("2026Q4", [
    { jurisdiction: "OH", rate: "0.47" },
    { jurisdiction: "IN", rate: "0.55", surcharge: "0.21" },
    { jurisdiction: "IL", rate: "0.467" },
  ]);
});
test.after(async () => s.close());

async function download(url: string): Promise<string> {
  const signed = new URL(url);
  const res = await fetch(`${s.base}${signed.pathname}${signed.search}`);
  assert.equal(res.status, 200);
  return res.text();
}

test("transactions CSV report: 31 columns, one row per transaction in the period, stored with a stable snapshot hash", async () => {
  const a = await companyWithOwner();
  const period = await seedPeriod(a.company.id);
  const vehicle = await seedVehicle(a.company.id, "101");
  const t1 = await seedTransaction(a.company.id, { periodId: period.id, vehicleId: vehicle.id, date: "2026-10-15", vendor: 'Pilot "Flying J", Exit 4', receiptTotal: "412.50" });
  const t2 = await seedTransaction(a.company.id, { periodId: period.id, date: "2026-10-02", lines: [{ category: "MOTOR_FUEL", quantity: "50.000", unitPrice: "4.0000", amount: "200.00" }, { category: "DEF", quantity: "2.500", amount: "12.00" }] });
  await seedTransaction(a.company.id, { periodId: null, date: "2026-10-03" });
  await seedIssue(a.company.id, { transactionId: t1.tx.id, code: "F002" });
  await seedIssue(a.company.id, { transactionId: t1.tx.id, code: "D002", severity: "WARNING" });
  await seedIssue(a.company.id, { transactionId: t1.tx.id, code: "F003", status: "RESOLVED" });
  await s.api("PATCH", `/companies/${a.company.id}/transactions/${t1.tx.id}/fields`, a.token, { field: "state", newValue: "IN", reason: "Address is in Indiana" });

  const first = await s.api("POST", `/companies/${a.company.id}/reports`, a.token, { type: "TRANSACTIONS_CSV", periodId: period.id });
  assert.equal(first.status, 201, first.text);
  const r1 = first.json.report as { id: string; type: string; status: string; snapshotHash: string; fileKey: string; generatedBy: string };
  assert.equal(r1.type, "TRANSACTIONS_CSV");
  assert.equal(r1.status, "PRELIMINARY");
  assert.match(r1.snapshotHash, /^[0-9a-f]{64}$/);
  assert.equal(r1.fileKey, `companies/${a.company.id}/reports/${r1.id}.csv`);
  assert.equal(r1.generatedBy, a.user.id);

  const second = await s.api("POST", `/companies/${a.company.id}/reports`, a.token, { type: "TRANSACTIONS_CSV", periodId: period.id });
  const r2 = second.json.report as typeof r1;
  assert.notEqual(r2.id, r1.id);
  assert.equal(r2.snapshotHash, r1.snapshotHash, "same data → same hash");
  assert.deepEqual(await s.storage.get(r1.fileKey), await s.storage.get(r2.fileKey), "byte-identical files");

  const detail = await s.api("GET", `/companies/${a.company.id}/reports/${r1.id}`, a.token);
  assert.equal(detail.status, 200, detail.text);
  const csv = await download(String(detail.json.signedUrl));
  const lines = csv.split("\r\n");
  assert.equal(lines[0], TRANSACTIONS_CSV_COLUMNS.join(","));
  assert.equal(lines[0]!.split(",").length, 31);
  assert.equal(lines.length, 4, "header + 2 rows + trailing CRLF");
  const row1 = parseCsv(csv)[1]!;
  const row2 = lines[2]!;
  assert.equal(row1[0], t2.tx.id, "sorted by date: Oct 2 before Oct 15");
  assert.equal(row1[11], "50.000");
  assert.equal(row1[15], "2.500");
  assert.ok(row2.startsWith(`${t1.tx.id},NEEDS_ATTENTION,2026-10-15,08:15,"Pilot ""Flying J"", Exit 4","1 Demo Rd, Columbus, OH 43004",IN,user,101,,diesel,100.000,4.1250,412.50,,,,,,,412.50,card,4242,,SINGLE_SOURCE,D002|F002,${t1.documentId},`), row2);
  assert.match(row2, /,1,Test u-[0-9a-f]+,\d{4}-\d{2}-\d{2}T[^,]+Z$/, "source page, last_edited_by, last_edited_at");

  const list = await s.api("GET", `/companies/${a.company.id}/reports`, a.token);
  assert.deepEqual((list.json.reports as Array<{ id: string }>).map((r) => r.id), [r2.id, r1.id], "newest first");
  const logs = await prisma.auditLog.findMany({ where: { companyId: a.company.id, action: "export" } });
  assert.equal(logs.length, 3, "two generations + one download");
  assert.ok(logs.every((l) => (l.meta as { snapshotHash: string }).snapshotHash === r1.snapshotHash));

  // A change to the data changes the hash.
  await s.api("PATCH", `/companies/${a.company.id}/transactions/${t2.tx.id}/fields`, a.token, { field: "vendor", newValue: "Other Stop", reason: "Misread" });
  const third = await s.api("POST", `/companies/${a.company.id}/reports`, a.token, { type: "TRANSACTIONS_CSV", periodId: period.id });
  assert.notEqual((third.json.report as typeof r1).snapshotHash, r1.snapshotHash);
});

test("IFTA worksheet report: status column follows approval + open errors; 409 I001 without rates", async () => {
  const a = await companyWithOwner();
  const period = await seedPeriod(a.company.id, { status: "APPROVED" });
  const v = await seedVehicle(a.company.id, "T1");
  await seedMileage(a.company.id, null, v.id, [
    { jurisdiction: "OH", total: "12500" },
    { jurisdiction: "IN", total: "10000" },
    { jurisdiction: "IL", total: "7500" },
  ]);
  await seedTransaction(a.company.id, { periodId: period.id, state: "OH", lines: [{ category: "MOTOR_FUEL", quantity: "2600.000", amount: "1.00" }, { category: "REEFER_FUEL", quantity: "100.000", amount: "1.00" }] });
  await seedTransaction(a.company.id, { periodId: period.id, state: "IN", lines: [{ category: "MOTOR_FUEL", quantity: "1200.000", amount: "1.00" }] });
  await seedTransaction(a.company.id, { periodId: period.id, state: "IL", lines: [{ category: "MOTOR_FUEL", quantity: "1000.000", amount: "1.00" }] });

  const res = await s.api("POST", `/companies/${a.company.id}/reports`, a.token, { type: "IFTA_WORKSHEET", periodId: period.id });
  assert.equal(res.status, 201, res.text);
  const report = res.json.report as { id: string; status: string; snapshotHash: string };
  assert.equal(report.status, "REVIEWED");
  const detail = await s.api("GET", `/companies/${a.company.id}/reports/${report.id}`, a.token);
  const csv = await download(String(detail.json.signedUrl));
  const lines = csv.trimEnd().split("\r\n");
  assert.equal(lines[0], "status,jurisdiction,total_miles,taxable_miles,gallons_consumed,tax_paid_gallons,net_taxable_gallons,rate,surcharge,tax_due,fleet_mpg,rate_quarter");
  assert.equal(lines[3], "REVIEWED,OH,12500.000,12500.000,2000.000,2600.000,-600.000,0.47000,,-282.00,6.25,2026Q4");
  assert.equal(lines[4], "REVIEWED,TOTAL,30000.000,30000.000,4800.000,4800.000,0.000,,,115.40,6.25,2026Q4");

  // An open ERROR flips the label to PRELIMINARY (and the hash).
  const { tx } = await seedTransaction(a.company.id, { periodId: period.id, state: "OH", lines: [] });
  await seedIssue(a.company.id, { transactionId: tx.id, severity: "ERROR" });
  const prelim = await s.api("POST", `/companies/${a.company.id}/reports`, a.token, { type: "IFTA_WORKSHEET", periodId: period.id });
  assert.equal((prelim.json.report as { status: string }).status, "PRELIMINARY");
  assert.notEqual((prelim.json.report as { snapshotHash: string }).snapshotHash, report.snapshotHash);

  const noRates = await seedPeriod(a.company.id, { start: "2019-04-01", end: "2019-06-30" });
  const missing = await s.api("POST", `/companies/${a.company.id}/reports`, a.token, { type: "IFTA_WORKSHEET", periodId: noRates.id });
  assert.equal(missing.status, 409, missing.text);
  assert.equal(missing.json.code, "I001");
  assert.equal(missing.json.quarter, "2019Q2");
  assert.equal(await prisma.report.count({ where: { periodId: noRates.id } }), 0);
});

test("validation, roles and tenancy for reports", async () => {
  const a = await companyWithOwner();
  const b = await companyWithOwner();
  const period = await seedPeriod(a.company.id);
  assert.equal((await s.api("POST", `/companies/${a.company.id}/reports`, a.token, { type: "AUDIT_BINDER", periodId: period.id })).status, 400, "unknown report type");
  assert.equal((await s.api("POST", `/companies/${a.company.id}/reports`, a.token, { type: "TRANSACTIONS_CSV", periodId: "00000000-0000-4000-8000-000000000000" })).status, 404);
  const reviewer = await createUser();
  await addMember(reviewer.id, a.company.id, "REVIEWER");
  assert.equal((await s.api("POST", `/companies/${a.company.id}/reports`, accessToken(reviewer.id, "TRUCK_OWNER"), { type: "TRANSACTIONS_CSV", periodId: period.id })).status, 403);
  const ok = await s.api("POST", `/companies/${a.company.id}/reports`, a.token, { type: "TRANSACTIONS_CSV", periodId: period.id });
  const id = (ok.json.report as { id: string }).id;
  assert.equal((await s.api("GET", `/companies/${a.company.id}/reports`, accessToken(reviewer.id, "TRUCK_OWNER"))).status, 200, "reviewers can list");
  assert.equal((await s.api("GET", `/companies/${a.company.id}/reports`, b.token)).status, 404);
  assert.equal((await s.api("GET", `/companies/${a.company.id}/reports/${id}`, b.token)).status, 404);
  assert.equal((await s.api("GET", `/companies/${b.company.id}/reports/${id}`, b.token)).status, 404);
  assert.equal((await s.api("POST", `/companies/${b.company.id}/reports`, b.token, { type: "TRANSACTIONS_CSV", periodId: period.id })).status, 404, "A's period is invisible to B");
  assert.deepEqual((await s.api("GET", `/companies/${b.company.id}/reports`, b.token)).json.reports, []);
});

test("period PDF and supporting ZIP: PDF has cover/summary/worksheet notice and an appendix; ZIP holds renamed originals, index, CSVs, PDF and manifest", async () => {
  const { unzipSync } = await import("fflate");
  const a = await companyWithOwner();
  const period = await seedPeriod(a.company.id);
  const vehicle = await seedVehicle(a.company.id, "101");
  const t1 = await seedTransaction(a.company.id, { periodId: period.id, vehicleId: vehicle.id, date: "2026-10-15", vendor: "Fictional Fuel Stop / Exit 4", state: "OH", receiptTotal: "412.50" });
  const t2 = await seedTransaction(a.company.id, { periodId: period.id, date: "2026-10-02", vendor: "Fictional Truck Stop", state: "IN", lines: [{ category: "MOTOR_FUEL", quantity: "50.000", unitPrice: "4.0000", amount: "200.00" }, { category: "NON_FUEL", amount: "12.00" }] });
  await seedIssue(a.company.id, { transactionId: t1.tx.id, code: "F002" });
  // Give the two seeded documents real bytes in storage so the ZIP can include them.
  const docs = await prisma.document.findMany({ where: { id: { in: [t1.documentId!, t2.documentId!] } } });
  for (const d of docs) await s.storage.put(d.storageKey, Buffer.from(`PNG-bytes-${d.id}`), "image/png");

  const pdfRes = await s.api("POST", `/companies/${a.company.id}/reports`, a.token, { type: "PERIOD_PDF", periodId: period.id });
  assert.equal(pdfRes.status, 201, pdfRes.text);
  const pdfReport = pdfRes.json.report as { id: string; type: string; status: string; fileKey: string; snapshotHash: string };
  assert.equal(pdfReport.type, "PERIOD_PDF");
  assert.equal(pdfReport.fileKey, `companies/${a.company.id}/reports/${pdfReport.id}.pdf`);
  const pdf = await s.storage.get(pdfReport.fileKey);
  const text = pdf.toString("latin1");
  assert.ok(text.startsWith("%PDF-1.4"));
  for (const needle of ["Summary", "Fuel by state", "Exceptions", "IFTA worksheet", "Appendix", "PRELIMINARY", "Fictional Fuel Stop / Exit 4"]) {
    assert.ok(text.includes(needle), `PDF mentions "${needle}"`);
  }
  // The shared test database may already hold a 2026Q4 rate table from another test: either the worksheet or the I001 notice is present.
  const hasRates = (await prisma.iftaRate.count({ where: { quarter: "2026Q4" } })) > 0;
  assert.ok(hasRates ? text.includes("Fleet MPG") : text.includes("\\(I001\\)"), hasRates ? "worksheet rendered" : "I001 notice rendered");
  assert.ok((text.match(/\/Type \/Page\b/g) ?? []).length >= 2, "more than one page");

  const zipRes = await s.api("POST", `/companies/${a.company.id}/reports`, a.token, { type: "SUPPORT_ZIP", periodId: period.id });
  assert.equal(zipRes.status, 201, zipRes.text);
  const zipReport = zipRes.json.report as { id: string; fileKey: string };
  assert.equal(zipReport.fileKey, `companies/${a.company.id}/reports/${zipReport.id}.zip`);
  const entries = unzipSync(new Uint8Array(await s.storage.get(zipReport.fileKey)));
  const names = Object.keys(entries).sort();
  assert.ok(names.includes("index.csv") && names.includes("transactions.csv") && names.includes("period-report.pdf") && names.includes("manifest.json") && names.includes("README.txt"), names.join(","));
  assert.equal(names.includes("ifta-worksheet.csv"), hasRates, "worksheet CSV only with a rate table");
  const originals = names.filter((n) => n.startsWith("documents/"));
  assert.equal(originals.length, 2);
  assert.ok(originals.some((n) => n.startsWith(`documents/2026-10-15_OH_Fictional_Fuel_Stop_Exit_4_${t1.tx.id.slice(0, 8)}.png`)), originals.join(","));
  assert.equal(Buffer.from(entries[originals.find((n) => n.includes("2026-10-02"))!]!).toString(), `PNG-bytes-${t2.documentId}`, "original bytes unchanged");
  const index = Buffer.from(entries["index.csv"]!).toString();
  assert.ok(index.startsWith("file,transaction_id,date,state,vendor,receipt_total,source_document_id,source_filename,sha256"));
  assert.equal(index.trim().split("\r\n").length, 3);
  const manifest = JSON.parse(Buffer.from(entries["manifest.json"]!).toString()) as { snapshotId: string; files: Array<{ file: string; sha256: string }> };
  assert.equal(manifest.snapshotId, zipReport.id);
  assert.equal(manifest.files.find((f) => f.file === "period-report.pdf")!.sha256.length, 64);

  // Roles: a driver cannot generate deliverables.
  const driver = await createUser("DRIVER");
  await addMember(driver.id, a.company.id, "DRIVER");
  assert.equal((await s.api("POST", `/companies/${a.company.id}/reports`, accessToken(driver.id, "DRIVER"), { type: "PERIOD_PDF", periodId: period.id })).status, 403);
});
