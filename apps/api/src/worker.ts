/**
 * Background worker entrypoint. Runs as its own process (Railway service
 * `worker`, or `npm run worker:local`). Polls the Postgres job queue and runs
 * registered processors; safe to run several replicas.
 */
import { PrismaClient } from "@prisma/client";
import { getEnv } from "./config/env";
import { PREPROCESS_STEP, preprocess } from "./jobs/processors/preprocess";
import { type Processor, runOne } from "./jobs/queue";

export const processors: Record<string, Processor> = {
  [PREPROCESS_STEP]: preprocess,
};

export async function workerLoop(prisma: PrismaClient, pollMs: number, signal: AbortSignal): Promise<void> {
  console.log(`Worker started; steps: ${Object.keys(processors).join(", ")}; poll ${pollMs}ms`);
  while (!signal.aborted) {
    try {
      const result = await runOne(prisma, processors);
      if (result.ran) {
        console.log(`job ${result.job.idempotencyKey} -> ${result.status}`);
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
  const controller = new AbortController();
  for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => controller.abort());
  workerLoop(prisma, env.WORKER_POLL_MS, controller.signal)
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
