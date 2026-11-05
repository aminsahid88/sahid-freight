/**
 * The job-queue loop and its processors, shared by the standalone worker
 * process (src/worker.ts) and the API when `WORKER_IN_PROCESS=true` (one
 * Railway service runs both; fine for a small fleet, split when load grows).
 *
 * Pipeline: preprocess → extract-a / extract-b → reconcile.
 */
import type { PrismaClient } from "@prisma/client";
import { AnthropicExtractor, type Extractor } from "@tbo/extraction";
import type { Env } from "../config/env";
import type { Storage } from "../storage";
import { extractionProcessors, makePreprocess } from "./extraction";
import { PREPROCESS_STEP } from "./processors/preprocess";
import { type Processor, runOne } from "./queue";

/** Model-backed processors need a key; without one only preprocess runs and documents wait in PROCESSING. */
export function buildProcessors(env: Env, storage: Storage, extractor: Extractor | null): Record<string, Processor> {
  const base: Record<string, Processor> = { [PREPROCESS_STEP]: makePreprocess(env) };
  if (!extractor) return base;
  return { ...base, ...extractionProcessors({ env, storage, extractor }) };
}

export function buildExtractor(env: Env): Extractor | null {
  if (!env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY unset: extraction jobs will not run; uploaded receipts stay in PROCESSING");
    return null;
  }
  return new AnthropicExtractor({ apiKey: env.ANTHROPIC_API_KEY });
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

/** Start the loop and stop it on SIGINT/SIGTERM. Returns the controller for tests. */
export function startWorker(prisma: PrismaClient, env: Env, storage: Storage): AbortController {
  const controller = new AbortController();
  for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => controller.abort());
  workerLoop(prisma, buildProcessors(env, storage, buildExtractor(env)), env.WORKER_POLL_MS, controller.signal).catch((err) => {
    console.error("worker crashed:", err);
    process.exitCode = 1;
  });
  return controller;
}
