/**
 * Extraction pipeline jobs:
 *   preprocess → extract-a ┐
 *                extract-b ┴→ reconcile → Transaction + lines + Issues
 *
 * Idempotency: one Job per `<documentId>:<step>:<version>`; ExtractionRun is
 * unique per (region, pass, model, prompt version); Transaction is unique per
 * region. Re-running any step with the same versions changes nothing.
 * The LLM only transcribes; normalization, reconciliation, rules and status
 * are deterministic code from @tbo/extraction and @tbo/core.
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { DEFAULT_SETTINGS, evaluateStatus, quarterOf, retentionUntil, type RuleContext, type RuleSettings, type RuleTransaction, runRules } from "@tbo/core";
import {
  type Extractor,
  type ExtractionOutput,
  EXTRACTABLE_MIMES,
  estimateCostUsd,
  normalizeReceipt,
  type NormalizedReceipt,
  PASS_A,
  PASS_B,
  type PassPrompt,
  type Receipt,
  reconcile,
} from "@tbo/extraction";
import type { Env } from "../config/env";
import type { Storage } from "../storage";
import { type ClaimedJob, enqueue, type Processor } from "./queue";

export const EXTRACT_A_STEP = "extract-a";
export const EXTRACT_B_STEP = "extract-b";
export const RECONCILE_STEP = "reconcile";
export const PIPELINE_VERSION = "v1";

export interface ExtractionDeps {
  env: Env;
  storage: Storage;
  extractor: Extractor;
  now?: () => Date;
}

export class BudgetExceededError extends Error {
  constructor(spent: string, budget: number) {
    super(`AI budget exhausted for this month: spent $${spent} of $${budget}. Raise AI_MONTHLY_BUDGET_USD or wait for next month.`);
    this.name = "BudgetExceededError";
  }
}

/** Sum of ExtractionRun.costUsd for the calendar month of `now`, as a decimal string. */
export async function monthSpendUsd(prisma: PrismaClient, now = new Date()): Promise<string> {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const agg = await prisma.extractionRun.aggregate({ _sum: { costUsd: true }, where: { createdAt: { gte: start } } });
  return agg._sum.costUsd?.toFixed(5) ?? "0.00000";
}

async function enqueueExtraction(prisma: PrismaClient, env: Env, companyId: string, documentId: string): Promise<void> {
  await enqueue(prisma, { step: EXTRACT_A_STEP, version: PIPELINE_VERSION, companyId, payload: { documentId } });
  if (!env.EXTRACTION_SKIP_PASS_B) await enqueue(prisma, { step: EXTRACT_B_STEP, version: PIPELINE_VERSION, companyId, payload: { documentId } });
}

/** preprocess: route extractable documents into the pipeline; others are done. */
export function makePreprocess(env: Env): Processor {
  return async (job: ClaimedJob, prisma: PrismaClient) => {
    const documentId = String(job.payload.documentId ?? "");
    const doc = await prisma.document.findUnique({ where: { id: documentId }, select: { id: true, status: true, companyId: true, mimeType: true } });
    if (!doc) throw new Error(`preprocess: document ${documentId} not found`);
    if (doc.status === "PROCESSED" || doc.status === "PROCESSING") return;
    if (!EXTRACTABLE_MIMES.has(doc.mimeType)) {
      // Spreadsheets/CSVs are imports, not receipts.
      await prisma.document.update({ where: { id: doc.id }, data: { status: "PROCESSED" } });
      return;
    }
    await prisma.document.update({ where: { id: doc.id }, data: { status: "PROCESSING" } });
    await enqueueExtraction(prisma, env, doc.companyId, doc.id);
  };
}

function pageFromHint(hint: string | null, index: number): number {
  const m = hint ? /page\s+(\d+)/i.exec(hint) : null;
  return m ? Number(m[1]) : index + 1;
}

