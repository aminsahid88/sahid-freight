/**
 * Company membership guard. Every back-office route that touches tenant data
 * is mounted under `/companies/:companyId` and runs `requireCompany(...)`,
 * which resolves the caller's membership and attaches a tenant-scoped client.
 *
 * Platform admins (legacy User.role ADMIN) have no implicit access: they may
 * only enter a company with an explicit `X-Break-Glass-Reason` header, and that
 * entry is written to the audit log.
 */
import type { CompanyRole, PrismaClient } from "@prisma/client";
import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware";
import { auditPlatform } from "../audit/log";
import { type TenantClient, tenantClient } from "../tenant/client";
import { forbidden, HttpError, notFound } from "./errors";

export interface CompanyContext {
  id: string;
  role: CompanyRole;
  breakGlass: boolean;
}

export interface CompanyRequest extends AuthRequest {
  company?: CompanyContext;
  db?: TenantClient;
}

/** Highest-privilege membership wins when a user holds several roles in one company. */
const ROLE_RANK: Record<CompanyRole, number> = { OWNER: 6, ADMIN: 5, PARTNER: 4, REVIEWER: 3, STAFF: 2, DRIVER: 1 };

export function pickRole(roles: CompanyRole[]): CompanyRole | null {
  return roles.sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0] ?? null;
}

export function requireCompany(prisma: PrismaClient, ...allowed: CompanyRole[]) {
  return async (req: CompanyRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!user) throw new HttpError(401, "Not authorized", "unauthorized");
      const companyId = req.params.companyId;
      if (!companyId || typeof companyId !== "string") throw new HttpError(400, "companyId is required", "bad_request");

      const memberships = await prisma.membership.findMany({ where: { userId: user.userId, companyId }, select: { role: true } });
      let role = pickRole(memberships.map((m) => m.role));
      let breakGlass = false;

      if (!role) {
        const reason = req.header("x-break-glass-reason");
        if (user.role === "ADMIN" && reason && reason.trim().length >= 10) {
          const exists = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
          if (!exists) throw notFound("Company");
          await auditPlatform(prisma, {
            companyId,
            userId: user.userId,
            action: "break_glass",
            target: `${req.method} ${req.originalUrl}`,
            meta: { reason: reason.trim().slice(0, 500) },
            ip: req.ip,
          });
          role = "ADMIN";
          breakGlass = true;
        } else {
          // 404 rather than 403 so outsiders cannot enumerate company ids.
          throw notFound("Company");
        }
      }

      if (allowed.length && !allowed.includes(role)) throw forbidden(`This action needs one of: ${allowed.join(", ")}`);

      req.company = { id: companyId, role, breakGlass };
      req.db = tenantClient(prisma, companyId);
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Narrow helper for handlers: the guard above guarantees these are set. */
export function ctx(req: CompanyRequest): { company: CompanyContext; db: TenantClient; userId: string } {
  if (!req.company || !req.db || !req.user) throw new HttpError(500, "requireCompany did not run", "internal");
  return { company: req.company, db: req.db, userId: req.user.userId };
}
