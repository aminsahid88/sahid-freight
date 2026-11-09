/**
 * Platform control room (platform admins only; legacy User.role ADMIN).
 * Read-mostly views across every company plus two guarded actions: retrying a
 * failed job and searching the audit log. Entering a company's data still goes
 * through the normal `/companies/:companyId` routes with an
 * `X-Break-Glass-Reason` header, which the company guard writes to the audit log.
 *
 * GET  /admin/overview                 counts across the platform, this month's AI spend vs budget, recent break-glass entries
 * GET  /admin/companies                every company with member/document/transaction/open-issue/failed-job counts
 * GET  /admin/jobs?status=&companyId=&limit=   job queue rows (newest first) with per-status counts
 * POST /admin/jobs/:jobId/retry        requeue one FAILED job (attempts reset); audited as reprocess on Job:<id>
 * POST /admin/jobs/retry-failed        requeue every FAILED job (optionally one company's); audited
 * GET  /admin/audit?companyId=&action=&userId=&q=&before=&limit=   audit log across companies, newest first
 */
import type { JobStatus, Prisma, PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { AUDIT_ACTIONS } from "@tbo/core";
import { auditPlatform } from "../audit/log";
import type { Env } from "../config/env";
import { monthSpendUsd } from "../jobs/extraction";
import { type AuthRequest, protect } from "../middleware/auth.middleware";
import { notFound, parse, wrap } from "./errors";
import { platformAdminOnly } from "./platform-admin";

const JOB_STATUSES = ["QUEUED", "RUNNING", "DONE", "FAILED"] as const;

const jobsQuery = z.object({
  status: z.enum(JOB_STATUSES).optional(),
  companyId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const retryFailedSchema = z.object({ companyId: z.string().uuid().optional() });

const auditQuery = z.object({
  companyId: z.string().uuid().optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  userId: z.string().uuid().optional(),
  q: z.string().trim().min(1).max(120).optional(),
  before: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

function byStatus<T extends string>(rows: Array<{ status: T; _count: { _all: number } }>, all: readonly T[]): Record<T, number> {
  const out = Object.fromEntries(all.map((s) => [s, 0])) as Record<T, number>;
  for (const r of rows) out[r.status] = r._count._all;
  return out;
}

function documentIdOf(payload: Prisma.JsonValue): string | null {
  return payload && typeof payload === "object" && !Array.isArray(payload) && typeof payload.documentId === "string" ? payload.documentId : null;
}

export function adminRouter(prisma: PrismaClient, env: Env): Router {
  const r = Router();
  r.use(protect, platformAdminOnly);

  r.get(
    "/overview",
    wrap(async (_req: AuthRequest, res) => {
      const [companies, users, documents, transactions, openIssues, jobs, monthUsd, breakGlass] = await Promise.all([
        prisma.company.count(),
        prisma.membership.findMany({ distinct: ["userId"], select: { userId: true } }).then((rows) => rows.length),
        prisma.document.groupBy({ by: ["status"], _count: { _all: true }, where: { deletedAt: null } }),
        prisma.transaction.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.issue.count({ where: { status: "OPEN", severity: "ERROR" } }),
        prisma.job.groupBy({ by: ["status"], _count: { _all: true } }),
        monthSpendUsd(prisma),
        prisma.auditLog.findMany({
          where: { action: "break_glass" },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { user: { select: { id: true, fullName: true, email: true } }, company: { select: { id: true, legalName: true, dba: true } } },
        }),
      ]);
      res.json({
        companies,
        users,
        documents: { total: documents.reduce((n, d) => n + d._count._all, 0), byStatus: byStatus(documents, ["RECEIVED", "PROCESSING", "PROCESSED", "FAILED", "UNREADABLE"] as const) },
        transactions: { total: transactions.reduce((n, t) => n + t._count._all, 0), byStatus: byStatus(transactions, ["VERIFIED", "NEEDS_ATTENTION", "UNABLE_TO_VERIFY"] as const) },
        openErrorIssues: openIssues,
        jobs: byStatus(jobs, JOB_STATUSES),
        spend: { monthUsd, budgetUsd: env.AI_MONTHLY_BUDGET_USD.toFixed(2) },
        breakGlass,
      });
    }),
  );

  r.get(
    "/companies",
    wrap(async (_req: AuthRequest, res) => {
      const rows = await prisma.company.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          legalName: true,
          dba: true,
          usdot: true,
          language: true,
          timezone: true,
          isDemo: true,
          createdAt: true,
          _count: {
            select: {
              memberships: true,
              vehicles: true,
              documents: { where: { deletedAt: null } },
              transactions: true,
              issues: { where: { status: "OPEN", severity: "ERROR" } },
              jobs: { where: { status: "FAILED" } },
            },
          },
          documents: { select: { receivedAt: true }, orderBy: { receivedAt: "desc" }, take: 1 },
        },
      });
      res.json({
        companies: rows.map(({ _count, documents, ...c }) => ({
          ...c,
          counts: { members: _count.memberships, vehicles: _count.vehicles, documents: _count.documents, transactions: _count.transactions, openErrorIssues: _count.issues, failedJobs: _count.jobs },
          lastDocumentAt: documents[0]?.receivedAt ?? null,
        })),
      });
    }),
  );

  r.get(
    "/jobs",
    wrap(async (req: AuthRequest, res) => {
      const q = parse(jobsQuery, req.query, "query");
      const where: Prisma.JobWhereInput = { ...(q.status ? { status: q.status } : {}), ...(q.companyId ? { companyId: q.companyId } : {}) };
      const [rows, counts] = await Promise.all([
        prisma.job.findMany({ where, orderBy: { updatedAt: "desc" }, take: q.limit, include: { company: { select: { id: true, legalName: true, dba: true } } } }),
        prisma.job.groupBy({ by: ["status"], _count: { _all: true }, where: q.companyId ? { companyId: q.companyId } : undefined }),
      ]);
      res.json({
        jobs: rows.map(({ payload, idempotencyKey, ...j }) => ({ ...j, documentId: documentIdOf(payload), key: idempotencyKey })),
        counts: byStatus(counts, JOB_STATUSES),
      });
    }),
  );

  r.post(
    "/jobs/retry-failed",
    wrap(async (req: AuthRequest, res) => {
      const body = parse(retryFailedSchema, req.body ?? {}, "retry");
      const where: Prisma.JobWhereInput = { status: "FAILED", ...(body.companyId ? { companyId: body.companyId } : {}) };
      const ids = (await prisma.job.findMany({ where, select: { id: true } })).map((j) => j.id);
      const result = ids.length ? await prisma.job.updateMany({ where: { id: { in: ids }, status: "FAILED" }, data: { status: "QUEUED", attempts: 0, error: null, lockedAt: null, runAfter: new Date() } }) : { count: 0 };
      if (result.count > 0) {
        await auditPlatform(prisma, {
          companyId: body.companyId ?? null,
          userId: req.user!.userId,
          action: "reprocess",
          target: "Job:failed",
          meta: { requeued: result.count, jobIds: ids.slice(0, 100) },
          ip: req.ip,
        });
      }
      res.json({ requeued: result.count });
    }),
  );

  r.post(
    "/jobs/:jobId/retry",
    wrap(async (req: AuthRequest, res) => {
      const id = parse(z.string().uuid(), req.params.jobId, "jobId");
      const job = await prisma.job.findUnique({ where: { id } });
      if (!job) throw notFound("Job");
      if (job.status !== "FAILED") {
        res.status(409).json({ error: "not_failed", message: `Only a failed job can be retried; this one is ${job.status}.`, status: job.status satisfies JobStatus });
        return;
      }
      const updated = await prisma.job.updateMany({ where: { id, status: "FAILED" }, data: { status: "QUEUED", attempts: 0, error: null, lockedAt: null, runAfter: new Date() } });
      if (updated.count === 0) {
        res.status(409).json({ error: "not_failed", message: "The job changed state while retrying; refresh and try again." });
        return;
      }
      await auditPlatform(prisma, {
        companyId: job.companyId,
        userId: req.user!.userId,
        action: "reprocess",
        target: `Job:${job.id}`,
        meta: { step: job.step, documentId: documentIdOf(job.payload), previousError: job.error?.slice(0, 300) ?? null },
        ip: req.ip,
      });
      const fresh = await prisma.job.findUniqueOrThrow({ where: { id }, include: { company: { select: { id: true, legalName: true, dba: true } } } });
      const { payload, idempotencyKey, ...rest } = fresh;
      res.json({ job: { ...rest, documentId: documentIdOf(payload), key: idempotencyKey } });
    }),
  );

  r.get(
    "/audit",
    wrap(async (req: AuthRequest, res) => {
      const q = parse(auditQuery, req.query, "query");
      const where: Prisma.AuditLogWhereInput = {
        ...(q.companyId ? { companyId: q.companyId } : {}),
        ...(q.action ? { action: q.action } : {}),
        ...(q.userId ? { userId: q.userId } : {}),
        ...(q.q ? { target: { contains: q.q, mode: "insensitive" } } : {}),
        ...(q.before ? { createdAt: { lt: q.before } } : {}),
      };
      const entries = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: q.limit + 1,
        include: { user: { select: { id: true, fullName: true, email: true } }, company: { select: { id: true, legalName: true, dba: true } } },
      });
      const page = entries.slice(0, q.limit);
      res.json({ entries: page, nextBefore: entries.length > q.limit ? page[page.length - 1]!.createdAt : null });
    }),
  );

  return r;
}
