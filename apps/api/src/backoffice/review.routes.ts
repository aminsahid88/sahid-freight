/**
 * Review queue and reviewer actions.
 *
 * GET  /review/queue?companyId=&mine=true&limit=            cross-company: every company the caller belongs to
 *      (DRIVER memberships excluded), items = transactions NEEDS_ATTENTION / UNABLE_TO_VERIFY with an open issue,
 *      sorted by SLA deadline (document received + 1 business day), then worst open severity, then age.
 * GET  /review/approvals                                     pending corrections across companies where the caller is OWNER/ADMIN
 *
 * POST /companies/:companyId/transactions/:id/claim         → {claimedBy, claimedAt, sessionId} · 409 review_claimed
 * POST /companies/:companyId/transactions/:id/release       → {seconds}
 * POST /companies/:companyId/transactions/:id/field-action  {field, action: accept_a|accept_b|enter|unreadable, value?, reason?}
 *      → {transaction, result: {fieldEditId, oldValue, newValue, approvalId, status}}
 *
 * GET  /companies/:companyId/approvals?status=PENDING
 * POST /companies/:companyId/approvals/:id/approve {note?}   OWNER/ADMIN
 * POST /companies/:companyId/approvals/:id/reject  {note}    OWNER/ADMIN; reverts the change through a new FieldEdit
 */
