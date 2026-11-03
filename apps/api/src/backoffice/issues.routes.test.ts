import { test } from "node:test";
import assert from "node:assert/strict";
import { accessToken, addMember, companyWithOwner, createUser, prisma } from "../test/fixtures";
import { seedDocument, seedIssue, seedJurisdictions, seedPeriod, seedTransaction, startTestServer, type TestServer } from "./test-harness";

let s: TestServer;
test.before(async () => {
  s = await startTestServer();
  await seedJurisdictions();
});
test.after(async () => s.close());

test("list: OPEN by default, severity and period filters, transaction and document context, cursor paging", async () => {
  const a = await companyWithOwner();
  const period = await seedPeriod(a.company.id);
  const other = await seedPeriod(a.company.id, { start: "2026-07-01", end: "2026-09-30" });
  const t1 = await seedTransaction(a.company.id, { periodId: period.id, vendor: "Fictional Fuel Stop", receiptTotal: "412.50" });
  const t2 = await seedTransaction(a.company.id, { periodId: other.id });
  const doc = await seedDocument(a.company.id, { filename: "dup.png" });
  const e1 = await seedIssue(a.company.id, { transactionId: t1.tx.id, code: "F002", severity: "ERROR" });
  const w1 = await seedIssue(a.company.id, { transactionId: t1.tx.id, code: "F003", severity: "WARNING" });
  const d1 = await seedIssue(a.company.id, { documentId: doc.id, code: "D001", severity: "WARNING" });
  await seedIssue(a.company.id, { transactionId: t2.tx.id, code: "V004", severity: "ERROR" });
  await seedIssue(a.company.id, { transactionId: t1.tx.id, code: "D002", status: "RESOLVED" });

  const open = await s.api("GET", `/companies/${a.company.id}/issues`, a.token);
  assert.equal(open.status, 200, open.text);
  const rows = open.json.issues as Array<{ id: string; code: string; transaction: { id: string; vendor: string; receiptTotal: string } | null; document: { id: string; filename: string } | null }>;
  assert.equal(rows.length, 4);
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.equal(byId[e1.id]!.transaction?.vendor, "Fictional Fuel Stop");
  assert.equal(byId[e1.id]!.transaction?.receiptTotal, "412.5");
  assert.equal(byId[e1.id]!.document?.id, t1.documentId, "document resolved through the transaction's region");
  assert.equal(byId[d1.id]!.document?.filename, "dup.png");
  assert.equal(byId[d1.id]!.transaction, null);

  const errors = await s.api("GET", `/companies/${a.company.id}/issues?severity=ERROR`, a.token);
  assert.equal((errors.json.issues as unknown[]).length, 2);
  const inPeriod = await s.api("GET", `/companies/${a.company.id}/issues?periodId=${period.id}`, a.token);
  assert.deepEqual(
    (inPeriod.json.issues as Array<{ id: string }>).map((r) => r.id).sort(),
    [e1.id, w1.id].sort(),
  );
  const resolved = await s.api("GET", `/companies/${a.company.id}/issues?status=RESOLVED`, a.token);
  assert.equal((resolved.json.issues as Array<{ code: string }>)[0]?.code, "D002");

  const p1 = await s.api("GET", `/companies/${a.company.id}/issues?limit=3`, a.token);
  assert.equal((p1.json.issues as unknown[]).length, 3);
  const p2 = await s.api("GET", `/companies/${a.company.id}/issues?limit=3&cursor=${p1.json.nextCursor}`, a.token);
  assert.equal((p2.json.issues as unknown[]).length, 1);
  assert.equal(p2.json.nextCursor, null);
});

test("resolve and accept: only from OPEN, note rules, resolver recorded, audit entry with code and status", async () => {
  const a = await companyWithOwner();
  const { tx } = await seedTransaction(a.company.id);
  const i1 = await seedIssue(a.company.id, { transactionId: tx.id, code: "F002" });
  const i2 = await seedIssue(a.company.id, { transactionId: tx.id, code: "F004", severity: "WARNING" });

  const res = await s.api("POST", `/companies/${a.company.id}/issues/${i1.id}/resolve`, a.token, { note: "Total corrected from the receipt" });
  assert.equal(res.status, 200, res.text);
  const issue = res.json.issue as { status: string; resolvedBy: string; resolvedAt: string; resolutionNote: string };
  assert.equal(issue.status, "RESOLVED");
  assert.equal(issue.resolvedBy, a.user.id);
  assert.ok(issue.resolvedAt);
  assert.equal(issue.resolutionNote, "Total corrected from the receipt");
  const again = await s.api("POST", `/companies/${a.company.id}/issues/${i1.id}/accept`, a.token, { note: "trying twice" });
  assert.equal(again.status, 400);
  assert.match(String(again.json.message), /already RESOLVED/);

  assert.equal((await s.api("POST", `/companies/${a.company.id}/issues/${i2.id}/accept`, a.token, { note: "ok" })).status, 400, "accept needs a note of 3+ chars");
  assert.equal((await s.api("POST", `/companies/${a.company.id}/issues/${i2.id}/accept`, a.token, {})).status, 400);
  const acc = await s.api("POST", `/companies/${a.company.id}/issues/${i2.id}/accept`, a.token, { note: "Tank is 350 gal on this unit" });
  assert.equal(acc.status, 200, acc.text);
  assert.equal((acc.json.issue as { status: string }).status, "ACCEPTED");
  // A resolve with no body is allowed (note optional).
  const i3 = await seedIssue(a.company.id, { transactionId: tx.id, code: "F003", severity: "WARNING" });
  assert.equal((await s.api("POST", `/companies/${a.company.id}/issues/${i3.id}/resolve`, a.token)).status, 200);

  const logs = await prisma.auditLog.findMany({ where: { companyId: a.company.id, action: "edit", target: { startsWith: "Issue:" } }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(
    logs.map((l) => [(l.meta as { code: string }).code, (l.meta as { status: string }).status]),
    [
      ["F002", "RESOLVED"],
      ["F004", "ACCEPTED"],
      ["F003", "RESOLVED"],
    ],
  );
  assert.equal((await s.api("POST", `/companies/${a.company.id}/issues/00000000-0000-4000-8000-000000000000/resolve`, a.token, {})).status, 404);
});

test("roles and tenancy: drivers cannot decide; another company sees nothing and changes nothing", async () => {
  const a = await companyWithOwner();
  const b = await companyWithOwner();
  const { tx } = await seedTransaction(a.company.id);
  const issue = await seedIssue(a.company.id, { transactionId: tx.id });
  const driver = await createUser("DRIVER");
  await addMember(driver.id, a.company.id, "DRIVER");
  assert.equal((await s.api("POST", `/companies/${a.company.id}/issues/${issue.id}/resolve`, accessToken(driver.id, "DRIVER"), { note: "x" })).status, 403);

  assert.equal((await s.api("GET", `/companies/${a.company.id}/issues`, b.token)).status, 404);
  assert.equal((await s.api("POST", `/companies/${a.company.id}/issues/${issue.id}/resolve`, b.token, { note: "cross" })).status, 404);
  assert.equal((await s.api("POST", `/companies/${b.company.id}/issues/${issue.id}/accept`, b.token, { note: "cross-tenant" })).status, 404);
  assert.deepEqual((await s.api("GET", `/companies/${b.company.id}/issues`, b.token)).json.issues, []);
  assert.equal((await prisma.issue.findUnique({ where: { id: issue.id } }))!.status, "OPEN");
});