/** One pass over one document: call the model, persist regions, runs and fields, then queue reconcile. */
export function makeExtract(pass: PassPrompt, deps: ExtractionDeps): Processor {
  return async (job: ClaimedJob, prisma: PrismaClient) => {
    const documentId = String(job.payload.documentId ?? "");
    const doc = await prisma.document.findUnique({ where: { id: documentId } });
    if (!doc) throw new Error(`${pass.pass}: document ${documentId} not found`);
    const model = pass.pass === "A" ? deps.env.EXTRACTION_MODEL_A : deps.env.EXTRACTION_MODEL_B;
    const promptVersion = pass.pass === "A" ? deps.env.EXTRACTION_PROMPT_VERSION_A : deps.env.EXTRACTION_PROMPT_VERSION_B;

    // Idempotent: a finished run for this pass/model/prompt already exists → just make sure reconcile is queued.
    const existing = await prisma.extractionRun.findFirst({ where: { region: { documentId }, pass: pass.pass, modelId: model, promptVersion, status: "DONE" }, select: { id: true } });
    if (existing) {
      await enqueue(prisma, { step: RECONCILE_STEP, version: PIPELINE_VERSION, companyId: doc.companyId, payload: { documentId } });
      return;
    }

    const spent = await monthSpendUsd(prisma, deps.now?.());
    if (Number(spent) >= deps.env.AI_MONTHLY_BUDGET_USD) {
      await prisma.document.update({ where: { id: doc.id }, data: { status: "FAILED" } });
      throw new BudgetExceededError(spent, deps.env.AI_MONTHLY_BUDGET_USD);
    }

    const bytes = await deps.storage.get(doc.storageKey);
    const out: ExtractionOutput = await deps.extractor.extract({ bytes, mimeType: doc.mimeType as never, prompt: { ...pass, promptVersion }, model, effort: deps.env.EXTRACTION_EFFORT });
    const { costUsd } = estimateCostUsd(model, out.usage);
    const receipts: Receipt[] = out.result?.receipts ?? [];

    await prisma.$transaction(async (tx) => {
      // Regions: one per receipt returned, matched by index to regions created by the other pass.
      const regions = await tx.documentRegion.findMany({ where: { documentId }, orderBy: { page: "asc" } });
      const count = Math.max(receipts.length, regions.length, 1);
      for (let i = 0; i < count; i++) {
        const receipt = receipts[i] ?? null;
        let region = regions[i];
        if (!region) {
          region = await tx.documentRegion.create({ data: { documentId, page: pageFromHint(receipt?.region_hint ?? null, i), bbox: { receiptIndex: i, regionHint: receipt?.region_hint ?? null } as never } });
        }
        const run = await tx.extractionRun.upsert({
          where: { regionId_pass_modelId_promptVersion: { regionId: region.id, pass: pass.pass, modelId: model, promptVersion } },
          update: {
            rawResponse: (receipt ?? { error: out.error }) as never,
            inputTokens: out.usage.inputTokens,
            outputTokens: out.usage.outputTokens,
            costUsd: i === 0 ? costUsd : "0.00000",
            latencyMs: out.latencyMs,
            status: receipt ? "DONE" : "FAILED",
          },
          create: {
            regionId: region.id,
            pass: pass.pass,
            modelId: model,
            promptVersion,
            rawResponse: (receipt ?? { error: out.error }) as never,
            inputTokens: out.usage.inputTokens,
            outputTokens: out.usage.outputTokens,
            costUsd: i === 0 ? costUsd : "0.00000", // the call is billed once; attribute it to the first region
            latencyMs: out.latencyMs,
            status: receipt ? "DONE" : "FAILED",
          },
        });
        if (receipt) {
          const n = normalizeReceipt(receipt);
          await tx.extractedField.deleteMany({ where: { runId: run.id } }); // derived rows of this very run, replaced on re-run
          const fields: Prisma.ExtractedFieldCreateManyInput[] = Object.entries(receipt.fields).map(([name, f]) => ({
            runId: run.id,
            name,
            rawText: f.raw_text,
            value: f.value === null || f.value === undefined ? null : String(f.value),
            legibility: f.legibility.toUpperCase() as never,
          }));
          n.lines.forEach((l, li) => {
            for (const k of ["quantity", "unitPrice", "amount"] as const) {
              fields.push({ runId: run.id, name: `line_items.${li}.${k}`, rawText: l.descriptionRaw, value: l[k], legibility: l.legibility.toUpperCase() as never });
            }
          });
          if (fields.length) await tx.extractedField.createMany({ data: fields });
        }
      }
    });

    if (out.error && receipts.length === 0) {
      // Model declined or returned nothing usable; reconcile decides the document status once the other pass is in.
      console.warn(`extract ${pass.pass} ${documentId}: ${out.error}`);
    }
    await enqueue(prisma, { step: RECONCILE_STEP, version: PIPELINE_VERSION, companyId: doc.companyId, payload: { documentId } });
  };
}

