/**
 * Issues raised by the deterministic rules, and the human review of them.
 *
 * GET  /companies/:companyId/issues               list (status default OPEN; severity, periodId, cursor, limit ≤ 200)
 * POST /companies/:companyId/issues/:id/resolve   {note?}       → RESOLVED  (the underlying problem was fixed)
 * POST /companies/:companyId/issues/:id/accept    {note ≥ 3}    → ACCEPTED  (known and accepted as-is, with a reason)
 *
 * Transitions only leave OPEN; a second decision on the same issue is a 400.
 */
import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { audit } from "../audit/log";
import { protect } from "../middleware/auth.middleware";
import type { TenantClient } from "../tenant/client";
import { badRequest, notFound, parse, wrap } from "./errors";
import { type CompanyRequest, ctx, requireCompany } from "./middleware";
import { refreshStatus } from "./review";

const listQuery = z.object({
  status: z.enum(["OPEN", "RESOLVED", "ACCEPTED"]).default("OPEN"),
  severity: z.enum(["ERROR", "WARNING", "INFO"]).optional(),
  periodId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().uuid().optional(),
});

const resolveSchema = z.object({ note: z.string().trim().max(500).optional() });
const acceptSchema = z.object({ note: z.string().trim().min(3, "a note of at least 3 characters is required to accept an issue").max(500) });

const REVIEW_ROLES = ["OWNER", "STAFF", "REVIEWER", "PARTNER", "ADMIN"] as const;

const issueInclude = {
  transaction: { select: { id: true, vendor: true, date: true, receiptTotal: true, region: { select: { document: { select: { id: true, filename: true } } } } } },
  document: { select: { id: true, filename: true } },
};

type IssueRow = Awaited<ReturnType<TenantClient["issue"]["findMany"]>>[number] & {
  transaction: { id: string; vendor: string | null; date: Date | null; receiptTotal: unknown; region: { document: { id: string; filename: string } } | null } | null;
  document: { id: string; filename: string } | null;
};

function shape(row: IssueRow) {
  const { transaction, document, ...issue } = row;
  return {
    ...issue,
    transaction: transaction ? { id: transaction.id, vendor: transaction.vendor, date: transaction.date, receiptTotal: transaction.receiptTotal } : null,
    document: document ?? transaction?.region?.document ?? null,
  };
}

export function issuesRouter(prisma: PrismaClient): Router {
  const r = Router({ mergeParams: true });
  r.use(protect);

  r.get(
    "/",
    requireCompany(prisma),
    wrap(async (req: CompanyRequest, res) => {
      const { db } = ctx(req);
      const q = parse(listQuery, req.query, "query");
      const rows = await db.issue.findMany({
        where: {
          status: q.status,
          ...(q.severity ? { severity: q.severity } : {}),
          ...(q.periodId ? { transaction: { periodId: q.periodId } } : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: q.limit + 1,
        ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
        include: issueInclude,
      });
      const hasMore = rows.length > q.limit;
      const issues = rows.slice(0, q.limit).map((row) => shape(row as IssueRow));
      res.json({ issues, nextCursor: hasMore ? issues[issues.length - 1]!.id : null });
    }),
  );

  async function decide(req: CompanyRequest, status: "RESOLVED" | "ACCEPTED", note: string | null) {
    const { db, userId } = ctx(req);
    const issue = await db.issue.findUnique({ where: { id: req.params.issueId as string } });
    if (!issue) throw notFound("Issue");
    if (issue.status !== "OPEN") throw badRequest(`Issue is already ${issue.status}; only OPEN issues can be ${status.toLowerCase()}`);
    const updated = await db.issue.update({
      where: { id: issue.id },
      data: { status, resolvedBy: userId, resolvedAt: new Date(), resolutionNote: note },
      include: issueInclude,
    });
    await audit(db, { action: "edit", userId, target: `Issue:${issue.id}`, meta: { issueId: issue.id, code: issue.code, status }, ip: req.ip });
    // A person settled this flag: with no ERROR left open the transaction is verified (never for UNABLE_TO_VERIFY).
    if (issue.transactionId) {
      const tx = await db.transaction.findUnique({ where: { id: issue.transactionId }, select: { status: true } });
      if (tx && tx.status === "NEEDS_ATTENTION") await refreshStatus(db, issue.transactionId, userId);
    }
    return shape(updated as IssueRow);
  }

  r.post(
    "/:issueId/resolve",
    requireCompany(prisma, ...REVIEW_ROLES),
    wrap(async (req: CompanyRequest, res) => {
      const body = parse(resolveSchema, req.body ?? {}, "resolution");
      res.json({ issue: await decide(req, "RESOLVED", body.note ?? null) });
    }),
  );

  r.post(
    "/:issueId/accept",
    requireCompany(prisma, ...REVIEW_ROLES),
    wrap(async (req: CompanyRequest, res) => {
      const body = parse(acceptSchema, req.body ?? {}, "acceptance");
      res.json({ issue: await decide(req, "ACCEPTED", body.note) });
    }),
  );

  return r;
}
