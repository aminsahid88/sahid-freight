import { test } from "node:test";
import assert from "node:assert/strict";
import { accessToken, addMember, companyWithOwner, createUser, prisma } from "../test/fixtures";
import { seedIssue, seedTransaction, seedVehicle, startTestServer, type TestServer } from "./test-harness";
import { claimExpired, REVIEW_CLAIM_MINUTES, resolveFieldTarget } from "./review";

let s: TestServer;
test.before(async () => {
  s = await startTestServer();
});
test.after(async () => s.close());

/** Provenance as reconcile writes it: scalar fields by camelCase name, line fields by contract key. */
const PROV = {
  fields: {
    date: { rawText: "10/15/26", passA: "2026-10-15", passB: "2026-10-16", final: null, finalSource: null, agree: false },
    vendor: { rawText: "FICTIONAL FUEL", passA: "Fictional Fuel Stop", passB: "Fictional Fuel Stop", final: "Fictional Fuel Stop", finalSource: "both", agree: true },
    receiptTotal: { rawText: "412.50", passA: "412.50", passB: "412.50", final: "412.50", finalSource: "both", agree: true },
    "line_items.0.quantity": { rawText: "100.000", passA: "100.000", passB: "10.000", final: null, finalSource: null, agree: false },
  },
  disagreements: [{ field: "transaction_date", passA: "2026-10-15", passB: "2026-10-16", material: true }],
};

async function reviewerFor(companyId: string) {
  const u = await createUser("TRUCK_OWNER");
  await addMember(u.id, companyId, "REVIEWER");
  return { user: u, token: accessToken(u.id, "TRUCK_OWNER") };
}

test("resolveFieldTarget maps contract names and line fields; rejects the rest", () => {
  assert.deepEqual(resolveFieldTarget("transaction_date"), { field: "transaction_date", kind: "transaction", column: "date", provenanceKey: "date" });
  assert.equal(resolveFieldTarget("receiptTotal").column, "receiptTotal");
  assert.deepEqual(resolveFieldTarget("line_items.2.unit_price"), { field: "line_items.2.unit_price", kind: "line", column: "unitPrice", lineIndex: 2, provenanceKey: "line_items.2.unitPrice" });
  assert.throws(() => resolveFieldTarget("purchaser_name"), /not a reviewable field/);
  assert.throws(() => resolveFieldTarget("vehicleId"), /not a reviewable field/);
  assert.equal(claimExpired(null), true);
  assert.equal(claimExpired(new Date(Date.now() - (REVIEW_CLAIM_MINUTES + 1) * 60_000)), true);
  assert.equal(claimExpired(new Date(Date.now() - 5 * 60_000)), false);
});

