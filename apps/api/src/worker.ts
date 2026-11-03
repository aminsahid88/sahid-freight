/**
 * Background worker entrypoint. Runs as its own process (Railway service
 * `worker`, or `npm run worker:local`). Polls the Postgres job queue and runs
 * registered processors; safe to run several replicas.
 *
 * Pipeline: preprocess → extract-a / extract-b → reconcile.
 */
import { PrismaClient } from "@prisma/client";
import { AnthropicExtractor, type Extractor } from "@tbo/extraction";
import { type Env, getEnv } from "./config/env";
import { extractionProcessors, makePreprocess } from "./jobs/extraction";
import { PREPROCESS_STEP } from "./jobs/processors/preprocess";
import { type Processor, runOne } from "./jobs/queue";
import { createStorage, type Storage } from "./storage";

/** Model-backed processors need a key; without one only preprocess runs and documents wait in PROCESSING. */
export function buildProcessors(env: Env, storage: Storage, extractor: Extractor | null): Record<string, Processor> {
  const base: Record<string, Processor> = { [PREPROCESS_STEP]: makePreprocess(env) };
  if (!extractor) return base;
  return { ...base, ...extractionProcessors({ env, storage, extractor }) };
}

export async function workerLoop(prisma: PrismaClient, processors: Record<string, Processor>, pollMs: number, signal: AbortSignal): Promise<void> {
  console.log(`Worker started; steps: ${Object.keys(processors).join(", ")}; poll ${pollMs}ms`);
  while (!signal.aborted) {
    try {
      const result = await runOne(prisma, processors);
      if (result.ran) {
        console.log(`job ${result.job.idempotencyKey} -> ${result.status}${result.status !== "DONE" ? ` (attempt ${result.job.attempts})` : ""}`);
        continue; // drain without sleeping while there is work
      }
    } catch (err) {
      console.error("worker loop error:", err);
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  console.log("Worker stopped");
}

if (require.main === module) {
  const env = getEnv();
  const prisma = new PrismaClient();
  const storage = createStorage(env);
  const extractor = env.ANTHROPIC_API_KEY ? new AnthropicExtractor({ apiKey: env.ANTHROPIC_API_KEY }) : null;
  if (!extractor) console.warn("ANTHROPIC_API_KEY unset: extraction jobs will not run; uploaded receipts stay in PROCESSING");
  const controller = new AbortController();
  for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => controller.abort());
  workerLoop(prisma, buildProcessors(env, storage, extractor), env.WORKER_POLL_MS, controller.signal)
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
