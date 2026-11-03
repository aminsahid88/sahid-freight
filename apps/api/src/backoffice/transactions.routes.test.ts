import { test } from "node:test";
import assert from "node:assert/strict";
import { accessToken, addMember, companyWithOwner, createUser, prisma } from "../test/fixtures";
import { seedIssue, seedJurisdictions, seedPeriod, seedTransaction, seedVehicle, startTestServer, type TestServer } from "./test-harness";

let s: TestServer;
test.before(async () => {
  s = await startTestServer();
  await seedJurisdictions();
});
test.after(async () => s.close());

test("list: filters by status/period, pages with a cursor, includes vehicle, lines, open issue count and source document", async () => {
  const a = await companyWithOwner();
  const period = await seedPeriod(a.company.id);
  const vehicle = await seedVehicle(a.company.id, "101");
  const t1 = await seedTransaction(a.company.id, { periodId: period.id, vehicleId: vehicle.id, date: "2026-10-15", status: "VERIFIED" });
  const t2 = await seedTransaction(a.company.id, { periodId: period.id, date: "2026-10-16" });
  await seedTransaction(a.company.id, { periodId: null, date: "2026-09-01" });
  await seedIssue(a.company.id, { transactionId: t2.tx.id });
  await seedIssue(a.company.id, { transactionId: t2.tx.id, code: "F003", severity: "WARNING" });
  await seedIssue(a.company.id, { transactionId: t2.tx.id, code: "D002", status: "RESOLVED" });

  const all = await s.api("GET", `/companies/${a.company.id}/transactions`, a.token);
  assert.equal(all.status, 200, all.text);
  assert.equal((all.json.transactions as unknown[]).length, 3);

  const inPeriod = await s.api("GET", `/companies/${a.company.id}/transactions?periodId=${period.id}`, a.token);
  const rows = inPeriod.json.transactions as Array<{ id: string; openIssueCount: number; vehicle: { unitNumber: string } | null; lines: unknown[]; document: { id: string; filename: string; page: number } | null }>;
  assert.deepEqual(
    rows.map((r) => r.id),
    [t2.tx.id, t1.tx.id],
    "newest date first",
  );
  assert.equal(rows[0]!.openIssueCount, 2);
  assert.equal(rows[1]!.openIssueCount, 0);
  assert.equal(rows[1]!.vehicle?.unitNumber, "101");
  assert.equal(rows[0]!.lines.length, 1);
  assert.equal(rows[0]!.document?.id, t2.documentId);
  assert.equal(rows[0]!.document?.page, 1);
  assert.match(rows[0]!.document?.filename ?? "", /\.png$/);

  const verified = await s.api("GET", `/companies/${a.company.id}/transactions?status=VERIFIED`, a.token);
  assert.deepEqual((verified.json.transactions as Array<{ id: string }>).map((r) => r.id), [t1.tx.id]);

  const page1 = await s.api("GET", `/companies/${a.company.id}/transactions?limit=2`, a.token);
  assert.equal((page1.json.transactions as unknown[]).length, 2);
  assert.ok(page1.json.nextCursor);
  const page2 = await s.api("GET", `/companies/${a.company.id}/transactions?limit=2&cursor=${page1.json.nextCursor}`, a.token);
  assert.equal((page2.json.transactions as unknown[]).length, 1);
  assert.equal(page2.json.nextCursor, null);
  assert.equal((await s.api("GET", `/companies/${a.company.id}/transactions?limit=500`, a.token)).status, 400);
});

