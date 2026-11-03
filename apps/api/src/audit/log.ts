/**
 * Append-only audit log. Use `audit()` for company-scoped actions (through the
 * tenant client) and `auditPlatform()` for actions before a company is known
 * (login, login_failed). Never log document contents or secrets in `meta`.
 */
import type { PrismaClient } from "@prisma/client";
import { type AuditAction, isAuditAction } from "@tbo/core";
import type { TenantClient } from "../tenant/client";

export interface AuditEntry {
  action: AuditAction;
  userId?: string | null;
  target?: string | null;
  meta?: Record<string, unknown> | null;
  ip?: string | null;
}

function assertAction(action: string): asserts action is AuditAction {
  if (!isAuditAction(action)) throw new Error(`Unknown audit action: ${action}`);
}

export async function audit(db: TenantClient, entry: AuditEntry): Promise<{ id: string }> {
  assertAction(entry.action);
  const row = await db.auditLog.create({
    data: {
      action: entry.action,
      userId: entry.userId ?? null,
      target: entry.target ?? null,
      meta: (entry.meta ?? undefined) as never,
      ip: entry.ip ?? null,
    },
    select: { id: true },
  });
  return row;
}

export async function auditPlatform(prisma: PrismaClient, entry: AuditEntry & { companyId?: string | null }): Promise<{ id: string }> {
  assertAction(entry.action);
  return prisma.auditLog.create({
    data: {
      companyId: entry.companyId ?? null,
      action: entry.action,
      userId: entry.userId ?? null,
      target: entry.target ?? null,
      meta: (entry.meta ?? undefined) as never,
      ip: entry.ip ?? null,
    },
    select: { id: true },
  });
}
