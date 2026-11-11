/**
 * Refuses a suspended or banned account on every back-office request, so a
 * suspension takes effect immediately instead of when the 7-day access token
 * expires. 401 makes the web client try a refresh, which is refused too, and
 * the user lands on sign-in where the login route explains the suspension.
 */
import type { PrismaClient } from "@prisma/client";
import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware";
import { HttpError } from "./errors";

export const BLOCKED_STATUSES = new Set(["SUSPENDED", "BANNED"]);

export function requireActiveUser(prisma: PrismaClient) {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) return next();
      const u = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { status: true } });
      if (!u || BLOCKED_STATUSES.has(u.status)) return next(new HttpError(401, "This account is suspended. Contact support.", "account_suspended"));
      next();
    } catch (err) {
      next(err);
    }
  };
}
