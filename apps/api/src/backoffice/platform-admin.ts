/**
 * Platform-admin guard for routes that are not tenant data (rate tables, the
 * control room). A platform admin is the legacy `User.role === "ADMIN"`; it
 * grants nothing inside a company without a logged break-glass reason
 * (see middleware.ts `requireCompany`).
 */
import type { NextFunction, Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware";
import { forbidden } from "./errors";

export function platformAdminOnly(req: AuthRequest, _res: Response, next: NextFunction): void {
  if (req.user?.role !== "ADMIN") {
    next(forbidden("Only a platform admin can do this"));
    return;
  }
  next();
}
