// ─────────────────────────────────────────────────────────────────────────────
//  Local dev helper: a full fictional quarter for Demo Freight LLC.
//  Replays every golden receipt (packages/extraction/golden) through the real
//  pipeline — preprocess, two passes, reconcile, rules — using the FakeExtractor,
//  so no AI key or spend is needed and every value traces to a fixture file.
//  Run from apps/api:
//    npx dotenv -e .env.local -- npx tsx scripts/seed-golden-quarter.ts [--reset]
//  --reset first removes Demo Freight's transactions, issues, imports and jobs in
//  the LOCAL database (documents are kept: retention forbids deleting them, so
//  existing ones with the same fingerprint are reused). Refuses non-localhost DBs.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { retentionUntil, sha256Hex } from "@tbo/core";
import { FakeExtractor, GOLDEN_DIR, goldenAnswers } from "@tbo/extraction";
import { loadEnv } from "../src/config/env";
import { extractionProcessors, makePreprocess } from "../src/jobs/extraction";
import { PREPROCESS_STEP } from "../src/jobs/processors/preprocess";
import { enqueue, type Processor, runOne } from "../src/jobs/queue";
import { createStorage } from "../src/storage";

const DB_URL = process.env.DATABASE_URL || "";
if (!/(localhost|127\.0\.0\.1)/.test(DB_URL)) {
  console.error("Refusing: DATABASE_URL is not localhost.");
  process.exit(1);
}
const reset = process.argv.includes("--reset");
const prisma = new PrismaClient();
const env = loadEnv({ ...process.env, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "sk-ant-local-fake" });
const storage = createStorage(env);

type Fixture = { id: string; file: string; variant: string };
const manifest = JSON.parse(readFileSync(path.join(GOLDEN_DIR, "manifest.json"), "utf8")) as { fixtures: Fixture[] };
// How each fixture reached the office, for a realistic Inbox: drivers text or snap most receipts; the office uploads PDFs.
const CHANNEL: Record<string, "WEB" | "MOBILE" | "SMS" | "EMAIL"> = {
  g001: "MOBILE", g002: "SMS", g003: "MOBILE", g004: "SMS", g005: "MOBILE", g006: "WEB", g007: "SMS", g008: "MOBILE", g009: "SMS", g010: "MOBILE",
  g011: "SMS", g012: "MOBILE", g013: "SMS", g014: "WEB", g015: "WEB", g016: "SMS", g017: "MOBILE", g018: "WEB", g019: "EMAIL", g020: "EMAIL",
};

async function resetCompany(companyId: string) {
  const tx = { transaction: { companyId } };
  const doc = { document: { companyId } };
  await prisma.match.deleteMany({ where: tx });
  await prisma.issue.deleteMany({ where: { companyId } });
  await prisma.reviewSession.deleteMany({ where: { companyId } });
  await prisma.approval.deleteMany({ where: { companyId } });
  await prisma.fieldEdit.deleteMany({ where: { companyId } });
  await prisma.transactionLine.deleteMany({ where: tx });
  await prisma.transaction.deleteMany({ where: { companyId } });
  await prisma.extractedField.deleteMany({ where: { run: { region: doc } } });
  await prisma.extractionRun.deleteMany({ where: { region: doc } });
  await prisma.documentRegion.deleteMany({ where: doc });
  await prisma.fuelCardTransaction.deleteMany({ where: { companyId } });
  await prisma.fuelCardImport.deleteMany({ where: { companyId } });
  await prisma.mileageRecord.deleteMany({ where: { companyId } });
  await prisma.mileageImport.deleteMany({ where: { companyId } });
  await prisma.job.deleteMany({ where: { companyId } });
  // Documents stay: the database refuses to delete anything inside its retention window. They are reused by fingerprint below.
  await prisma.document.updateMany({ where: { companyId }, data: { status: "RECEIVED" } });
  console.log("Reset Demo Freight transactions, issues, imports and jobs (local); documents kept and reused.");
}

