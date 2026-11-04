import { test } from "node:test";
import assert from "node:assert/strict";
import { companyWithOwner, prisma } from "../test/fixtures";
import { csvFile, seedPeriod, seedTransaction, startTestServer, type TestServer } from "./test-harness";

let s: TestServer;
test.before(async () => {
  s = await startTestServer();
});
test.after(async () => s.close());

const COMDATA_HEADER = "Transaction Date,Merchant Name,Merchant State,Unit Number,Card Number,Product Description,Quantity,Total Amount";

function form(csv: string, fields: Record<string, string>): FormData {
  const fd = csvFile("statement.csv", csv);
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

test("preview: detects a Comdata-style header, returns sample rows and the saved mapping when one exists", async () => {
  const a = await companyWithOwner();
  const csv = `${COMDATA_HEADER}\r\n10/15/2026,FICTIONAL FUEL STOP #12,OH,UNIT 101,****4417,ULSD,100.000,$412.50\r\n10/16/2026,FICTIONAL TRUCK STOP,IN,UNIT 102,****4418,ULSD,80.000,$330.00\r\n`;
  const res = await s.api("POST", `/companies/${a.company.id}/fuel-card-imports/preview`, a.token, form(csv, { provider: "comdata" }));
  assert.equal(res.status, 200, res.text);
  const j = res.json as { headers: string[]; sampleRows: string[][]; detectedMapping: Record<string, string>; missing: string[]; savedMapping: unknown };
  assert.deepEqual(j.headers, COMDATA_HEADER.split(","));
  assert.equal(j.sampleRows.length, 2);
  assert.equal(j.sampleRows[0]![7], "$412.50");
  assert.equal(j.detectedMapping.date, "Transaction Date");
  assert.equal(j.detectedMapping.gallons, "Quantity");
  assert.equal(j.detectedMapping.amount, "Total Amount");
  assert.deepEqual(j.missing, []);
  assert.equal(j.savedMapping, null);

  await prisma.setting.create({ data: { companyId: a.company.id, key: "fuel_card_mapping:comdata", value: { date: "Transaction Date", amount: "Total Amount" } } });
  const again = await s.api("POST", `/companies/${a.company.id}/fuel-card-imports/preview`, a.token, form(csv, { provider: "comdata" }));
  assert.deepEqual(again.json.savedMapping, { date: "Transaction Date", amount: "Total Amount" });

  const onlyProvider = new FormData();
  onlyProvider.append("provider", "comdata");
  const noFile = await s.api("POST", `/companies/${a.company.id}/fuel-card-imports/preview`, a.token, onlyProvider);
  assert.equal(noFile.status, 400);
  assert.equal(noFile.json.error, "bad_request");
  const badProvider = await s.api("POST", `/companies/${a.company.id}/fuel-card-imports/preview`, a.token, form(csv, { provider: "shell" }));
  assert.equal(badProvider.status, 400);
  assert.equal(badProvider.json.error, "validation");
});

test("import: invalid rows → 400 and nothing written; explicit mapping + saveMapping persists; duplicates skipped on re-import; list", async () => {
  const a = await companyWithOwner();
  const url = `/companies/${a.company.id}/fuel-card-imports`;

  const bad = `Date,Site,Gallons,Amount\r\n10/15/2026,X,100,412.50\r\n13/45/2026,X,abc,\r\n`;
  const rej = await s.api("POST", url, a.token, form(bad, { provider: "generic" }));
  assert.equal(rej.status, 400, rej.text);
  assert.equal(rej.json.error, "fuel_card_rows_invalid");
  assert.deepEqual((rej.json.details as Array<{ row: number; field: string }>).map((e) => `${e.row}:${e.field}`), ["3:date", "3:gallons"]);
  assert.equal(await prisma.fuelCardImport.count({ where: { companyId: a.company.id } }), 0);
  assert.equal(await prisma.fuelCardTransaction.count({ where: { companyId: a.company.id } }), 0);

  // Custom headers the detector would not know; an explicit mapping (saved for next time) makes it work.
  const csv = `When,Where,Which Truck,Gal,Cost\r\n2026-10-15,FICTIONAL FUEL STOP #12,101,100.000,412.50\r\n2026-10-16,FICTIONAL TRUCK STOP,102,80.000,330.00\r\n`;
  const mapping = JSON.stringify({ date: "When", location: "Where", unitNumber: "Which Truck", gallons: "Gal", amount: "Cost" });
  const ok = await s.api("POST", url, a.token, form(csv, { provider: "generic", mapping, saveMapping: "true" }));
  assert.equal(ok.status, 201, ok.text);
  const imp = ok.json.fuelCardImport as { id: string; provider: string; mappingVersion: string; importedAt: string; rows: number; duplicates: number };
  assert.equal(imp.provider, "generic");
  assert.match(imp.mappingVersion, /^generic:[0-9a-f]{8}$/);
  assert.equal(imp.rows, 2);
  assert.equal(imp.duplicates, 0);
  assert.deepEqual(ok.json.matching, { receiptsConsidered: 0, cardRowsConsidered: 2, matched: 0, newMatches: 0, unmatchedReceipts: 0, unmatchedCardRows: 2 });
  const saved = await prisma.setting.findUnique({ where: { companyId_key: { companyId: a.company.id, key: "fuel_card_mapping:generic" } } });
  assert.deepEqual(saved?.value, JSON.parse(mapping));
  const rows = await prisma.fuelCardTransaction.findMany({ where: { importId: imp.id }, orderBy: { date: "asc" } });
  assert.equal(rows[0]!.unitNumber, "101");
  assert.equal(rows[0]!.gallons!.toFixed(3), "100.000");
  assert.equal(rows[0]!.amount!.toFixed(2), "412.50");
  assert.deepEqual(rows[0]!.raw, { When: "2026-10-15", Where: "FICTIONAL FUEL STOP #12", "Which Truck": "101", Gal: "100.000", Cost: "412.50" });
  const audit = await prisma.auditLog.findFirst({ where: { companyId: a.company.id, action: "upload" } });
  assert.equal(audit?.target, `FuelCardImport:${imp.id}`);
  assert.equal((audit?.meta as { rows: number }).rows, 2);

  // Re-import the same file plus one new row with no explicit mapping: the saved mapping is used, 2 duplicates skipped.
  const again = await s.api("POST", url, a.token, form(`${csv}2026-10-17,FICTIONAL FUEL STOP #12,103,50.000,200.00\r\n`, { provider: "generic" }));
  assert.equal(again.status, 201, again.text);
  const imp2 = again.json.fuelCardImport as { id: string; rows: number; duplicates: number };
  assert.equal(imp2.rows, 1);
  assert.equal(imp2.duplicates, 2);
  assert.equal(await prisma.fuelCardTransaction.count({ where: { companyId: a.company.id } }), 3);

  const list = await s.api("GET", url, a.token);
  assert.equal(list.status, 200);
  const imports = list.json.imports as Array<{ id: string; rows: number; matched: number }>;
  assert.deepEqual(
    imports.map((i) => [i.id, i.rows, i.matched]),
    [
      [imp2.id, 1, 0],
      [imp.id, 2, 0],
    ],
  );

  // Without a saved mapping and with undetectable headers → 400.
  const b = await companyWithOwner();
  const undetectable = await s.api("POST", `/companies/${b.company.id}/fuel-card-imports`, b.token, form(csv, { provider: "generic" }));
  assert.equal(undetectable.status, 400);
  assert.equal(undetectable.json.error, "fuel_card_rows_invalid");
});

test("matching: import pairs receipts with card rows (Match, D003, RECEIPT_AND_CARD), I003/I004 for the unmatched, period re-run adds nothing, transactions list", async () => {
  const a = await companyWithOwner();
  const period = await seedPeriod(a.company.id);
  const paired = await seedTransaction(a.company.id, { periodId: period.id, date: "2026-10-15", state: "OH", cardLast4: "4417", receiptTotal: "412.50", paymentMethod: "fuel_card" });
  const orphanReceipt = await seedTransaction(a.company.id, { periodId: period.id, date: "2026-11-02", state: "IN", cardLast4: "4418", receiptTotal: "300.00", paymentMethod: "credit_card", lines: [{ category: "MOTOR_FUEL", quantity: "75.000", amount: "300.00" }] });
  await seedTransaction(a.company.id, { periodId: period.id, date: "2026-11-03", state: "IN", receiptTotal: "50.00", paymentMethod: "cash", lines: [{ category: "MOTOR_FUEL", quantity: "12.000", amount: "50.00" }] });

  const csv = `${COMDATA_HEADER}\r\n10/15/2026,FICTIONAL FUEL STOP #12,OH,UNIT 101,****4417,ULSD,100.200,$412.90\r\n10/20/2026,FICTIONAL TRUCK STOP,KY,UNIT 102,****4418,ULSD,60.000,$240.00\r\n`;
  const res = await s.api("POST", `/companies/${a.company.id}/fuel-card-imports`, a.token, form(csv, { provider: "comdata" }));
  assert.equal(res.status, 201, res.text);
  assert.deepEqual(res.json.matching, { receiptsConsidered: 3, cardRowsConsidered: 2, matched: 1, newMatches: 1, unmatchedReceipts: 2, unmatchedCardRows: 1 });
  const importId = (res.json.fuelCardImport as { id: string }).id;

  const match = await prisma.match.findFirst({ where: { transactionId: paired.tx.id } });
  assert.ok(match);
  assert.equal(match.score.toFixed(3), "1.000");
  assert.equal(match.ruleVersion, "match-v1");
  assert.equal((await prisma.transaction.findUnique({ where: { id: paired.tx.id } }))!.corroboration, "RECEIPT_AND_CARD");
  assert.equal((await prisma.transaction.findUnique({ where: { id: orphanReceipt.tx.id } }))!.corroboration, "SINGLE_SOURCE");
  const codes = (await prisma.issue.findMany({ where: { companyId: a.company.id }, orderBy: { code: "asc" } })).map((i) => [i.code, i.severity, i.transactionId]);
  assert.deepEqual(codes, [
    ["D003", "INFO", paired.tx.id],
    ["I003", "WARNING", null],
    ["I004", "INFO", orphanReceipt.tx.id],
  ]);

  // Period-level re-run creates nothing new.
  const rerun = await s.api("POST", `/companies/${a.company.id}/periods/${period.id}/match`, a.token, {});
  assert.equal(rerun.status, 200, rerun.text);
  assert.deepEqual(rerun.json, { receiptsConsidered: 3, cardRowsConsidered: 2, matched: 1, newMatches: 0, unmatchedReceipts: 2, unmatchedCardRows: 1 });
  assert.equal(await prisma.match.count({ where: { cardTransaction: { companyId: a.company.id } } }), 1);
  assert.equal(await prisma.issue.count({ where: { companyId: a.company.id } }), 3);
  const missingPeriod = await s.api("POST", `/companies/${a.company.id}/periods/00000000-0000-4000-8000-000000000000/match`, a.token, {});
  assert.equal(missingPeriod.status, 404);

  // Transactions list: decimals as strings, match embedded, filters.
  const all = await s.api("GET", `/companies/${a.company.id}/fuel-card-transactions?importId=${importId}`, a.token);
  assert.equal(all.status, 200, all.text);
  const rows = all.json.rows as Array<{ id: string; date: string; gallons: string; amount: string; cardLast4: string; unitNumber: string; match: { transactionId: string; score: string; fieldsUsed: string[] } | null }>;
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.date.slice(0, 10), "2026-10-20"); // date desc
  assert.equal(rows[0]!.match, null);
  assert.equal(rows[1]!.gallons, "100.200");
  assert.equal(rows[1]!.amount, "412.90");
  assert.equal(rows[1]!.unitNumber, "101");
  assert.equal(rows[1]!.cardLast4, "4417");
  assert.deepEqual(rows[1]!.match, { transactionId: paired.tx.id, score: "1.000", fieldsUsed: ["date", "gallons", "amount", "state", "cardLast4"] });
  assert.equal(all.json.nextCursor, null);
  const unmatched = await s.api("GET", `/companies/${a.company.id}/fuel-card-transactions?matched=false&periodId=${period.id}`, a.token);
  assert.deepEqual((unmatched.json.rows as Array<{ id: string }>).map((r) => r.id), [rows[0]!.id]);
  const matchedOnly = await s.api("GET", `/companies/${a.company.id}/fuel-card-transactions?matched=true&limit=1`, a.token);
  assert.deepEqual((matchedOnly.json.rows as Array<{ id: string }>).map((r) => r.id), [rows[1]!.id]);
  const paged = await s.api("GET", `/companies/${a.company.id}/fuel-card-transactions?limit=1`, a.token);
  assert.equal(paged.json.nextCursor, rows[0]!.id);
  const page2 = await s.api("GET", `/companies/${a.company.id}/fuel-card-transactions?limit=1&cursor=${rows[0]!.id}`, a.token);
  assert.deepEqual((page2.json.rows as Array<{ id: string }>).map((r) => r.id), [rows[1]!.id]);
  const outside = await s.api("GET", `/companies/${a.company.id}/fuel-card-transactions?periodId=00000000-0000-4000-8000-000000000000`, a.token);
  assert.equal(outside.status, 404);
});

