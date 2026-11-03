/**
 * Golden-set evaluator. Runs an Extractor over every fixture, normalizes the
 * model output and the expected JSON the same way, and reports field
 * accuracy. The report is the only place accuracy numbers may come from
 * (CLAUDE.md: never publish numbers not measured on the golden set).
 *
 *   npm run golden:evaluate            — live run; needs ANTHROPIC_API_KEY and EXTRACTION_MODEL_A/B
 *   (tests use FakeExtractor and the expected files as answers)
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { goldenExpected, type GoldenExpected } from "./contract";
import { type Extractor, type ExtractableMime, estimateCostUsd } from "./client";
import { GOLDEN_DIR } from "./golden/generate";
import { normalizeReceipt, type NormalizedReceipt } from "./normalize";
import { type PassPrompt } from "./prompts";

export const MATERIAL_EVAL_FIELDS = ["date", "vendor", "state", "receiptTotal", "currency", "unitNumber"] as const;
type EvalField = (typeof MATERIAL_EVAL_FIELDS)[number];

export interface FieldResult {
  field: string;
  expected: string | null;
  actual: string | null;
  correct: boolean;
  /** expected non-null but actual null: honest miss (preferred over a wrong value) */
  missed: boolean;
  /** actual non-null and different from expected: the dangerous kind */
  wrong: boolean;
}

export interface FixtureResult {
  id: string;
  variant: string;
  file: string;
  receiptsExpected: number;
  receiptsActual: number;
  fields: FieldResult[];
  allMaterialCorrect: boolean;
  error: string | null;
  latencyMs: number;
  costUsd: string;
}

export interface EvalReport {
  model: string;
  promptVersion: string;
  pass: "A" | "B";
  ranAt: string;
  fixtures: FixtureResult[];
  summary: {
    fixtures: number;
    receiptsMatched: number;
    fieldAccuracy: Record<string, { correct: number; total: number; percent: string }>;
    materialAccuracyPercent: string;
    wrongValues: number;
    honestMisses: number;
    touchlessPercent: string;
    totalCostUsd: string;
    errors: number;
  };
}

function pct(n: number, d: number): string {
  return d === 0 ? "0.0" : ((n / d) * 100).toFixed(1);
}

function cmp(field: EvalField, e: string | null, a: string | null): boolean {
  if (e === null || a === null) return e === a;
  if (field === "receiptTotal") return Number(e) === Number(a);
  return e.trim().toLowerCase() === a.trim().toLowerCase();
}

export function compareReceipt(expected: NormalizedReceipt, actual: NormalizedReceipt | null): FieldResult[] {
  const out: FieldResult[] = [];
  for (const field of MATERIAL_EVAL_FIELDS) {
    const e = expected[field];
    const a = actual ? actual[field] : null;
    const correct = cmp(field, e, a);
    out.push({ field, expected: e, actual: a, correct, missed: !correct && e !== null && a === null, wrong: !correct && a !== null });
  }
  // Motor-fuel gallons: sum of MOTOR_FUEL quantities (string compare of 3dp numbers).
  const gal = (r: NormalizedReceipt | null) => (r ? r.lines.filter((l) => l.category === "MOTOR_FUEL").map((l) => l.quantity).filter((q): q is string => q !== null) : []);
  const eg = gal(expected);
  const ag = gal(actual);
  const e = eg.length ? eg.reduce((s, q) => s + Number(q), 0).toFixed(3) : null;
  const a = ag.length ? ag.reduce((s, q) => s + Number(q), 0).toFixed(3) : null;
  const correct = e === a;
  out.push({ field: "motorFuelGallons", expected: e, actual: a, correct, missed: !correct && e !== null && a === null, wrong: !correct && a !== null });
  return out;
}

export function mimeFor(file: string): ExtractableMime {
  return file.endsWith(".pdf") ? "application/pdf" : "image/png";
}