test("queue: reviewer sees only assigned companies, sorted by SLA deadline then severity; drivers see nothing; company filter and mine", async () => {
  const a = await companyWithOwner();
  const b = await companyWithOwner();
  const rev = await reviewerFor(a.company.id);
  // A: an older WARNING-only item and a newer ERROR item; B: an item the reviewer must never see.
  const old = await seedTransaction(a.company.id, { date: "2026-10-05", status: "NEEDS_ATTENTION" });
  await seedIssue(a.company.id, { transactionId: old.tx.id, code: "F003", severity: "WARNING" });
  const young = await seedTransaction(a.company.id, { date: "2026-10-20", status: "NEEDS_ATTENTION" });
  await seedIssue(a.company.id, { transactionId: young.tx.id, code: "V010", severity: "ERROR" });
  const sameDayWarn = await seedTransaction(a.company.id, { date: "2026-10-20", status: "NEEDS_ATTENTION" });
  await seedIssue(a.company.id, { transactionId: sameDayWarn.tx.id, code: "F003", severity: "WARNING" });
  const verified = await seedTransaction(a.company.id, { date: "2026-10-21", status: "VERIFIED" });
  await seedIssue(a.company.id, { transactionId: verified.tx.id, code: "D003", severity: "INFO" });
  const other = await seedTransaction(b.company.id, { date: "2026-10-01", status: "NEEDS_ATTENTION" });
  await seedIssue(b.company.id, { transactionId: other.tx.id, code: "V001", severity: "ERROR" });

  const res = await s.api("GET", "/review/queue", rev.token);
  assert.equal(res.status, 200, res.text);
  const j = res.json as { companies: Array<{ id: string; role: string }>; items: Array<{ id: string; company: { id: string }; deadline: string; overdue: boolean; worstSeverity: string; claimedBy: string | null }>; slaBusinessDays: number };
  assert.deepEqual(j.companies.map((c) => [c.id, c.role]), [[a.company.id, "REVIEWER"]]);
  assert.deepEqual(j.items.map((i) => i.id), [old.tx.id, young.tx.id, sameDayWarn.tx.id], "oldest deadline first, then ERROR before WARNING");
  assert.ok(j.items.every((i) => i.company.id === a.company.id && i.overdue && i.claimedBy === null));
  assert.equal(j.items[0]!.deadline.slice(0, 10), "2026-10-06", "received Monday 10-05 noon → due Tuesday");
  assert.equal(j.slaBusinessDays, 1);

  // The owner of B sees B's item; a driver of A sees nothing; the company filter narrows.
  const ownerB = await s.api("GET", "/review/queue", b.token);
  assert.deepEqual((ownerB.json as { items: Array<{ id: string }> }).items.map((i) => i.id), [other.tx.id]);
  const driver = await createUser("DRIVER");
  await addMember(driver.id, a.company.id, "DRIVER");
  const dq = await s.api("GET", "/review/queue", accessToken(driver.id, "DRIVER"));
  assert.equal(dq.status, 200);
  assert.deepEqual((dq.json as { items: unknown[] }).items, []);
  const filtered = await s.api("GET", `/review/queue?companyId=${b.company.id}`, rev.token);
  assert.deepEqual((filtered.json as { items: unknown[] }).items, [], "a company the reviewer is not a member of yields nothing");
  const mine = await s.api("GET", "/review/queue?mine=true", rev.token);
  assert.deepEqual((mine.json as { items: unknown[] }).items, []);
});

test("claim: second reviewer gets 409 while the claim is fresh, takes over after expiry; release closes the session with seconds and the detail shows reviewer time", async () => {
  const a = await companyWithOwner();
  const r1 = await reviewerFor(a.company.id);
  const r2 = await reviewerFor(a.company.id);
  const t = await seedTransaction(a.company.id, { status: "NEEDS_ATTENTION" });
  await seedIssue(a.company.id, { transactionId: t.tx.id, code: "V010", severity: "ERROR" });
  const url = `/companies/${a.company.id}/transactions/${t.tx.id}`;

  const c1 = await s.api("POST", `${url}/claim`, r1.token);
  assert.equal(c1.status, 200, c1.text);
  assert.equal(c1.json.claimedBy, r1.user.id);
  const again = await s.api("POST", `${url}/claim`, r1.token);
  assert.equal(again.json.sessionId, c1.json.sessionId, "re-claiming keeps the open session");
  const c2 = await s.api("POST", `${url}/claim`, r2.token);
  assert.equal(c2.status, 409, c2.text);
  assert.equal(c2.json.error, "review_claimed");
  const queue = await s.api("GET", "/review/queue", r2.token);
  const item = (queue.json as { items: Array<{ id: string; claimedBy: string; claimedByMe: boolean; claimedByName: string }> }).items.find((i) => i.id === t.tx.id)!;
  assert.equal(item.claimedBy, r1.user.id);
  assert.equal(item.claimedByMe, false);
  assert.equal(item.claimedByName, r1.user.fullName);

  // Expired claim: anyone may take it.
  await prisma.transaction.update({ where: { id: t.tx.id }, data: { reviewClaimedAt: new Date(Date.now() - (REVIEW_CLAIM_MINUTES + 1) * 60_000) } });
  const c3 = await s.api("POST", `${url}/claim`, r2.token);
  assert.equal(c3.status, 200, c3.text);
  assert.equal(c3.json.claimedBy, r2.user.id);

  // r1's session is still open; backdate it and release.
  await prisma.reviewSession.updateMany({ where: { transactionId: t.tx.id, userId: r1.user.id }, data: { startedAt: new Date(Date.now() - 90_000) } });
  const rel = await s.api("POST", `${url}/release`, r1.token);
  assert.equal(rel.status, 200, rel.text);
  assert.ok((rel.json.seconds as number) >= 89 && (rel.json.seconds as number) <= 95, `seconds ${rel.json.seconds}`);
  const row = await prisma.transaction.findUnique({ where: { id: t.tx.id } });
  assert.equal(row!.reviewClaimedBy, r2.user.id, "releasing someone else's claim does not clear it");
  const detail = await s.api("GET", url, a.token);
  const review = (detail.json as { transaction: { review: { claimedBy: string; claimedByName: string; seconds: number } } }).transaction.review;
  assert.equal(review.claimedBy, r2.user.id);
  assert.ok(review.seconds >= 89, "closed session counted");
  const logs = await prisma.auditLog.findMany({ where: { companyId: a.company.id, target: `Transaction:${t.tx.id}`, action: { in: ["review_claim", "review_release"] } } });
  assert.equal(logs.length, 4);

  const driver = await createUser("DRIVER");
  await addMember(driver.id, a.company.id, "DRIVER");
  assert.equal((await s.api("POST", `${url}/claim`, accessToken(driver.id, "DRIVER"))).status, 403);
});