import type { CompanyRole, PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { addBusinessDays } from "@tbo/core";
import { type AuthRequest, protect } from "../middleware/auth.middleware";
import { tenantClient } from "../tenant/client";
import { badRequest, notFound, parse, wrap } from "./errors";
import { type CompanyRequest, ctx, pickRole, requireCompany } from "./middleware";
import { applyFieldAction, claimExpired, claimTransaction, decideApproval, FIELD_ACTIONS, releaseTransaction } from "./review";
import { loadDetail } from "./transactions.routes";

const QUEUE_ROLES: readonly CompanyRole[] = ["OWNER", "STAFF", "REVIEWER", "PARTNER", "ADMIN"];
const APPROVER_ROLES: readonly CompanyRole[] = ["OWNER", "ADMIN"];
const SEVERITY_RANK = { ERROR: 0, WARNING: 1, INFO: 2 } as const;

const queueQuery = z.object({
  companyId: z.string().uuid().optional(),
  mine: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
const fieldActionBody = z.object({
  field: z.string().trim().min(1).max(80),
  action: z.enum(FIELD_ACTIONS),
  value: z.string().max(500).nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
});
const approvalsQuery = z.object({ status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING") });
const approveBody = z.object({ note: z.string().trim().max(500).optional() });
const rejectBody = z.object({ note: z.string().trim().min(3, "a note of at least 3 characters is required to reject a correction").max(500) });

async function memberCompanies(prisma: PrismaClient, userId: string, roles: readonly CompanyRole[]) {
  const memberships = await prisma.membership.findMany({ where: { userId }, include: { company: { select: { id: true, legalName: true, dba: true } } } });
  const byCompany = new Map<string, { company: { id: string; legalName: string; dba: string | null }; roles: CompanyRole[] }>();
  for (const m of memberships) {
    const e = byCompany.get(m.companyId) ?? { company: m.company, roles: [] };
    e.roles.push(m.role);
    byCompany.set(m.companyId, e);
  }
  return [...byCompany.values()].map((e) => ({ ...e, role: pickRole([...e.roles])! })).filter((e) => roles.includes(e.role));
}

/** Cross-company routes, mounted at /review. */
export function reviewRouter(prisma: PrismaClient): Router {
  const r = Router();
  r.use(protect);

  r.get(
    "/queue",
    wrap(async (req: AuthRequest, res) => {
      const q = parse(queueQuery, req.query, "query");
      const userId = req.user!.userId;
      const companies = (await memberCompanies(prisma, userId, QUEUE_ROLES)).filter((c) => !q.companyId || c.company.id === q.companyId);
      const now = new Date();
      const items = [];
      for (const c of companies) {
        const db = tenantClient(prisma, c.company.id);
        const rows = await db.transaction.findMany({
          where: { status: { in: ["NEEDS_ATTENTION", "UNABLE_TO_VERIFY"] }, issues: { some: { status: "OPEN" } }, ...(q.mine === "true" ? { reviewClaimedBy: userId } : {}) },
          select: {
            id: true,
            status: true,
            date: true,
            vendor: true,
            state: true,
            receiptTotal: true,
            currency: true,
            reviewClaimedBy: true,
            reviewClaimedAt: true,
            createdAt: true,
            vehicle: { select: { unitNumber: true } },
            region: { select: { document: { select: { id: true, filename: true, receivedAt: true } } } },
            issues: { where: { status: "OPEN" }, select: { code: true, severity: true }, orderBy: { createdAt: "asc" } },
          },
          take: q.limit,
          orderBy: { createdAt: "asc" },
        });
        for (const t of rows) {
          const receivedAt = t.region?.document.receivedAt ?? t.createdAt;
          const deadline = addBusinessDays(receivedAt, 1);
          const worst = t.issues.reduce<"ERROR" | "WARNING" | "INFO">((acc, i) => (SEVERITY_RANK[i.severity] < SEVERITY_RANK[acc] ? i.severity : acc), "INFO");
          const claimed = t.reviewClaimedBy && !claimExpired(t.reviewClaimedAt, now);
          items.push({
            id: t.id,
            company: c.company,
            role: c.role,
            status: t.status,
            date: t.date,
            vendor: t.vendor,
            state: t.state,
            receiptTotal: t.receiptTotal === null ? null : t.receiptTotal.toString(),
            currency: t.currency,
            unitNumber: t.vehicle?.unitNumber ?? null,
            document: t.region ? { id: t.region.document.id, filename: t.region.document.filename, receivedAt: t.region.document.receivedAt } : null,
            receivedAt,
            deadline,
            overdue: deadline.getTime() < now.getTime(),
            worstSeverity: worst,
            openIssues: t.issues,
            claimedBy: claimed ? t.reviewClaimedBy : null,
            claimedAt: claimed ? t.reviewClaimedAt : null,
            claimedByMe: claimed ? t.reviewClaimedBy === userId : false,
          });
        }
      }
      items.sort((a, b) => a.deadline.getTime() - b.deadline.getTime() || SEVERITY_RANK[a.worstSeverity] - SEVERITY_RANK[b.worstSeverity] || a.receivedAt.getTime() - b.receivedAt.getTime());
      const claimants = [...new Set(items.map((i) => i.claimedBy).filter((x): x is string => !!x))];
      const users = claimants.length ? await prisma.user.findMany({ where: { id: { in: claimants } }, select: { id: true, fullName: true } }) : [];
      const names = new Map(users.map((u) => [u.id, u.fullName]));
      res.json({
        companies: companies.map((c) => ({ ...c.company, role: c.role })),
        items: items.slice(0, q.limit).map((i) => ({ ...i, claimedByName: i.claimedBy ? names.get(i.claimedBy) ?? null : null })),
        total: items.length,
        slaBusinessDays: 1,
      });
    }),
  );

  r.get(
    "/approvals",
    wrap(async (req: AuthRequest, res) => {
      const userId = req.user!.userId;
      const companies = await memberCompanies(prisma, userId, APPROVER_ROLES);
      const out = [];
      for (const c of companies) {
        const db = tenantClient(prisma, c.company.id);
        const rows = await db.approval.findMany({ where: { status: "PENDING", target: "correction" }, include: { user: { select: { id: true, fullName: true } } }, orderBy: { createdAt: "asc" } });
        out.push(...rows.map((a) => ({ ...a, company: c.company })));
      }
      res.json({ approvals: out });
    }),
  );

  return r;
}

/** Mounted beside the transactions router: /companies/:companyId/transactions/:id/{claim,release,field-action}. */
export function reviewActionsRouter(prisma: PrismaClient): Router {
  const r = Router({ mergeParams: true });
  r.use(protect);

  r.post(
    "/:transactionId/claim",
    requireCompany(prisma, ...QUEUE_ROLES),
    wrap(async (req: CompanyRequest, res) => {
      const { db, company, userId } = ctx(req);
      res.json(await claimTransaction({ prisma, db, companyId: company.id, userId, transactionId: req.params.transactionId as string, ip: req.ip }));
    }),
  );

  r.post(
    "/:transactionId/release",
    requireCompany(prisma, ...QUEUE_ROLES),
    wrap(async (req: CompanyRequest, res) => {
      const { db, userId } = ctx(req);
      res.json(await releaseTransaction({ db, userId, transactionId: req.params.transactionId as string, ip: req.ip }));
    }),
  );

  r.post(
    "/:transactionId/field-action",
    requireCompany(prisma, ...QUEUE_ROLES),
    wrap(async (req: CompanyRequest, res) => {
      const { db, company, userId } = ctx(req);
      const body = parse(fieldActionBody, req.body ?? {}, "field action");
      const result = await applyFieldAction({ prisma, db, companyId: company.id, userId, role: company.role, transactionId: req.params.transactionId as string, input: body, ip: req.ip });
      const transaction = await loadDetail(db, req.params.transactionId as string, prisma);
      res.json({ transaction, result });
    }),
  );

  return r;
}

/** /companies/:companyId/approvals */
export function approvalsRouter(prisma: PrismaClient): Router {
  const r = Router({ mergeParams: true });
  r.use(protect);

  r.get(
    "/",
    requireCompany(prisma, ...QUEUE_ROLES),
    wrap(async (req: CompanyRequest, res) => {
      const { db } = ctx(req);
      const q = parse(approvalsQuery, req.query, "query");
      const approvals = await db.approval.findMany({ where: { status: q.status, target: "correction" }, include: { user: { select: { id: true, fullName: true } } }, orderBy: { createdAt: "asc" } });
      res.json({ approvals });
    }),
  );

  const decide = (decision: "APPROVED" | "REJECTED") =>
    wrap(async (req: CompanyRequest, res) => {
      const { db, company, userId } = ctx(req);
      const body = decision === "APPROVED" ? parse(approveBody, req.body ?? {}, "approval") : parse(rejectBody, req.body ?? {}, "rejection");
      if (!req.params.approvalId) throw badRequest("approvalId is required");
      const out = await decideApproval({ db, companyId: company.id, userId, approvalId: req.params.approvalId as string, decision, note: body.note ?? null, ip: req.ip });
      if (!out.approval) throw notFound("Approval");
      res.json(out);
    });

  r.post("/:approvalId/approve", requireCompany(prisma, ...APPROVER_ROLES), decide("APPROVED"));
  r.post("/:approvalId/reject", requireCompany(prisma, ...APPROVER_ROLES), decide("REJECTED"));

  return r;
}
