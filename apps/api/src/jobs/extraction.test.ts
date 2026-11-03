import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { retentionUntil, sha256Hex } from "@tbo/core";
import { FakeExtractor, GOLDEN_DIR, goldenAnswers, type GoldenExpected } from "@tbo/extraction";
import { seedJurisdictions, seedPeriod, seedVehicle } from "../backoffice/test-harness";
import { loadEnv } from "../config/env";
import { LocalStorage } from "../storage";
import { companyWithOwner, prisma } from "../test/fixtures";
import { BudgetExceededError, EXTRACT_A_STEP, EXTRACT_B_STEP, extractionProcessors, makePreprocess, monthSpendUsd, PIPELINE_VERSION, RECONCILE_STEP } from "./extraction";
import { PREPROCESS_STEP } from "./processors/preprocess";
import { enqueue, type Processor, runOne } from "./queue";

const dir = mkdtempSync(path.join(os.tmpdir(), "tbo-pipeline-"));
test.after(() => rmSync(dir, { recursive: true, force: true }));

const env = loadEnv({ ...process.env, ANTHROPIC_API_KEY: "sk-ant-test", EXTRACTION_MODEL_A: "claude-opus-5-5", EXTRACTION_MODEL_B: "claude-sonnet-5-5", AI_MONTHLY_BUDGET_USD: "50" });
const storage = new LocalStorage({ dir, secret: "s", baseUrl: "http://localhost:0" });
const answers = goldenAnswers();

function processorsWith(extractor: FakeExtractor, e = env): Record<string, Processor> {
  return { [PREPROCESS_STEP]: makePreprocess(e), ...extractionProcessors({ env: e, storage, extractor }) };
}

async function uploadGolden(companyId: string, fixtureId: string) {
  const file = fixtureId === "g019" || fixtureId === "g020" ? `${fixtureId}.pdf` : `${fixtureId}.png`;
  const bytes = readFileSync(path.join(GOLDEN_DIR, file));
  const doc = await prisma.document.create({
    data: {
      companyId,
      channel: "WEB",
      storageKey: `companies/${companyId}/documents/${fixtureId}-${Date.now()}/original.${file.split(".").pop()}`,
      filename: file,
      mimeType: file.endsWith(".pdf") ? "application/pdf" : "image/png",
      sizeBytes: bytes.length,
      sha256: sha256Hex(bytes),
      retentionUntil: retentionUntil(new Date()),
    },
  });
  await storage.put(doc.storageKey, bytes, doc.mimeType);
  await enqueue(prisma, { step: PREPROCESS_STEP, version: "v1", companyId, payload: { documentId: doc.id } });
  return doc;
}

/** Run every runnable job for these processors; pull back-off jobs forward so retries happen now. */
async function drain(processors: Record<string, Processor>, maxLoops = 400) {
  const steps = Object.keys(processors);
  for (let i = 0; i < maxLoops; i++) {
    const r = await runOne(prisma, processors);
    if (r.ran) continue;
    // Pull backed-off retries forward; stop only when nothing is queued or running for these steps.
    await prisma.job.updateMany({ where: { status: "QUEUED", step: { in: steps }, runAfter: { gt: new Date() } }, data: { runAfter: new Date(0) } });
    const left = await prisma.job.count({ where: { status: { in: ["QUEUED", "RUNNING"] }, step: { in: steps } } });
    if (left === 0) return;
  }
  throw new Error("drain: pipeline did not settle");
}

async function setup() {
  await seedJurisdictions();
  for (const [code, name] of [["ND", "North Dakota"], ["MT", "Montana"], ["MB", "Manitoba"]] as const) {
    await prisma.jurisdiction.upsert({ where: { code }, update: {}, create: { code, name, country: code === "MB" ? "CA" : "US", iftaMember: true } });
  }
  const { company, user } = await companyWithOwner();
  const period = await seedPeriod(company.id);
  const vehicle = await seedVehicle(company.id, "102");
  return { company, user, period, vehicle };
}

