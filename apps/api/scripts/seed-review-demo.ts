// ─────────────────────────────────────────────────────────────────────────────
//  Local dev helper: one flagged, fully fictional receipt for Demo Freight LLC
//  so the Review page has something to show without running extraction.
//  Run from apps/api: `npx dotenv -e .env.local -- npx tsx scripts/seed-review-demo.ts`
//  Refuses non-localhost databases. Copies golden g001.png into local storage.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const DB_URL = process.env.DATABASE_URL || "";
if (!/(localhost|127\.0\.0\.1)/.test(DB_URL)) {
  console.error("Refusing: DATABASE_URL is not localhost.");
  process.exit(1);
}
const prisma = new PrismaClient();
const STORAGE_DIR = path.resolve(process.env.LOCAL_STORAGE_DIR ?? ".storage");
const GOLDEN = path.resolve(__dirname, "../../../packages/extraction/golden/g003.png");

async function main() {
  const company = await prisma.company.findUnique({ where: { inboundEmailSlug: "demo-freight" } });
  if (!company) throw new Error("Demo Freight LLC is not seeded; run npm run db:seed:backoffice:local first");
  const vehicle = await prisma.vehicle.findFirst({ where: { companyId: company.id, unitNumber: "101" } });
  const owner = await prisma.user.findUnique({ where: { email: "owner@demofreight.test" } });
  const period = await prisma.reportingPeriod.findFirst({ where: { companyId: company.id, type: "QUARTER" }, orderBy: { startDate: "desc" } });

  const bytes = readFileSync(GOLDEN);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const existing = await prisma.document.findFirst({ where: { companyId: company.id, sha256 }, include: { regions: { include: { transaction: true, runs: true } } } });
  const existingRegion = existing?.regions[0];
  if (existingRegion?.transaction) {
    console.log(`Already seeded: document ${existing!.id}, transaction ${existingRegion.transaction.id}`);
    return;
  }
  const docId = existing?.id ?? crypto.randomUUID();
  const storageKey = existing?.storageKey ?? `companies/${company.id}/documents/${docId}/original.png`;
  const full = path.join(STORAGE_DIR, storageKey);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, bytes);

  const doc = existing ?? (await prisma.document.create({
    data: {
      id: docId,
      companyId: company.id,
      channel: "WEB",
      uploadedById: owner?.id ?? null,
      storageKey,
      filename: "g003-demo-receipt.png",
      mimeType: "image/png",
      sizeBytes: bytes.length,
      sha256,
      status: "PROCESSED",
      receivedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      retentionUntil: new Date(Date.now() + 4 * 365 * 24 * 3600 * 1000),
    },
  }));
  const region = existingRegion ?? (await prisma.documentRegion.create({ data: { documentId: doc.id, page: 1, bbox: { receiptIndex: 0 } } }));
  const hasRuns = (existingRegion?.runs.length ?? 0) > 0;

  // Two independent reads: they agree on everything except the date and the gallons.
  const fieldsA: Array<[string, string | null, number[] | null]> = [
    ["transaction_date", "2026-10-15", [0.08, 0.1, 0.4, 0.05]],
    ["vendor", "Fictional Fuel Stop", [0.08, 0.03, 0.6, 0.06]],
    ["state", "OH", [0.08, 0.18, 0.2, 0.05]],
    ["unit_number", "101", [0.55, 0.18, 0.3, 0.05]],
    ["receipt_total", "412.50", [0.5, 0.78, 0.4, 0.06]],
    ["line_items.0.quantity", "100.000", [0.08, 0.5, 0.3, 0.05]],
  ];
  const fieldsB: Array<[string, string | null, number[] | null]> = fieldsA.map(([n, v, b]) => [n, n === "transaction_date" ? "2026-10-16" : n === "line_items.0.quantity" ? "10.000" : v, b]);
  for (const [pass, modelId, fields] of [["A", "claude-opus-5-5", fieldsA], ["B", "claude-sonnet-5-5", fieldsB]] as const) {
    if (hasRuns) break;
    await prisma.extractionRun.create({
      data: {
        regionId: region.id,
        pass,
        modelId,
        promptVersion: pass === "A" ? "a-v1" : "b-v1",
        rawResponse: { demo: true },
        status: "DONE",
        costUsd: "0.01200",
        latencyMs: 4200,
        fields: { create: fields.map(([name, value, bbox]) => ({ name, rawText: value, value, confidence: "0.900", legibility: "CLEAR", bbox: bbox ?? undefined })) },
      },
    });
  }

  const tx = await prisma.transaction.create({
    data: {
      companyId: company.id,
      periodId: period?.id ?? null,
      regionId: region.id,
      vehicleId: vehicle?.id ?? null,
      type: "FUEL",
      date: null,
      time: "08:15",
      vendor: "Fictional Fuel Stop",
      sellerAddress: "1 Demo Rd, Columbus, OH 43004",
      state: "OH",
      stateSource: "printed",
      unitNumberRaw: "101",
      receiptTotal: "412.50",
      paymentMethod: "fuel_card",
      cardLast4: "4417",
      currency: "USD",
      status: "NEEDS_ATTENTION",
      corroboration: "TWO_PASS",
      provenance: {
        fields: {
          date: { rawText: "10/15/26", passA: "2026-10-15", passB: "2026-10-16", final: null, finalSource: null, agree: false },
          vendor: { rawText: "FICTIONAL FUEL STOP", passA: "Fictional Fuel Stop", passB: "Fictional Fuel Stop", final: "Fictional Fuel Stop", finalSource: "both", agree: true },
          state: { rawText: "OH", passA: "OH", passB: "OH", final: "OH", finalSource: "both", agree: true },
          unitNumber: { rawText: "UNIT 101", passA: "101", passB: "101", final: "101", finalSource: "both", agree: true },
          receiptTotal: { rawText: "412.50", passA: "412.50", passB: "412.50", final: "412.50", finalSource: "both", agree: true },
          currency: { rawText: null, passA: "USD", passB: "USD", final: "USD", finalSource: "both", agree: true },
          "line_items.0.quantity": { rawText: "100.000", passA: "100.000", passB: "10.000", final: null, finalSource: null, agree: false },
          "line_items.0.amount": { rawText: "412.50", passA: "412.50", passB: "412.50", final: "412.50", finalSource: "both", agree: true },
        },
        disagreements: [
          { field: "transaction_date", passA: "2026-10-15", passB: "2026-10-16", material: true },
          { field: "line_items.0.quantity", passA: "100.000", passB: "10.000", material: true },
        ],
        passA: { model: "claude-opus-5-5", promptVersion: "a-v1" },
        passB: { model: "claude-sonnet-5-5", promptVersion: "b-v1" },
      },
      lines: { create: [{ descriptionRaw: "DIESEL #2", category: "MOTOR_FUEL", fuelType: "diesel", quantity: null, unit: "gal", unitPrice: "4.1250", amount: "412.50" }] },
    },
  });
  await prisma.issue.createMany({
    data: [
      { companyId: company.id, transactionId: tx.id, documentId: doc.id, code: "V010", ruleVersion: "V010-v1", severity: "ERROR", message: "The two reads disagree on the date (2026-10-15 vs 2026-10-16)", fields: ["transaction_date"], evidence: { passA: "2026-10-15", passB: "2026-10-16" } },
      { companyId: company.id, transactionId: tx.id, documentId: doc.id, code: "V010", ruleVersion: "V010-v1", severity: "ERROR", message: "The two reads disagree on the gallons (100.000 vs 10.000)", fields: ["line_items.0.quantity"], evidence: { passA: "100.000", passB: "10.000" } },
      { companyId: company.id, transactionId: tx.id, documentId: doc.id, code: "F003", ruleVersion: "F003-v1", severity: "WARNING", message: "Gallons × unit price does not match the fuel amount", fields: ["line_items.0.quantity"], evidence: {} },
    ],
  });
  console.log(`Seeded review demo: document ${doc.id}, transaction ${tx.id} for ${company.legalName}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
