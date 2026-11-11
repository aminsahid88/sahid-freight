/**
 * Platform-wide processing switch (control room). Stored as a platform Setting
 * (companyId null, key "platform.processing"). While paused, the worker claims
 * nothing: queued jobs wait and nothing is dropped.
 */
import type { PrismaClient } from "@prisma/client";

export const PROCESSING_KEY = "platform.processing";

export interface ProcessingState {
  paused: boolean;
  reason: string | null;
  byUserId: string | null;
  at: string | null;
}

const RUNNING: ProcessingState = { paused: false, reason: null, byUserId: null, at: null };

export async function getProcessingState(prisma: PrismaClient): Promise<ProcessingState> {
  // @@unique([companyId, key]) does not cover NULL companyId in Postgres, so read with findFirst.
  const row = await prisma.setting.findFirst({ where: { companyId: null, key: PROCESSING_KEY }, orderBy: { updatedAt: "desc" } });
  const v = row?.value as Partial<ProcessingState> | null | undefined;
  return v && typeof v === "object" ? { ...RUNNING, ...v, paused: v.paused === true } : RUNNING;
}

export async function setProcessingState(prisma: PrismaClient, state: ProcessingState): Promise<ProcessingState> {
  const row = await prisma.setting.findFirst({ where: { companyId: null, key: PROCESSING_KEY }, select: { id: true } });
  if (row) await prisma.setting.update({ where: { id: row.id }, data: { value: state as never } });
  else await prisma.setting.create({ data: { companyId: null, key: PROCESSING_KEY, value: state as never } });
  return state;
}
