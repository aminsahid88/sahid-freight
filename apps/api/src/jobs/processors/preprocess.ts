/**
 * `preprocess` — Phase 0 skeleton. Phase 1 adds page splitting, receipt region
 * detection and image quality scoring here; for now it only moves the document
 * from RECEIVED to PROCESSED and proves the pipeline is idempotent.
 */
import type { PrismaClient } from "@prisma/client";
import type { ClaimedJob } from "../queue";

export const PREPROCESS_STEP = "preprocess";
export const PREPROCESS_VERSION = "v1";

export async function preprocess(job: ClaimedJob, prisma: PrismaClient): Promise<void> {
  const documentId = job.payload.documentId;
  if (typeof documentId !== "string") throw new Error("preprocess: payload.documentId missing");
  const doc = await prisma.document.findUnique({ where: { id: documentId }, select: { id: true, status: true, companyId: true } });
  if (!doc) throw new Error(`preprocess: document ${documentId} not found`);
  if (job.companyId && doc.companyId !== job.companyId) throw new Error("preprocess: job/company mismatch");
  if (doc.status === "PROCESSED") return; // already done: idempotent no-op
  await prisma.document.update({ where: { id: doc.id }, data: { status: "PROCESSED" } });
}
