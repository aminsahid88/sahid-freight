/**
 * Live golden-set evaluation: npm run golden:evaluate [-- A|B] [fixtureId ...]
 * Needs ANTHROPIC_API_KEY and EXTRACTION_MODEL_A/B in the environment
 * (load apps/api/.env.local with dotenv-cli). Writes golden/report-*.json.
 */
import { AnthropicExtractor } from "../client";
import { evaluateGolden, writeReport } from "../evaluate";
import { PASS_A, PASS_B } from "../prompts";

async function main() {
  const [passArg = "A", ...only] = process.argv.slice(2);
  const pass = passArg.toUpperCase() === "B" ? PASS_B : PASS_A;
  const model = pass.pass === "A" ? process.env.EXTRACTION_MODEL_A : process.env.EXTRACTION_MODEL_B;
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set (put it in apps/api/.env.local, never in chat or git)");
  if (!model) throw new Error(`EXTRACTION_MODEL_${pass.pass} is not set`);
  const report = await evaluateGolden(new AnthropicExtractor(), { model, prompt: pass, only: only.length ? only : undefined });
  const file = writeReport(report);
  const s = report.summary;
  console.log(`pass ${pass.pass} ${model} ${pass.promptVersion}: material accuracy ${s.materialAccuracyPercent}%, touchless ${s.touchlessPercent}%, wrong ${s.wrongValues}, misses ${s.honestMisses}, errors ${s.errors}, cost $${s.totalCostUsd}`);
  for (const [field, acc] of Object.entries(s.fieldAccuracy)) console.log(`  ${field.padEnd(18)} ${acc.percent}% (${acc.correct}/${acc.total})`);
  console.log(`report: ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
