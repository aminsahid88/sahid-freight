import { test } from "node:test";
import assert from "node:assert/strict";
import { accessToken, addMember, companyWithOwner, createUser, prisma } from "../test/fixtures";
import { seedTransaction, startTestServer, type TestServer } from "./test-harness";
import { EXTRACT_A_STEP, EXTRACT_B_STEP, PIPELINE_VERSION } from "../jobs/extraction";

let s: TestServer;
test.before(async () => {
  s = await startTestServer();
});
test.after(async () => s.close());

test("re-read: queues both passes under the current pipeline version once, audits it, and refuses when a human already corrected the transaction", async () => {
  const { company, token, user } = await companyWithOwner();
  const seeded = await seedTransaction(company.id, { date: "2026-10-02" });
  const documentId = seeded.documentId!;

  const first = await s.api("POST", `/companies/${company.id}/documents/${documentId}/reprocess`, token);
  assert.equal(first.status, 202, first.text);
  assert.equal(first.json.queued, true);
  const body = first.json as { queued: boolean; jobs: Array<{ step: string; created: boolean }> };
  assert.deepEqual(body.jobs.map((j) => [j.step, j.created]).sort(), [[EXTRACT_A_STEP, true], [EXTRACT_B_STEP, true]].sort());
  const jobs = await prisma.job.findMany({ where: { idempotencyKey: { startsWith: `${documentId}:` } }, select: { idempotencyKey: true, status: true } });
  assert.deepEqual(jobs.map((j) => j.idempotencyKey).sort(), [`${documentId}:${EXTRACT_A_STEP}:${PIPELINE_VERSION}`, `${documentId}:${EXTRACT_B_STEP}:${PIPELINE_VERSION}`].sort());
  const doc = await prisma.document.findUniqueOrThrow({ where: { id: documentId }, select: { status: true } });
  assert.equal(doc.status, "PROCESSING");
  const audit = await prisma.auditLog.findFirst({ where: { companyId: company.id, action: "reprocess", target: `Document:${documentId}` } });
  assert.ok(audit, "audit entry written");

  // Same version again: nothing new is queued.
  const again = await s.api("POST", `/companies/${company.id}/documents/${documentId}/reprocess`, token);
  assert.equal(again.status, 202);
  assert.equal(again.json.queued, false);

  // A human correction protects the transaction from being re-read over.
  await prisma.fieldEdit.create({ data: { companyId: company.id, entity: "Transaction", entityId: seeded.tx.id, field: "date", oldValue: null, newValue: "2026-10-02", reason: "typed from the receipt", userId: user.id } });
  const refused = await s.api("POST", `/companies/${company.id}/documents/${documentId}/reprocess`, token);
  assert.equal(refused.status, 409, refused.text);
  assert.equal(refused.json.error, "human_edited");
});

test("re-read: drivers and other companies are refused", async () => {
  const { company } = await companyWithOwner();
  const documentId = (await seedTransaction(company.id, { date: "2026-10-03" })).documentId!;
  const driver = await createUser("DRIVER");
  await addMember(driver.id, company.id, "DRIVER");
  const asDriver = await s.api("POST", `/companies/${company.id}/documents/${documentId}/reprocess`, accessToken(driver.id, "DRIVER"));
  assert.equal(asDriver.status, 403, asDriver.text);
  const other = await companyWithOwner();
  const cross = await s.api("POST", `/companies/${other.company.id}/documents/${documentId}/reprocess`, other.token);
  assert.equal(cross.status, 404, cross.text);
});