test("cross-company: another company's owner gets 404 and sees no rows; reviewer cannot import", async () => {
  const a = await companyWithOwner();
  const b = await companyWithOwner();
  const csv = `Date,Merchant,Gallons,Amount\r\n2026-10-15,FICTIONAL FUEL STOP #12,100.000,412.50\r\n`;
  const res = await s.api("POST", `/companies/${a.company.id}/fuel-card-imports`, a.token, form(csv, { provider: "generic" }));
  assert.equal(res.status, 201, res.text);
  const importId = (res.json.fuelCardImport as { id: string }).id;

  assert.equal((await s.api("POST", `/companies/${a.company.id}/fuel-card-imports`, b.token, form(csv, { provider: "generic" }))).status, 404);
  assert.equal((await s.api("POST", `/companies/${a.company.id}/fuel-card-imports/preview`, b.token, form(csv, { provider: "generic" }))).status, 404);
  assert.equal((await s.api("GET", `/companies/${a.company.id}/fuel-card-imports`, b.token)).status, 404);
  assert.equal((await s.api("GET", `/companies/${a.company.id}/fuel-card-transactions`, b.token)).status, 404);

  // Filtering by A's import id from B's own company yields nothing.
  const leak = await s.api("GET", `/companies/${b.company.id}/fuel-card-transactions?importId=${importId}`, b.token);
  assert.equal(leak.status, 200);
  assert.deepEqual(leak.json.rows, []);
  assert.deepEqual((await s.api("GET", `/companies/${b.company.id}/fuel-card-imports`, b.token)).json.imports, []);

  const reviewer = await companyWithOwner("REVIEWER");
  assert.equal((await s.api("POST", `/companies/${reviewer.company.id}/fuel-card-imports`, reviewer.token, form(csv, { provider: "generic" }))).status, 403);
  assert.equal((await s.api("GET", `/companies/${reviewer.company.id}/fuel-card-imports`, reviewer.token)).status, 200);
  assert.equal((await s.api("POST", `/companies/${a.company.id}/fuel-card-imports`, null, form(csv, { provider: "generic" }))).status, 401);
});