test("detail: lines, issues, document, provenance and field edits newest first", async () => {
  const a = await companyWithOwner();
  const { tx, documentId } = await seedTransaction(a.company.id, { lines: [{ category: "MOTOR_FUEL", quantity: "80.000", unitPrice: "4.0000", amount: "320.00" }, { category: "DEF", quantity: "2.500", amount: "12.00" }] });
  await seedIssue(a.company.id, { transactionId: tx.id });
  const res = await s.api("GET", `/companies/${a.company.id}/transactions/${tx.id}`, a.token);
  assert.equal(res.status, 200, res.text);
  const t = res.json.transaction as Record<string, unknown>;
  assert.equal((t.lines as unknown[]).length, 2);
  assert.equal((t.issues as Array<{ code: string }>)[0]?.code, "F002");
  assert.equal((t.document as { id: string }).id, documentId);
  assert.deepEqual(t.fieldEdits, []);
  assert.ok((t.provenance as { date: unknown }).date);
  assert.equal((await s.api("GET", `/companies/${a.company.id}/transactions/00000000-0000-4000-8000-000000000000`, a.token)).status, 404);
});

test("field edits: FieldEdit row written, column updated, provenance untouched, audit entry, state sets stateSource=user", async () => {
  const a = await companyWithOwner();
  const { tx } = await seedTransaction(a.company.id, { state: "OH", receiptTotal: "412.50" });
  const before = await prisma.transaction.findUnique({ where: { id: tx.id } });

  const edit = await s.api("PATCH", `/companies/${a.company.id}/transactions/${tx.id}/fields`, a.token, { field: "state", newValue: "IN", reason: "Receipt shows Indiana address" });
  assert.equal(edit.status, 200, edit.text);
  const t = edit.json.transaction as { state: string; stateSource: string; provenance: unknown; fieldEdits: Array<{ field: string; oldValue: string; newValue: string; reason: string; user: { id: string } }> };
  assert.equal(t.state, "IN");
  assert.equal(t.stateSource, "user");
  assert.deepEqual(t.provenance, before!.provenance, "provenance is never modified");
  assert.equal(t.fieldEdits.length, 1);
  assert.deepEqual([t.fieldEdits[0]!.field, t.fieldEdits[0]!.oldValue, t.fieldEdits[0]!.newValue, t.fieldEdits[0]!.user.id], ["state", "OH", "IN", a.user.id]);

  const total = await s.api("PATCH", `/companies/${a.company.id}/transactions/${tx.id}/fields`, a.token, { field: "receiptTotal", newValue: "415.00", reason: "Total misread" });
  assert.equal(total.status, 200, total.text);
  const date = await s.api("PATCH", `/companies/${a.company.id}/transactions/${tx.id}/fields`, a.token, { field: "date", newValue: "2026-10-16", reason: "Date misread" });
  assert.equal(date.status, 200, date.text);
  const after = await prisma.transaction.findUnique({ where: { id: tx.id } });
  assert.equal(after!.receiptTotal!.toString(), "415");
  assert.equal(after!.date!.toISOString().slice(0, 10), "2026-10-16");
  assert.deepEqual(after!.provenance, before!.provenance);

  const edits = await prisma.fieldEdit.findMany({ where: { entity: "Transaction", entityId: tx.id }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(
    edits.map((e) => [e.field, e.oldValue, e.newValue]),
    [
      ["state", "OH", "IN"],
      ["receiptTotal", "412.5", "415.00"],
      ["date", "2026-10-15", "2026-10-16"],
    ],
  );
  const detail = await s.api("GET", `/companies/${a.company.id}/transactions/${tx.id}`, a.token);
  assert.deepEqual((detail.json.transaction as { fieldEdits: Array<{ field: string }> }).fieldEdits.map((e) => e.field), ["date", "receiptTotal", "state"], "newest first");
  assert.equal(await prisma.auditLog.count({ where: { companyId: a.company.id, action: "edit", target: `Transaction:${tx.id}` } }), 3);
});

test("field edits are validated per field; vehicleId must belong to the company; unchanged values are rejected", async () => {
  const a = await companyWithOwner();
  const b = await companyWithOwner();
  const { tx } = await seedTransaction(a.company.id);
  const mine = await seedVehicle(a.company.id, "7");
  const theirs = await seedVehicle(b.company.id, "8");
  const url = `/companies/${a.company.id}/transactions/${tx.id}/fields`;
  const cases: Array<[Record<string, unknown>, RegExp]> = [
    [{ field: "date", newValue: "2026-02-30", reason: "typo fix" }, /calendar date/],
    [{ field: "date", newValue: "10/15/2026", reason: "typo fix" }, /YYYY-MM-DD/],
    [{ field: "state", newValue: "oh", reason: "typo fix" }, /uppercase/],
    [{ field: "state", newValue: "ZZ", reason: "typo fix" }, /not a known jurisdiction/],
    [{ field: "receiptTotal", newValue: "$12.00", reason: "typo fix" }, /plain decimal/],
    [{ field: "receiptTotal", newValue: "12.345", reason: "typo fix" }, /plain decimal/],
    [{ field: "cardLast4", newValue: "12", reason: "typo fix" }, /4 digits/],
    [{ field: "type", newValue: "PIZZA", reason: "typo fix" }, /value for type/],
    [{ field: "odometer", newValue: "1.25", reason: "typo fix" }, /1 place/],
    [{ field: "vehicleId", newValue: theirs.id, reason: "typo fix" }, /not a vehicle of this company/],
    [{ field: "vendor", newValue: "X", reason: "" }, /reason/],
    [{ field: "sha256", newValue: "x", reason: "typo fix" }, /field/],
    [{ field: "state", newValue: "OH", reason: "same value" }, /already has that value/],
  ];
  for (const [body, re] of cases) {
    const res = await s.api("PATCH", url, a.token, body);
    assert.equal(res.status, 400, `${JSON.stringify(body)} → ${res.text}`);
    assert.match(String(res.json.message), re, JSON.stringify(body));
  }
  const ok = await s.api("PATCH", url, a.token, { field: "vehicleId", newValue: mine.id, reason: "Unit 7 per driver" });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(await prisma.fieldEdit.count({ where: { entityId: tx.id } }), 1, "no FieldEdit rows for rejected edits");
});

test("roles and tenancy: DRIVER cannot edit; another company gets 404 and writes nothing", async () => {
  const a = await companyWithOwner();
  const b = await companyWithOwner();
  const { tx } = await seedTransaction(a.company.id);
  const driver = await createUser("DRIVER");
  await addMember(driver.id, a.company.id, "DRIVER");
  const dt = accessToken(driver.id, "DRIVER");
  assert.equal((await s.api("GET", `/companies/${a.company.id}/transactions`, dt)).status, 200, "drivers may list");
  assert.equal((await s.api("PATCH", `/companies/${a.company.id}/transactions/${tx.id}/fields`, dt, { field: "vendor", newValue: "X", reason: "nope" })).status, 403);

  const reviewer = await createUser();
  await addMember(reviewer.id, a.company.id, "REVIEWER");
  assert.equal((await s.api("PATCH", `/companies/${a.company.id}/transactions/${tx.id}/fields`, accessToken(reviewer.id, "TRUCK_OWNER"), { field: "vendor", newValue: "Reviewed Vendor", reason: "legible on zoom" })).status, 200);

  assert.equal((await s.api("GET", `/companies/${a.company.id}/transactions`, b.token)).status, 404);
  assert.equal((await s.api("GET", `/companies/${a.company.id}/transactions/${tx.id}`, b.token)).status, 404);
  assert.equal((await s.api("PATCH", `/companies/${a.company.id}/transactions/${tx.id}/fields`, b.token, { field: "vendor", newValue: "Hacked", reason: "cross-tenant" })).status, 404);
  // Even through B's own company prefix, A's transaction id resolves to nothing.
  assert.equal((await s.api("GET", `/companies/${b.company.id}/transactions/${tx.id}`, b.token)).status, 404);
  assert.equal((await s.api("PATCH", `/companies/${b.company.id}/transactions/${tx.id}/fields`, b.token, { field: "vendor", newValue: "Hacked", reason: "cross-tenant" })).status, 404);
  const list = await s.api("GET", `/companies/${b.company.id}/transactions`, b.token);
  assert.deepEqual(list.json.transactions, []);
  assert.equal((await prisma.transaction.findUnique({ where: { id: tx.id } }))!.vendor, "Reviewed Vendor");
});