async function latestRun(prisma: PrismaClient, regionId: string, pass: "A" | "B", model: string, promptVersion: string) {
  return prisma.extractionRun.findUnique({ where: { regionId_pass_modelId_promptVersion: { regionId, pass, modelId: model, promptVersion } } });
}

async function loadSettings(prisma: PrismaClient, companyId: string, env: Env): Promise<RuleSettings> {
  const rows = await prisma.setting.findMany({ where: { OR: [{ companyId: null }, { companyId }] } });
  const get = (key: string) => rows.find((r) => r.companyId === companyId && r.key === key)?.value ?? rows.find((r) => r.companyId === null && r.key === key)?.value;
  const tol = (get("arithmetic_tolerance") as { amountUsd?: string; ratio?: string } | undefined) ?? {};
  const mpg = (get("mpg_band") as { min?: string; max?: string } | undefined) ?? {};
  return {
    ...DEFAULT_SETTINGS,
    amountToleranceUsd: tol.amountUsd ?? DEFAULT_SETTINGS.amountToleranceUsd,
    ratioTolerance: tol.ratio ?? DEFAULT_SETTINGS.ratioTolerance,
    defaultTankCapacityGal: (get("default_tank_capacity_gal") as string | undefined) ?? DEFAULT_SETTINGS.defaultTankCapacityGal,
    mpgBandMin: mpg.min ?? env.MPG_BAND_MIN,
    mpgBandMax: mpg.max ?? env.MPG_BAND_MAX,
  };
}

/** Find or create the QUARTER period containing a date. */
async function periodFor(prisma: PrismaClient, companyId: string, date: string | null) {
  if (!date) return null;
  const q = quarterOf(date);
  return prisma.reportingPeriod.upsert({
    where: { companyId_type_startDate: { companyId, type: "QUARTER", startDate: q.start } },
    update: {},
    create: { companyId, type: "QUARTER", startDate: q.start, endDate: q.end },
  });
}

/** Pass values keyed by contract field names, as the V010 rule compares them. */
function contractView(n: NormalizedReceipt): Record<string, unknown> {
  const out: Record<string, unknown> = {
    transaction_date: n.date,
    time: n.time,
    vendor: n.vendor,
    seller_address: n.sellerAddress,
    state: n.state,
    unit_number: n.unitNumber,
    odometer: n.odometer,
    purchaser_name: n.purchaserName,
    payment_method: n.paymentMethod,
    card_last4: n.cardLast4,
    receipt_total: n.receiptTotal,
    currency: n.currency,
  };
  n.lines.forEach((l, i) => {
    out[`line_items.${i}.quantity`] = l.quantity;
    out[`line_items.${i}.unit_price`] = l.unitPrice;
    out[`line_items.${i}.amount`] = l.amount;
    out[`line_items.${i}.category`] = l.category;
  });
  return out;
}

function toRuleTransaction(final: NormalizedReceipt, unitSource: RuleTransaction["unitSource"], passValues: RuleTransaction["passValues"]): RuleTransaction {
  return {
    date: final.date,
    vendor: final.vendor,
    sellerAddress: final.sellerAddress,
    state: final.state,
    stateSource: final.state ? "printed" : null,
    unitNumber: final.unitNumber,
    unitSource: final.unitNumber ? unitSource : null,
    purchaserName: final.purchaserName,
    receiptTotal: final.receiptTotal,
    currency: final.currency,
    odometer: final.odometer,
    lines: final.lines.map((l) => ({ category: l.category, fuelType: l.fuelType, quantity: l.quantity, unit: l.unit, unitPrice: l.unitPrice, amount: l.amount, legibility: l.legibility })),
    fieldLegibility: final.legibility,
    passValues,
    imageQualityScore: null,
  };
}

