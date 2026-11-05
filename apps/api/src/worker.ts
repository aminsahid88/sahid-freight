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

export { buildExtractor, buildProcessors, workerLoop };

if (require.main === module) {
  const env = getEnv();
  const prisma = new PrismaClient();
  const storage = createStorage(env);
  const controller = startWorker(prisma, env, storage);
  const stop = () => {
    controller.abort();
    void prisma.$disconnect();
  };
  process.on("exit", stop);
}