async function drain(processors: Record<string, Processor>, maxLoops = 600) {
  const steps = Object.keys(processors);
  for (let i = 0; i < maxLoops; i++) {
    const r = await runOne(prisma, processors);
    if (r.ran) continue;
    await prisma.job.updateMany({ where: { status: "QUEUED", step: { in: steps }, runAfter: { gt: new Date() } }, data: { runAfter: new Date(0) } });
    const left = await prisma.job.count({ where: { status: { in: ["QUEUED", "RUNNING"] }, step: { in: steps } } });
    if (left === 0) return;
  }
  throw new Error("drain: pipeline did not settle");
}

async function main() {
  const company = await prisma.company.findUnique({ where: { inboundEmailSlug: "demo-freight" } });
  if (!company) throw new Error("Demo Freight LLC is not seeded; run npm run db:seed:backoffice:local first");
  const owner = await prisma.user.findUnique({ where: { email: "owner@demofreight.test" } });
  const office = await prisma.user.findUnique({ where: { email: "office@demofreight.test" } });
  const drivers = await prisma.user.findMany({ where: { email: { in: ["driver1@demofreight.test", "driver2@demofreight.test", "driver3@demofreight.test"] } }, orderBy: { email: "asc" } });
  if (reset) await resetCompany(company.id);

  const answers = goldenAnswers();
  const processors: Record<string, Processor> = { [PREPROCESS_STEP]: makePreprocess(env), ...extractionProcessors({ env, storage, extractor: new FakeExtractor(answers) }) };

  let uploaded = 0;
  const used = new Set<string>();
  for (const f of manifest.fixtures) {
    const bytes = readFileSync(path.join(GOLDEN_DIR, f.file));
    const sha256 = sha256Hex(bytes);
    const expected = JSON.parse(readFileSync(path.join(GOLDEN_DIR, `${f.id}.expected.json`), "utf8")) as { receipts: Array<{ fields: Record<string, { value: unknown }> }> };
    const printed = expected.receipts[0]?.fields.transaction_date?.value;
    const receivedAt = typeof printed === "string" ? new Date(`${printed}T18:30:00Z`) : new Date();
    const channel = CHANNEL[f.id] ?? "WEB";
    const uploader = channel === "WEB" || channel === "EMAIL" ? office ?? owner : drivers[uploaded % Math.max(1, drivers.length)] ?? owner;
    const mimeType = f.file.endsWith(".pdf") ? "application/pdf" : "image/png";
    const data = { channel, uploadedById: uploader?.id ?? null, filename: f.file, mimeType, sizeBytes: bytes.length, receivedAt, status: "RECEIVED" as const };
    const reusable = await prisma.document.findFirst({ where: { companyId: company.id, sha256, id: { notIn: [...used] } }, orderBy: { receivedAt: "asc" } });
    const doc = reusable
      ? await prisma.document.update({ where: { id: reusable.id }, data })
      : await prisma.document.create({
          data: {
            ...data,
            companyId: company.id,
            storageKey: `companies/${company.id}/documents/${f.id}-${Date.now()}/original.${f.file.split(".").pop()}`,
            sha256,
            retentionUntil: retentionUntil(receivedAt),
          },
        });
    used.add(doc.id);
    try {
      await storage.put(doc.storageKey, bytes, mimeType);
    } catch (e) {
      if (!reusable || (e as NodeJS.ErrnoException).code !== "EEXIST") throw e; // originals are immutable; a reused document already has its file
    }
    await enqueue(prisma, { step: PREPROCESS_STEP, version: "v1", companyId: company.id, payload: { documentId: doc.id } });
    uploaded++;
  }
  console.log(`Uploaded ${uploaded} fixtures; running the pipeline with the fake extractor…`);
  await drain(processors);

  const byStatus = await prisma.transaction.groupBy({ by: ["status"], where: { companyId: company.id }, _count: true });
  const issues = await prisma.issue.groupBy({ by: ["code"], where: { companyId: company.id, status: "OPEN" }, _count: true, orderBy: { code: "asc" } });
  const docs = await prisma.document.groupBy({ by: ["status"], where: { companyId: company.id }, _count: true });
  console.log("Documents:", docs.map((d) => `${d.status} ${d._count}`).join(", "));
  console.log("Transactions:", byStatus.map((s) => `${s.status} ${s._count}`).join(", "));
  console.log("Open issues:", issues.map((i) => `${i.code} ${i._count}`).join(", ") || "none");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