/** reconcile: combine passes per region, build the transaction, run the rules, set status. */
export function makeReconcile(deps: ExtractionDeps): Processor {
  return async (job: ClaimedJob, prisma: PrismaClient) => {
    const documentId = String(job.payload.documentId ?? "");
    const doc = await prisma.document.findUnique({ where: { id: documentId }, include: { regions: { orderBy: { page: "asc" } } } });
    if (!doc) throw new Error(`reconcile: document ${documentId} not found`);
    const env = deps.env;

    // Wait for both passes unless B is skipped or has given up.
    const bJob = env.EXTRACTION_SKIP_PASS_B ? null : await prisma.job.findUnique({ where: { idempotencyKey: `${documentId}:${EXTRACT_B_STEP}:${PIPELINE_VERSION}` } });
    const aJob = await prisma.job.findUnique({ where: { idempotencyKey: `${documentId}:${EXTRACT_A_STEP}:${PIPELINE_VERSION}` } });
    const pending = (j: { status: string } | null) => j && (j.status === "QUEUED" || j.status === "RUNNING");
    if (pending(aJob) || pending(bJob)) throw new Error("reconcile: waiting for extraction passes to finish (will retry)");

    if (doc.regions.length === 0) {
      await prisma.document.update({ where: { id: documentId }, data: { status: aJob?.status === "FAILED" ? "FAILED" : "UNREADABLE" } });
      return;
    }

    const company = await prisma.company.findUniqueOrThrow({ where: { id: doc.companyId }, select: { id: true } });
    const vehicles = await prisma.vehicle.findMany({ where: { companyId: company.id }, select: { id: true, unitNumber: true, tankCapacityGal: true } });
    const jurisdictions = new Set((await prisma.jurisdiction.findMany({ where: { iftaMember: true }, select: { code: true } })).map((j) => j.code));
    const settings = await loadSettings(prisma, company.id, env);
    let anyTransaction = false;

    for (const region of doc.regions) {
      const runA = await latestRun(prisma, region.id, "A", env.EXTRACTION_MODEL_A, env.EXTRACTION_PROMPT_VERSION_A);
      const runB = env.EXTRACTION_SKIP_PASS_B ? null : await latestRun(prisma, region.id, "B", env.EXTRACTION_MODEL_B, env.EXTRACTION_PROMPT_VERSION_B);
      const receiptA = runA?.status === "DONE" ? (runA.rawResponse as unknown as Receipt) : null;
      const receiptB = runB?.status === "DONE" ? (runB.rawResponse as unknown as Receipt) : null;
      const primary = receiptA ?? receiptB;
      if (!primary) continue; // nothing readable for this region

      const existing = await prisma.transaction.findUnique({ where: { regionId: region.id }, include: { _count: { select: { lines: true } } } });
      const edits = existing ? await prisma.fieldEdit.count({ where: { entity: "Transaction", entityId: existing.id } }) : 0;
      if (existing && edits > 0) {
        anyTransaction = true;
        continue; // a human corrected this transaction; never overwrite their work
      }

      const normA = receiptA ? normalizeReceipt(receiptA) : null;
      const normB = receiptB ? normalizeReceipt(receiptB) : null;
      const rec = normA ? reconcile(normA, normB) : reconcile(normB!, null);
      const final = rec.final;

      const vehicle = final.unitNumber ? vehicles.find((v) => v.unitNumber.toLowerCase() === final.unitNumber!.toLowerCase()) ?? null : null;
      const period = await periodFor(prisma, company.id, final.date);
      const similar = await prisma.transaction.findMany({
        where: { companyId: company.id, vendor: final.vendor ?? undefined, date: final.date ? new Date(`${final.date}T00:00:00Z`) : undefined, NOT: existing ? { id: existing.id } : undefined },
        include: { lines: { where: { category: "MOTOR_FUEL" } } },
        take: 20,
      });
      const ctx: RuleContext = {
        period: period ? { start: period.startDate.toISOString().slice(0, 10), end: period.endDate.toISOString().slice(0, 10) } : null,
        jurisdictions,
        vehicle: vehicle ? { tankCapacityGal: vehicle.tankCapacityGal?.toString() ?? null } : null,
        settings,
        similarTransactions: final.vendor && final.date
          ? similar.map((s) => ({
              id: s.id,
              vendor: s.vendor,
              sellerAddress: s.sellerAddress,
              date: s.date ? s.date.toISOString().slice(0, 10) : null,
              motorFuelGallons: s.lines.length ? s.lines.reduce((acc, l) => acc + Number(l.quantity ?? 0), 0).toFixed(3) : null,
              receiptTotal: s.receiptTotal?.toString() ?? null,
            }))
          : [],
        mileage: null,
      };
      const passValues = normA && normB ? { a: contractView(normA), b: contractView(normB) } : null;
      const ruleTx = toRuleTransaction(final, "receipt", passValues);
      const issues = runRules(ruleTx, ctx);
      const status = evaluateStatus(issues, ruleTx);
      const hasFuel = final.lines.some((l) => l.category === "MOTOR_FUEL" || l.category === "REEFER_FUEL" || l.category === "DEF");
      const type = final.lines.some((l) => l.category === "CREDIT") && !hasFuel ? "CREDIT" : hasFuel ? "FUEL" : final.lines.length ? "EXPENSE" : "UNKNOWN";
      const motorGal = final.lines.filter((l) => l.category === "MOTOR_FUEL" && l.quantity && l.unit !== "L").reduce((acc, l) => acc + Number(l.quantity), 0);

      const data = {
        companyId: company.id,
        periodId: period?.id ?? null,
        regionId: region.id,
        vehicleId: vehicle?.id ?? null,
        type: type as never,
        date: final.date ? new Date(`${final.date}T00:00:00Z`) : null,
        time: final.time,
        vendor: final.vendor,
        sellerAddress: final.sellerAddress,
        state: final.state,
        stateSource: final.state ? "printed" : null,
        unitNumberRaw: final.unitNumber,
        odometer: final.odometer,
        paymentMethod: final.paymentMethod,
        cardLast4: final.cardLast4,
        receiptTotal: final.receiptTotal,
        currency: final.currency ?? "USD",
        iftaTaxableGallons: final.currency === "CAD" || final.lines.some((l) => l.unit === "L") ? null : motorGal.toFixed(3),
        status: status as never,
        corroboration: rec.corroboration as never,
        provenance: { fields: rec.provenance, disagreements: rec.disagreements, passA: runA ? { model: runA.modelId, promptVersion: runA.promptVersion } : null, passB: runB ? { model: runB.modelId, promptVersion: runB.promptVersion } : null } as never,
        verifiedAt: status === "VERIFIED" ? new Date() : null,
        verifiedBy: null,
      };

      await prisma.$transaction(async (tx) => {
        const transaction = existing ? await tx.transaction.update({ where: { id: existing.id }, data }) : await tx.transaction.create({ data });
        // Lines are derived from this run; replace them (the originals live in ExtractedField and rawResponse).
        await tx.transactionLine.deleteMany({ where: { transactionId: transaction.id } });
        if (final.lines.length) {
          await tx.transactionLine.createMany({
            data: final.lines.map((l) => ({ transactionId: transaction.id, descriptionRaw: l.descriptionRaw, category: l.category as never, fuelType: l.fuelType, quantity: l.quantity, unit: l.unit, unitPrice: l.unitPrice, amount: l.amount })),
          });
        }
        // Issues: keep human-handled ones; refresh OPEN rule issues to the current set.
        const open = await tx.issue.findMany({ where: { transactionId: transaction.id, status: "OPEN" } });
        const produced = new Set(issues.map((i) => i.code));
        for (const o of open) {
          if (!produced.has(o.code)) await tx.issue.update({ where: { id: o.id }, data: { status: "RESOLVED", resolutionNote: "No longer flagged after re-extraction", resolvedAt: new Date() } });
        }
        for (const i of issues) {
          const match = open.find((o) => o.code === i.code);
          if (match) await tx.issue.update({ where: { id: match.id }, data: { message: i.message, fields: i.fields, evidence: i.evidence as never, ruleVersion: i.ruleVersion } });
          else await tx.issue.create({ data: { companyId: company.id, transactionId: transaction.id, documentId, code: i.code, ruleVersion: i.ruleVersion, severity: i.severity, message: i.message, fields: i.fields, evidence: i.evidence as never } });
        }
      });
      anyTransaction = true;
    }

    await prisma.document.update({ where: { id: documentId }, data: { status: anyTransaction ? "PROCESSED" : "UNREADABLE" } });
    void retentionUntil; // retention is set at upload; nothing to recompute here yet
  };
}

export function extractionProcessors(deps: ExtractionDeps): Record<string, Processor> {
  return {
    [EXTRACT_A_STEP]: makeExtract(PASS_A, deps),
    [EXTRACT_B_STEP]: makeExtract(PASS_B, deps),
    [RECONCILE_STEP]: makeReconcile(deps),
  };
}
