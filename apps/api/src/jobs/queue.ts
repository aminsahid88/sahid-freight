/**
 * Postgres-backed job queue (decision 2026-11-03: BullMQ deferred).
 *
 * Idempotency: one Job row per key `<documentId>:<step>:<version>`.
 * `enqueue` is a no-op when the key already exists, so re-uploading, retrying a
 * request or re-running a pipeline step never duplicates work. Workers claim
 * with `FOR UPDATE SKIP LOCKED`, so several worker processes can run safely.
 */
import type { JobStatus, PrismaClient } from "@prisma/client";
import { getProcessingState } from "./processing-state";

export interface JobPayload {
  documentId?: string;
  [key: string]: unknown;
}

export interface EnqueueInput {
  step: string;
  version: string;
  companyId?: string | null;
  payload: JobPayload;
  /** Defaults to payload.documentId; must be stable for the same unit of work. */
  subject?: string;
  runAfter?: Date;
}

export function idempotencyKey(subject: string, step: string, version: string): string {
  return `${subject}:${step}:${version}`;
}

export async function enqueue(prisma: PrismaClient, input: EnqueueInput): Promise<{ id: string; created: boolean }> {
  const subject = input.subject ?? input.payload.documentId;
  if (!subject) throw new Error("enqueue: subject or payload.documentId is required for idempotency");
  const key = idempotencyKey(subject, input.step, input.version);
  const existing = await prisma.job.findUnique({ where: { idempotencyKey: key }, select: { id: true } });
  if (existing) return { id: existing.id, created: false };
  try {
    const job = await prisma.job.create({
      data: {
        idempotencyKey: key,
        step: input.step,
        companyId: input.companyId ?? null,
        payload: input.payload as never,
        runAfter: input.runAfter ?? new Date(),
      },
      select: { id: true },
    });
    return { id: job.id, created: true };
  } catch (err) {
    // Lost a race with another enqueue of the same key: treat as already queued.
    const again = await prisma.job.findUnique({ where: { idempotencyKey: key }, select: { id: true } });
    if (again) return { id: again.id, created: false };
    throw err;
  }
}

export interface ClaimedJob {
  id: string;
  idempotencyKey: string;
  step: string;
  companyId: string | null;
  payload: JobPayload;
  attempts: number;
  maxAttempts: number;
}

/** Atomically claim the next runnable job, or null when the queue is idle. Jobs of a paused company are skipped (they wait). */
export async function claimNext(prisma: PrismaClient, steps?: string[], now: Date = new Date()): Promise<ClaimedJob | null> {
  // runAfter is written with the app clock (enqueue, fail backoff), so it is compared with the app clock too.
  // Comparing with the database's NOW() mixed two clocks: a few seconds of drift left fresh jobs unclaimable.
  const stepFilter = steps && steps.length ? `AND step = ANY($2::text[])` : "";
  const params: unknown[] = steps && steps.length ? [now, steps] : [now];
  const rows = await prisma.$queryRawUnsafe<ClaimedJob[]>(
    `UPDATE "Job" SET status = 'RUNNING', attempts = attempts + 1, "lockedAt" = NOW(), "updatedAt" = NOW()
     WHERE id = (
       SELECT id FROM "Job"
       WHERE status = 'QUEUED' AND "runAfter" <= $1::timestamp ${stepFilter}
         AND ("companyId" IS NULL OR "companyId" NOT IN (SELECT id FROM "Company" WHERE "pausedAt" IS NOT NULL))
       ORDER BY "runAfter", "createdAt"
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING id, "idempotencyKey", step, "companyId", payload, attempts, "maxAttempts"`,
    ...params,
  );
  return rows[0] ?? null;
}

export async function complete(prisma: PrismaClient, jobId: string): Promise<void> {
  await prisma.job.update({ where: { id: jobId }, data: { status: "DONE", lockedAt: null, error: null } });
}

/** Mark failed; requeue with backoff until maxAttempts is exhausted. */
export async function fail(prisma: PrismaClient, job: ClaimedJob, err: unknown): Promise<JobStatus> {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const exhausted = job.attempts >= job.maxAttempts;
  const backoffMs = Math.min(60_000, 1000 * 2 ** job.attempts);
  await prisma.job.update({
    where: { id: job.id },
    data: {
      status: exhausted ? "FAILED" : "QUEUED",
      error: message.slice(0, 2000),
      lockedAt: null,
      runAfter: exhausted ? undefined : new Date(Date.now() + backoffMs),
    },
  });
  return exhausted ? "FAILED" : "QUEUED";
}

export type Processor = (job: ClaimedJob, prisma: PrismaClient) => Promise<void>;

/** Claim and run one job. Returns what happened so loops and tests can react. */
export async function runOne(
  prisma: PrismaClient,
  processors: Record<string, Processor>,
): Promise<{ ran: false; paused?: boolean } | { ran: true; job: ClaimedJob; status: JobStatus }> {
  // Platform-wide pause from the control room: claim nothing, queued work waits.
  if ((await getProcessingState(prisma)).paused) return { ran: false, paused: true };
  const job = await claimNext(prisma, Object.keys(processors));
  if (!job) return { ran: false };
  const processor = processors[job.step];
  try {
    if (!processor) throw new Error(`no processor registered for step ${job.step}`);
    await processor(job, prisma);
    await complete(prisma, job.id);
    return { ran: true, job, status: "DONE" };
  } catch (err) {
    const status = await fail(prisma, job, err);
    return { ran: true, job, status };
  }
}