test("a clean golden receipt flows upload → two passes → reconciled, verified transaction with provenance", async () => {
  const { company, period, vehicle } = await setup();
  const fake = new FakeExtractor(answers);
  const processors = processorsWith(fake);
  const doc = await uploadGolden(company.id, "g001");
  await drain(processors);

  const after = await prisma.document.findUniqueOrThrow({ where: { id: doc.id }, include: { regions: { include: { runs: true, transaction: { include: { lines: true, issues: true } } } } } });
  assert.equal(after.status, "PROCESSED");
  assert.equal(after.regions.length, 1);
  const runs = after.regions[0]!.runs;
  assert.deepEqual(runs.map((r) => [r.pass, r.modelId, r.status]).sort(), [["A", "claude-opus-5-5", "DONE"], ["B", "claude-sonnet-5-5", "DONE"]]);
  assert.ok(Number(runs.find((r) => r.pass === "A")!.costUsd) > 0, "cost tracked");
  assert.equal(await prisma.extractedField.count({ where: { runId: runs[0]!.id } }) > 10, true);

  const tx = after.regions[0]!.transaction!;
  assert.equal(tx.vendor, "NORTHSTAR TRAVEL CENTER");
  assert.equal(tx.state, "ND");
  assert.equal(tx.date?.toISOString().slice(0, 10), "2026-10-02");
  assert.equal(tx.receiptTotal?.toString(), "461.72");
  assert.equal(tx.vehicleId, vehicle.id);
  assert.equal(tx.periodId, period.id);
  assert.equal(tx.corroboration, "TWO_PASS");
  assert.equal(tx.status, "VERIFIED");
  assert.equal(tx.iftaTaxableGallons?.toString(), "118.42");
  assert.equal(tx.lines.length, 1);
  assert.equal(tx.lines[0]!.category, "MOTOR_FUEL");
  assert.equal(tx.lines[0]!.quantity?.toString(), "118.42");
  const prov = tx.provenance as { fields: Record<string, { finalSource: string; agree: boolean }>; disagreements: unknown[] };
  assert.equal(prov.fields.receiptTotal?.finalSource, "both");
  assert.equal(prov.disagreements.length, 0);
  assert.deepEqual(tx.issues.map((i) => i.code), []);
  assert.deepEqual(fake.calls.map((c) => c.pass).sort(), ["A", "B"]);

  // Idempotent: draining again and re-enqueueing changes nothing.
  await enqueue(prisma, { step: PREPROCESS_STEP, version: "v1", companyId: company.id, payload: { documentId: doc.id } });
  await drain(processors);
  assert.equal(await prisma.extractionRun.count({ where: { region: { documentId: doc.id } } }), 2);
  assert.equal(await prisma.transaction.count({ where: { regionId: after.regions[0]!.id } }), 1);
  assert.equal(await prisma.job.count({ where: { idempotencyKey: { in: [`${doc.id}:${EXTRACT_A_STEP}:${PIPELINE_VERSION}`, `${doc.id}:${EXTRACT_B_STEP}:${PIPELINE_VERSION}`, `${doc.id}:${RECONCILE_STEP}:${PIPELINE_VERSION}`] } } }), 3);
  assert.equal(fake.calls.length, 2, "no extra model calls on re-run");
  assert.ok(Number(await monthSpendUsd(prisma)) > 0);
});

test("a receipt without a unit number is flagged (V002, S001) but not blocked; a multi-page PDF yields one transaction per page", async () => {
  const { company } = await setup();
  const processors = processorsWith(new FakeExtractor(answers));
  const doc = await uploadGolden(company.id, "g013");
  const pdf = await uploadGolden(company.id, "g019");
  await drain(processors);
  const tx = await prisma.transaction.findFirstOrThrow({ where: { region: { documentId: doc.id } }, include: { issues: true } });
  assert.deepEqual(tx.issues.map((i) => i.code).sort(), ["S001", "V002"]);
  assert.ok(tx.issues.every((i) => i.severity === "WARNING"));
  assert.equal(tx.status, "VERIFIED");
  assert.equal(tx.vehicleId, null);
  const pages = await prisma.transaction.findMany({ where: { region: { documentId: pdf.id } }, include: { region: true }, orderBy: { region: { page: "asc" } } });
  assert.equal(pages.length, 3);
  assert.deepEqual(pages.map((p) => p.region!.page), [1, 2, 3]);
  assert.equal((await prisma.document.findUniqueOrThrow({ where: { id: pdf.id } })).status, "PROCESSED");
});