test("field actions: accept read 1 writes a FieldEdit, keeps provenance, resolves V010 and verifies; enter needs a reason; unreadable → UNABLE_TO_VERIFY; line fields", async () => {
  const a = await companyWithOwner();
  const t = await seedTransaction(a.company.id, { date: null, status: "NEEDS_ATTENTION", provenance: PROV });
  const v010 = await seedIssue(a.company.id, { transactionId: t.tx.id, code: "V010", severity: "ERROR" });
  await prisma.issue.update({ where: { id: v010.id }, data: { fields: ["transaction_date"] } });
  const url = `/companies/${a.company.id}/transactions/${t.tx.id}`;

  const noValue = await s.api("POST", `${url}/field-action`, a.token, { field: "transaction_date", action: "accept_b" });
  assert.equal(noValue.status, 200, noValue.text);
  // pass B had a value → accepted; the owner is not a reviewer, so no approval is needed.
  const r = noValue.json as { result: { oldValue: string | null; newValue: string; approvalId: string | null; status: string }; transaction: { date: string; status: string; provenance: { fields: Record<string, { passA: string }> }; fieldEdits: Array<{ field: string; reason: string }> } };
  assert.equal(r.result.oldValue, null);
  assert.equal(r.result.newValue, "2026-10-16");
  assert.equal(r.result.approvalId, null);
  assert.equal(r.result.status, "VERIFIED");
  assert.equal(r.transaction.date.slice(0, 10), "2026-10-16");
  assert.equal(r.transaction.provenance.fields.date.passA, "2026-10-15", "provenance untouched");
  assert.match(r.transaction.fieldEdits[0]!.reason, /accepted read 2/);
  assert.equal((await prisma.issue.findUnique({ where: { id: v010.id } }))!.status, "RESOLVED");
  const tx = await prisma.transaction.findUnique({ where: { id: t.tx.id } });
  assert.equal(tx!.status, "VERIFIED");
  assert.equal(tx!.verifiedBy, a.user.id);

  const missingA = await s.api("POST", `${url}/field-action`, a.token, { field: "odometer", action: "accept_a" });
  assert.equal(missingA.status, 400, missingA.text);
  assert.match(String(missingA.json.message), /has no value/);
  const enterNoReason = await s.api("POST", `${url}/field-action`, a.token, { field: "receipt_total", action: "enter", value: "420.00" });
  assert.equal(enterNoReason.status, 400);
  const enterBad = await s.api("POST", `${url}/field-action`, a.token, { field: "receipt_total", action: "enter", value: "abc", reason: "typed from the receipt" });
  assert.equal(enterBad.status, 400);
  const entered = await s.api("POST", `${url}/field-action`, a.token, { field: "receipt_total", action: "enter", value: "420.00", reason: "typed from the receipt" });
  assert.equal(entered.status, 200, entered.text);
  assert.equal((entered.json as { result: { newValue: string } }).result.newValue, "420.00");

  const line = await s.api("POST", `${url}/field-action`, a.token, { field: "line_items.0.quantity", action: "accept_a" });
  assert.equal(line.status, 200, line.text);
  const lineRow = await prisma.transactionLine.findFirst({ where: { transactionId: t.tx.id } });
  assert.equal(lineRow!.quantity!.toString(), "100");
  const lineEdit = await prisma.fieldEdit.findFirst({ where: { entity: "TransactionLine", entityId: lineRow!.id } });
  assert.equal(lineEdit!.field, "quantity");
  assert.equal((await s.api("POST", `${url}/field-action`, a.token, { field: "line_items.7.amount", action: "accept_a" })).status, 400);

  const unreadable = await s.api("POST", `${url}/field-action`, a.token, { field: "vendor", action: "unreadable" });
  assert.equal(unreadable.status, 200, unreadable.text);
  assert.equal((unreadable.json as { result: { status: string; newValue: null } }).result.status, "UNABLE_TO_VERIFY");
  assert.equal((await prisma.transaction.findUnique({ where: { id: t.tx.id } }))!.vendor, null);
  const edits = await prisma.fieldEdit.count({ where: { entity: "Transaction", entityId: t.tx.id } });
  assert.equal(edits, 3, "every decision is in the history");
});