export async function evaluateGolden(extractor: Extractor, opts: { model: string; prompt: PassPrompt; dir?: string; only?: string[] }): Promise<EvalReport> {
  const dir = opts.dir ?? GOLDEN_DIR;
  const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8")) as { fixtures: Array<{ id: string; variant: string; file: string }> };
  const fixtures: FixtureResult[] = [];
  let totalCost = 0n;

  for (const entry of manifest.fixtures) {
    if (opts.only && !opts.only.includes(entry.id)) continue;
    const expected = goldenExpected.parse(JSON.parse(readFileSync(path.join(dir, `${entry.id}.expected.json`), "utf8"))) as GoldenExpected;
    const bytes = readFileSync(path.join(dir, entry.file));
    const out = await extractor.extract({ bytes, mimeType: mimeFor(entry.file), prompt: opts.prompt, model: opts.model });
    const cost = estimateCostUsd(opts.model, out.usage).costUsd;
    totalCost += BigInt(cost.replace(".", ""));
    const expectedNorm = expected.receipts.map(normalizeReceipt);
    const actualNorm = out.result ? out.result.receipts.map(normalizeReceipt) : [];
    const fields: FieldResult[] = [];
    expectedNorm.forEach((er, i) => fields.push(...compareReceipt(er, actualNorm[i] ?? null)));
    fixtures.push({
      id: entry.id,
      variant: entry.variant,
      file: entry.file,
      receiptsExpected: expectedNorm.length,
      receiptsActual: actualNorm.length,
      fields,
      allMaterialCorrect: fields.every((f) => f.correct) && expectedNorm.length === actualNorm.length,
      error: out.error,
      latencyMs: out.latencyMs,
      costUsd: cost,
    });
  }

  const fieldAccuracy: EvalReport["summary"]["fieldAccuracy"] = {};
  let correct = 0;
  let total = 0;
  let wrong = 0;
  let missed = 0;
  for (const f of fixtures) {
    for (const r of f.fields) {
      const acc = (fieldAccuracy[r.field] ??= { correct: 0, total: 0, percent: "0.0" });
      acc.total++;
      total++;
      if (r.correct) {
        acc.correct++;
        correct++;
      }
      if (r.wrong) wrong++;
      if (r.missed) missed++;
    }
  }
  for (const acc of Object.values(fieldAccuracy)) acc.percent = pct(acc.correct, acc.total);
  const totalStr = totalCost.toString().padStart(6, "0");
  return {
    model: opts.model,
    promptVersion: opts.prompt.promptVersion,
    pass: opts.prompt.pass,
    ranAt: new Date().toISOString(),
    fixtures,
    summary: {
      fixtures: fixtures.length,
      receiptsMatched: fixtures.filter((f) => f.receiptsExpected === f.receiptsActual).length,
      fieldAccuracy,
      materialAccuracyPercent: pct(correct, total),
      wrongValues: wrong,
      honestMisses: missed,
      touchlessPercent: pct(fixtures.filter((f) => f.allMaterialCorrect).length, fixtures.length),
      totalCostUsd: `${totalStr.slice(0, -5)}.${totalStr.slice(-5)}`,
      errors: fixtures.filter((f) => f.error).length,
    },
  };
}

export function reportFilename(report: EvalReport): string {
  return `report-${report.pass}-${report.model}-${report.promptVersion}.json`;
}

export function writeReport(report: EvalReport, dir = GOLDEN_DIR): string {
  const file = path.join(dir, reportFilename(report));
  writeFileSync(file, JSON.stringify(report, null, 2) + "\n");
  return file;
}

/** Answers for the FakeExtractor: every fixture's expected JSON keyed by file hash. */
export function goldenAnswers(dir = GOLDEN_DIR): Map<string, GoldenExpected> {
  const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8")) as { fixtures: Array<{ id: string; file: string }> };
  const map = new Map<string, GoldenExpected>();
  for (const f of manifest.fixtures) {
    const bytes = readFileSync(path.join(dir, f.file));
    const sha = createHash("sha256").update(bytes).digest("hex");
    // Byte-identical duplicates (g014 = g001) share one answer: the first fixture's.
    if (!map.has(sha)) map.set(sha, goldenExpected.parse(JSON.parse(readFileSync(path.join(dir, `${f.id}.expected.json`), "utf8"))));
  }
  return map;
}
