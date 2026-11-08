/**
 * Background worker entrypoint. Runs as its own process (Railway service
 * `worker`, or `npm run worker:local`). Polls the Postgres job queue and runs
 * registered processors; safe to run several replicas. The API can run the
 * same loop in-process with `WORKER_IN_PROCESS=true` (see jobs/worker-core).
 */
import { PrismaClient } from "@prisma/client";
import { getEnv } from "./config/env";
import { createStorage } from "./storage";
import { buildExtractor, buildProcessors, startWorker, workerLoop } from "./jobs/worker-core";
import { startHealthServer } from "./jobs/health";

export { buildExtractor, buildProcessors, workerLoop };

if (require.main === module) {
  const env = getEnv();
  const prisma = new PrismaClient();
  const storage = createStorage(env);
  console.log(`Worker storage: ${storage.driver} (${storage.location})`);
  const controller = startWorker(prisma, env, storage);
  // Liveness for the platform healthcheck (GET /health). The worker has no other HTTP surface.
  const health = startHealthServer(Number(env.PORT), { startedAt: new Date(), lastPollAt: null });
  let stopping = false;
  const stop = (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`Worker stopping (${signal})`);
    controller.abort();
    health.close();
    void prisma.$disconnect().finally(() => process.exit(0));
  };
  process.on("SIGTERM", () => stop("SIGTERM"));
  process.on("SIGINT", () => stop("SIGINT"));
}