test("reviewer correction of a material field opens Approval + R001 until the owner approves; reject reverts through a new FieldEdit", async () => {
  const a = await companyWithOwner();
  const rev = await reviewerFor(a.company.id);
  const t = await seedTransaction(a.company.id, { receiptTotal: "412.50", status: "NEEDS_ATTENTION", provenance: PROV });
  const v010 = await seedIssue(a.company.id, { transactionId: t.tx.id, code: "V010", severity: "ERROR" });
  const url = `/companies/${a.company.id}/transactions/${t.tx.id}`;

  const res = await s.api("POST", `${url}/field-action`, rev.token, { field: "receipt_total", action: "enter", value: "421.50", reason: "the printed total is 421.50" });
  assert.equal(res.status, 200, res.text);
  const r = res.json as { result: { approvalId: string; status: string }; transaction: { review: { pendingApprovals: Array<{ id: string }> } } };
  assert.ok(r.result.approvalId);
  assert.equal(r.result.status, "NEEDS_ATTENTION", "R001 keeps it open");
  assert.equal(r.transaction.review.pendingApprovals.length, 1);
  assert.equal((await prisma.transaction.findUnique({ where: { id: t.tx.id } }))!.receiptTotal!.toString(), "421.5", "applied at once");
  const r001 = await prisma.issue.findFirst({ where: { transactionId: t.tx.id, code: "R001", status: "OPEN" } });
  assert.ok(r001);
  assert.deepEqual(r001!.fields, ["receipt_total"]);
  await prisma.issue.update({ where: { id: v010.id }, data: { status: "RESOLVED" } });

  // Non-material field by a reviewer needs no approval.
  const minor = await s.api("POST", `${url}/field-action`, rev.token, { field: "time", action: "enter", value: "09:15", reason: "printed time" });
  assert.equal((minor.json as { result: { approvalId: string | null } }).result.approvalId, null);

  // A reviewer cannot approve; the owner lists and approves.
  assert.equal((await s.api("POST", `/companies/${a.company.id}/approvals/${r.result.approvalId}/approve`, rev.token, {})).status, 403);
  const list = await s.api("GET", `/companies/${a.company.id}/approvals`, a.token);
  assert.equal((list.json as { approvals: Array<{ id: string; status: string; user: { id: string } }> }).approvals[0]!.user.id, rev.user.id);
  const cross = await s.api("GET", "/review/approvals", a.token);
  assert.equal((cross.json as { approvals: Array<{ id: string; company: { id: string } }> }).approvals.filter((x) => x.company.id === a.company.id).length, 1);
  const ok = await s.api("POST", `/companies/${a.company.id}/approvals/${r.result.approvalId}/approve`, a.token, { note: "checked against the image" });
  assert.equal(ok.status, 200, ok.text);
  assert.equal(ok.json.status, "VERIFIED");
  assert.equal((await prisma.issue.findUnique({ where: { id: r001!.id } }))!.status, "RESOLVED");
  assert.equal((await s.api("POST", `/companies/${a.company.id}/approvals/${r.result.approvalId}/approve`, a.token, {})).status, 400, "decided once");

  // Reject path on a second correction: value reverts, the reviewer's edit stays in history.
  const second = await s.api("POST", `${url}/field-action`, rev.token, { field: "vendor", action: "enter", value: "Wrong Vendor", reason: "misread" });
  const approvalId = (second.json as { result: { approvalId: string } }).result.approvalId;
  assert.equal((await s.api("POST", `/companies/${a.company.id}/approvals/${approvalId}/reject`, a.token, {})).status, 400, "a note is required to reject");
  const rej = await s.api("POST", `/companies/${a.company.id}/approvals/${approvalId}/reject`, a.token, { note: "the receipt says Fictional Fuel Stop" });
  assert.equal(rej.status, 200, rej.text);
  assert.equal((await prisma.transaction.findUnique({ where: { id: t.tx.id } }))!.vendor, "Fictional Fuel Stop");
  const history = await prisma.fieldEdit.findMany({ where: { entity: "Transaction", entityId: t.tx.id, field: "vendor" }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(history.map((h) => [h.oldValue, h.newValue]), [["Fictional Fuel Stop", "Wrong Vendor"], ["Wrong Vendor", "Fictional Fuel Stop"]]);
  assert.equal(rej.json.status, "VERIFIED");
  assert.equal(await prisma.issue.count({ where: { transactionId: t.tx.id, code: "R001", status: "OPEN" } }), 0);

  // Tenancy: company B's owner cannot act on A's transaction or approvals.
  const b = await companyWithOwner();
  assert.equal((await s.api("POST", `${url}/field-action`, b.token, { field: "time", action: "enter", value: "10:00", reason: "x" })).status, 404);
  assert.equal((await s.api("POST", `/companies/${b.company.id}/approvals/${approvalId}/approve`, b.token, {})).status, 404);
});

test("resolving the last open ERROR issue verifies the transaction; accepting a warning on an UNABLE_TO_VERIFY one leaves it", async () => {
  const a = await companyWithOwner();
  const t = await seedTransaction(a.company.id, { status: "NEEDS_ATTENTION" });
  const i = await seedIssue(a.company.id, { transactionId: t.tx.id, code: "F002", severity: "ERROR" });
  const res = await s.api("POST", `/companies/${a.company.id}/issues/${i.id}/resolve`, a.token, { note: "fixed" });
  assert.equal(res.status, 200, res.text);
  assert.equal((await prisma.transaction.findUnique({ where: { id: t.tx.id } }))!.status, "VERIFIED");

  const u = await seedTransaction(a.company.id, { status: "UNABLE_TO_VERIFY" });
  const w = await seedIssue(a.company.id, { transactionId: u.tx.id, code: "V006", severity: "WARNING" });
  await s.api("POST", `/companies/${a.company.id}/issues/${w.id}/accept`, a.token, { note: "faded but fine" });
  assert.equal((await prisma.transaction.findUnique({ where: { id: u.tx.id } }))!.status, "UNABLE_TO_VERIFY");
  void seedVehicle;
});