test("when the passes disagree on the total, nothing is picked: V010 error, needs attention, total left empty", async () => {
  const { company } = await setup();
  const g001 = readFileSync(path.join(GOLDEN_DIR, "g001.png"));
  const expected = answers.get(sha256Hex(g001))!;
  const tampered: GoldenExpected = structuredClone(expected);
  tampered.receipts[0]!.fields.receipt_total!.value = 416.72;
  const fake = new FakeExtractor(new Map([[sha256Hex(g001), (pass: "A" | "B") => (pass === "A" ? expected : tampered)]]));
  const processors = processorsWith(fake);
  const doc = await uploadGolden(company.id, "g001");
  await drain(processors);
  const tx = await prisma.transaction.findFirstOrThrow({ where: { region: { documentId: doc.id } }, include: { issues: true } });
  assert.equal(tx.status, "NEEDS_ATTENTION");
  assert.equal(tx.receiptTotal, null, "never pick a side");
  assert.ok(tx.issues.some((i) => i.code === "V010" && i.severity === "ERROR"));
  const prov = tx.provenance as { fields: Record<string, { passA: string | null; passB: string | null; finalSource: string | null }> };
  assert.deepEqual(prov.fields.receiptTotal, { ...prov.fields.receiptTotal, passA: "461.72", passB: "416.72", finalSource: null });
});

test("a human-corrected transaction is never overwritten by re-reconciliation", async () => {
  const { company, user } = await setup();
  const processors = processorsWith(new FakeExtractor(answers));
  const doc = await uploadGolden(company.id, "g002");
  await drain(processors);
  const tx = await prisma.transaction.findFirstOrThrow({ where: { region: { documentId: doc.id } } });
  await prisma.fieldEdit.create({ data: { companyId: company.id, entity: "Transaction", entityId: tx.id, field: "vendor", oldValue: tx.vendor, newValue: "CORRECTED BY OWNER", reason: "test", userId: user.id } });
  await prisma.transaction.update({ where: { id: tx.id }, data: { vendor: "CORRECTED BY OWNER" } });
  await processors[RECONCILE_STEP]!({ id: "x", idempotencyKey: "x", step: RECONCILE_STEP, companyId: company.id, payload: { documentId: doc.id }, attempts: 1, maxAttempts: 1 }, prisma);
  assert.equal((await prisma.transaction.findUniqueOrThrow({ where: { id: tx.id } })).vendor, "CORRECTED BY OWNER");
});

test("the monthly AI budget stops extraction with a readable error and marks the document failed", async () => {
  const { company } = await setup();
  const tight = loadEnv({ ...process.env, ANTHROPIC_API_KEY: "sk-ant-test", AI_MONTHLY_BUDGET_USD: "0" });
  const processors = processorsWith(new FakeExtractor(answers), tight);
  const doc = await uploadGolden(company.id, "g003");
  await processors[PREPROCESS_STEP]!({ id: "p", idempotencyKey: "p", step: PREPROCESS_STEP, companyId: company.id, payload: { documentId: doc.id }, attempts: 1, maxAttempts: 1 }, prisma);
  await assert.rejects(
    processors[EXTRACT_A_STEP]!({ id: "a", idempotencyKey: "a", step: EXTRACT_A_STEP, companyId: company.id, payload: { documentId: doc.id }, attempts: 1, maxAttempts: 1 }, prisma),
    (e: unknown) => e instanceof BudgetExceededError && /AI budget exhausted/.test((e as Error).message),
  );
  assert.equal((await prisma.document.findUniqueOrThrow({ where: { id: doc.id } })).status, "FAILED");
});
