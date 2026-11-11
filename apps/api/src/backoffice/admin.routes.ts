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
 * GET  /admin/users?q=&status=&limit=   people (members and admins; any user when searching) with memberships and last sign-in
 * POST /admin/users/:userId/suspend     {reason}  blocks sign-in, refresh and every back-office request at once; audited
 * POST /admin/users/:userId/reactivate  {reason?} back to ACTIVE; audited
 * POST /admin/companies/:id/pause       {reason}  members read-only, its jobs wait; break-glass admins can still act; audited
 * POST /admin/companies/:id/resume      {reason?} audited
 * GET  /admin/processing                platform-wide reading pipeline state
 * POST /admin/processing/pause          {reason}  the worker claims nothing until resumed; audited
 * POST /admin/processing/resume         {reason?} audited
 * Nothing here deletes anything.
 */
import type { JobStatus, Prisma, PrismaClient } from "@prisma/client";
import { type Response, Router } from "express";
import { z } from "zod";
import { AUDIT_ACTIONS } from "@tbo/core";
import { auditPlatform } from "../audit/log";
import type { Env } from "../config/env";
import { monthSpendUsd } from "../jobs/extraction";
import { getProcessingState, setProcessingState } from "../jobs/processing-state";
import { type AuthRequest, protect } from "../middleware/auth.middleware";
import { badRequest, notFound, parse, wrap } from "./errors";
import { platformAdminOnly } from "./platform-admin";

const JOB_STATUSES = ["QUEUED", "RUNNING", "DONE", "FAILED"] as const;

