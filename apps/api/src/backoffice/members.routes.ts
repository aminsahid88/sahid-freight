/**
 * Company members.
 *
 * GET  /companies/:companyId/members    all roles → memberships with user {id, fullName, email}
 * POST /companies/:companyId/members    OWNER/ADMIN → {email, role} adds an existing account to the company
 *
 * Invitations for people without an account are a later phase; today the
 * person registers first and is then added by email.
 */
import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { audit } from "../audit/log";
import { protect } from "../middleware/auth.middleware";
import { badRequest, HttpError, parse, wrap } from "./errors";
import { type CompanyRequest, ctx, requireCompany } from "./middleware";

const addSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["OWNER", "STAFF", "DRIVER", "REVIEWER", "PARTNER"]),
});

export function membersRouter(prisma: PrismaClient): Router {
  const r = Router({ mergeParams: true });
  r.use(protect);

  r.get(
    "/",
    requireCompany(prisma),
    wrap(async (req: CompanyRequest, res) => {
      const { db } = ctx(req);
      const members = await db.membership.findMany({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: { user: { select: { id: true, fullName: true, email: true } } },
      });
      res.json({ members });
    }),
  );

  r.post(
    "/",
    requireCompany(prisma, "OWNER", "ADMIN"),
    wrap(async (req: CompanyRequest, res) => {
      const { db, userId } = ctx(req);
      const body = parse(addSchema, req.body, "member");
      const user = await prisma.user.findFirst({ where: { email: { equals: body.email, mode: "insensitive" } }, select: { id: true, fullName: true, email: true } });
      if (!user) throw new HttpError(404, `No account exists for ${body.email} yet. Ask them to register first, then add them.`, "user_not_found");
      const existing = await db.membership.findFirst({ where: { userId: user.id, role: body.role } });
      if (existing) throw badRequest(`${user.fullName} is already a ${body.role} of this company`);
      const member = await db.membership.create({ data: { userId: user.id, role: body.role } as never, include: { user: { select: { id: true, fullName: true, email: true } } } });
      await audit(db, { action: "member_added", userId, target: `Membership:${member.id}`, meta: { membershipId: member.id, memberUserId: user.id, role: body.role }, ip: req.ip });
      res.status(201).json({ member });
    }),
  );

  return r;
}
