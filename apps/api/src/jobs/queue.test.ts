import { test } from "node:test";
import assert from "node:assert/strict";
import { retentionUntil } from "@tbo/core";
import { companyWithOwner, prisma, uid } from "../test/fixtures";
import { PREPROCESS_STEP, PREPROCESS_VERSION, preprocess } from "./processors/preprocess";
import { claimNext, enqueue, runOne } from "./queue";

async function doc(companyId: string, userId: string) {
  return prisma.document.create({
    data: {
      companyId,
      uploadedById: userId,
      channel: "WEB",
      storageKey: `companies/${companyId}/documents/${uid("d")}/original.png`,
      filename: "r.png",
      mimeType: "image/png",
      sizeBytes: 1,
      sha256: uid("sha"),
      retentionUntil: retentionUntil(new Date()),
    },
  });
}

test("enqueue is idempotent per documentId:step:version", async () => {
  const { company, user } = await companyWithOwner();
  const d = await doc(company.id, user.id);
  const first = await enqueue(prisma, { step: PREPROCESS_STEP, version: PREPROCESS_VERSION, companyId: company.id, payload: { documentId: d.id } });
  const second = await enqueue(prisma, { step: PREPROCESS_STEP, version: PREPROCESS_VERSION, companyId: company.id, payload: { documentId: d.id } });
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.id, second.id);
  assert.equal(await prisma.job.count({ where: { idempotencyKey: `${d.id}:preprocess:v1` } }), 1);
  // A new version is a new unit of work.
  const v2 = await enqueue(prisma, { step: PREPROCESS_STEP, version: "v2", companyId: company.id, payload: { documentId: d.id } });
  assert.equal(v2.created, true);
});

test("preprocess runs once, marks the document PROCESSED, and re-running is a no-op", async () => {
  const { company, user } = await companyWithOwner();
  const d = await doc(company.id, user.id);
  const subject = uid("job");
  await enqueue(prisma, { step: PREPROCESS_STEP, version: PREPROCESS_VERSION, companyId: company.id, payload: { documentId: d.id }, subject });

  const processors = { [PREPROCESS_STEP]: preprocess };
  // Drain until our job has run (other tests may have queued jobs too).
  let result = await runOne(prisma, processors);
  while (result.ran && result.job.idempotencyKey !== `${subject}:preprocess:v1`) result = await runOne(prisma, processors);
  assert.ok(result.ran && result.status === "DONE");
  assert.equal((await prisma.document.findUnique({ where: { id: d.id } }))?.status, "PROCESSED");

  const job = await prisma.job.findUnique({ where: { idempotencyKey: `${subject}:preprocess:v1` } });
  assert.equal(job?.status, "DONE");
  assert.equal(job?.attempts, 1);

  // Running the processor again directly must not change anything.
  const before = await prisma.document.findUnique({ where: { id: d.id } });
  await preprocess({ ...job!, payload: { documentId: d.id } } as never, prisma);
  const after = await prisma.document.findUnique({ where: { id: d.id } });
  assert.deepEqual(after, before);
});

test("a failing job is retried with backoff and ends FAILED after maxAttempts", async () => {
  const subject = uid("bad");
  await enqueue(prisma, { step: "explode", version: "v1", payload: { documentId: subject }, subject });
  await prisma.job.update({ where: { idempotencyKey: `${subject}:explode:v1` }, data: { maxAttempts: 2 } });
  const processors = {
    explode: async () => {
      throw new Error("boom");
    },
  };
  const r1 = await runOne(prisma, processors);
  assert.ok(r1.ran && r1.status === "QUEUED");
  let job = await prisma.job.findUnique({ where: { idempotencyKey: `${subject}:explode:v1` } });
  assert.match(job?.error ?? "", /boom/);
  assert.ok(job!.runAfter.getTime() > Date.now(), "backoff scheduled in the future");

  // Make it runnable now and exhaust attempts.
  await prisma.job.update({ where: { id: job!.id }, data: { runAfter: new Date(0) } });
  const r2 = await runOne(prisma, processors);
  assert.ok(r2.ran && r2.status === "FAILED");
  job = await prisma.job.findUnique({ where: { id: job!.id } });
  assert.equal(job?.status, "FAILED");
  assert.equal(await claimNext(prisma, ["explode"]), null);
});