const jobsQuery = z.object({
  status: z.enum(JOB_STATUSES).optional(),
  companyId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const retryFailedSchema = z.object({ companyId: z.string().uuid().optional() });

const reasonRequired = z.object({ reason: z.string().trim().min(10, "give a reason of at least 10 characters").max(500) });
const reasonOptional = z.object({ reason: z.string().trim().max(500).optional() });
const USER_STATUSES = ["ACTIVE", "SUSPENDED", "BANNED", "PENDING_VERIFICATION", "DOCUMENTS_SUBMITTED"] as const;
const usersQuery = z.object({
  q: z.string().trim().min(1).max(120).optional(),
  status: z.enum(USER_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

function conflict(res: Response, code: string, message: string): void {
  res.status(409).json({ error: code, message });
}

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
      const [companies, users, documents, transactions, openIssues, jobs, monthUsd, breakGlass, processing, suspendedUsers, pausedCompanies] = await Promise.all([
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
        getProcessingState(prisma),
        prisma.user.count({ where: { status: { in: ["SUSPENDED", "BANNED"] } } }),
        prisma.company.count({ where: { pausedAt: { not: null } } }),
      ]);
      res.json({
        processing,
        suspendedUsers,
        pausedCompanies,
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
          pausedAt: true,
          pausedReason: true,
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

  // ── People ──
  r.get(
    "/users",
    wrap(async (req: AuthRequest, res) => {
      const q = parse(usersQuery, req.query, "query");
      const where: Prisma.UserWhereInput = {
        ...(q.q
          ? { OR: [{ fullName: { contains: q.q, mode: "insensitive" } }, { email: { contains: q.q, mode: "insensitive" } }, { phone: { contains: q.q } }] }
          : { OR: [{ memberships: { some: {} } }, { role: "ADMIN" }] }),
        ...(q.status ? { status: q.status } : {}),
      };
      const rows = await prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: q.limit,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          createdAt: true,
          memberships: { select: { role: true, company: { select: { id: true, legalName: true, dba: true, pausedAt: true } } } },
        },
      });
      const logins = rows.length
        ? await prisma.auditLog.groupBy({ by: ["userId"], where: { action: "login", userId: { in: rows.map((u) => u.id) } }, _max: { createdAt: true } })
        : [];
      const last = new Map(logins.map((l) => [l.userId, l._max.createdAt]));
      res.json({ users: rows.map((u) => ({ ...u, lastLoginAt: last.get(u.id) ?? null })) });
    }),
  );

  r.post(
    "/users/:userId/suspend",
    wrap(async (req: AuthRequest, res) => {
      const id = parse(z.string().uuid(), req.params.userId, "userId");
      const body = parse(reasonRequired, req.body ?? {}, "suspension");
      if (id === req.user!.userId) throw badRequest("You cannot suspend your own account");
      const user = await prisma.user.findUnique({ where: { id }, select: { id: true, status: true, role: true, fullName: true } });
      if (!user) throw notFound("User");
      if (user.status === "SUSPENDED" || user.status === "BANNED") return conflict(res, "already_suspended", "This account is already suspended.");
      await prisma.user.update({ where: { id }, data: { status: "SUSPENDED" } });
      await auditPlatform(prisma, { userId: req.user!.userId, action: "user_suspended", target: `User:${id}`, meta: { reason: body.reason, previousStatus: user.status, role: user.role }, ip: req.ip });
      res.json({ user: { id, status: "SUSPENDED" } });
    }),
  );

  r.post(
    "/users/:userId/reactivate",
    wrap(async (req: AuthRequest, res) => {
      const id = parse(z.string().uuid(), req.params.userId, "userId");
      const body = parse(reasonOptional, req.body ?? {}, "reactivation");
      const user = await prisma.user.findUnique({ where: { id }, select: { id: true, status: true } });
      if (!user) throw notFound("User");
      if (user.status !== "SUSPENDED" && user.status !== "BANNED") return conflict(res, "not_suspended", "This account is not suspended.");
      await prisma.user.update({ where: { id }, data: { status: "ACTIVE" } });
      await auditPlatform(prisma, { userId: req.user!.userId, action: "user_reactivated", target: `User:${id}`, meta: { reason: body.reason ?? null, previousStatus: user.status }, ip: req.ip });
      res.json({ user: { id, status: "ACTIVE" } });
    }),
  );

  // ── Company pause ──
  r.post(
    "/companies/:companyId/pause",
    wrap(async (req: AuthRequest, res) => {
      const id = parse(z.string().uuid(), req.params.companyId, "companyId");
      const body = parse(reasonRequired, req.body ?? {}, "pause");
      const company = await prisma.company.findUnique({ where: { id }, select: { id: true, pausedAt: true } });
      if (!company) throw notFound("Company");
      if (company.pausedAt) return conflict(res, "already_paused", "This company is already paused.");
      const now = new Date();
      await prisma.company.update({ where: { id }, data: { pausedAt: now, pausedReason: body.reason, pausedById: req.user!.userId } });
      await auditPlatform(prisma, { companyId: id, userId: req.user!.userId, action: "company_paused", target: `Company:${id}`, meta: { reason: body.reason }, ip: req.ip });
      res.json({ company: { id, pausedAt: now, pausedReason: body.reason } });
    }),
  );

  r.post(
    "/companies/:companyId/resume",
    wrap(async (req: AuthRequest, res) => {
      const id = parse(z.string().uuid(), req.params.companyId, "companyId");
      const body = parse(reasonOptional, req.body ?? {}, "resume");
      const company = await prisma.company.findUnique({ where: { id }, select: { id: true, pausedAt: true, pausedReason: true } });
      if (!company) throw notFound("Company");
      if (!company.pausedAt) return conflict(res, "not_paused", "This company is not paused.");
      await prisma.company.update({ where: { id }, data: { pausedAt: null, pausedReason: null, pausedById: null } });
      await auditPlatform(prisma, {
        companyId: id,
        userId: req.user!.userId,
        action: "company_resumed",
        target: `Company:${id}`,
        meta: { reason: body.reason ?? null, pausedSince: company.pausedAt, pausedReason: company.pausedReason },
        ip: req.ip,
      });
      res.json({ company: { id, pausedAt: null } });
    }),
  );

  // ── Platform-wide processing switch ──
  r.get(
    "/processing",
    wrap(async (_req: AuthRequest, res) => {
      res.json({ processing: await getProcessingState(prisma) });
    }),
  );

  r.post(
    "/processing/pause",
    wrap(async (req: AuthRequest, res) => {
      const body = parse(reasonRequired, req.body ?? {}, "pause");
      if ((await getProcessingState(prisma)).paused) return conflict(res, "already_paused", "Processing is already paused.");
      const state = await setProcessingState(prisma, { paused: true, reason: body.reason, byUserId: req.user!.userId, at: new Date().toISOString() });
      await auditPlatform(prisma, { userId: req.user!.userId, action: "processing_paused", target: "Platform:processing", meta: { reason: body.reason }, ip: req.ip });
      res.json({ processing: state });
    }),
  );

  r.post(
    "/processing/resume",
    wrap(async (req: AuthRequest, res) => {
      const body = parse(reasonOptional, req.body ?? {}, "resume");
      const before = await getProcessingState(prisma);
      if (!before.paused) return conflict(res, "not_paused", "Processing is not paused.");
      const state = await setProcessingState(prisma, { paused: false, reason: null, byUserId: req.user!.userId, at: new Date().toISOString() });
      await auditPlatform(prisma, { userId: req.user!.userId, action: "processing_resumed", target: "Platform:processing", meta: { reason: body.reason ?? null, pausedSince: before.at, pausedReason: before.reason }, ip: req.ip });
      res.json({ processing: state });
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
