/**
 * Wires the back-office routers onto an Express app. `mountBackoffice` is used
 * by the real server (src/index.ts); `createBackofficeApp` builds a minimal app
 * for tests so routes can be exercised over HTTP without sockets or legacy
 * marketplace routes.
 */
import type { PrismaClient } from "@prisma/client";
import express, { type Express, Router } from "express";
import { sniffBinaryMime } from "@tbo/core";
import { type Env } from "../config/env";
import { createStorage, type Storage, verifyLocalSignature } from "../storage";
import { companiesRouter } from "./companies.routes";
import { documentsRouter } from "./documents.routes";
import { errorHandler, HttpError, wrap } from "./errors";
import { iftaRatesRouter } from "./ifta-rates.routes";
import { issuesRouter } from "./issues.routes";
import { membersRouter } from "./members.routes";
import { periodsRouter } from "./periods.routes";
import { reportsRouter } from "./reports.routes";
import { transactionsRouter } from "./transactions.routes";

export interface BackofficeDeps {
  prisma: PrismaClient;
  env: Env;
  storage?: Storage;
}

/** Serves local-driver files behind an HMAC-signed, expiring URL. */
export function filesRouter(storage: Storage, env: Env): Router {
  const r = Router();
  r.get(
    "/files",
    wrap(async (req, res) => {
      if (storage.driver !== "local") throw new HttpError(404, "Not found", "not_found");
      const key = String(req.query.key ?? "");
      const exp = Number(req.query.exp);
      const sig = String(req.query.sig ?? "");
      if (!key || !verifyLocalSignature(env.JWT_SECRET, key, exp, sig)) throw new HttpError(403, "Link expired or invalid", "forbidden");
      const body = await storage.get(key);
      // The web app lives on another origin; helmet's default CORP would block <img>/<iframe> embeds.
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Content-Disposition", "inline");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.type(sniffBinaryMime(body) ?? "application/octet-stream");
      res.send(body);
    }),
  );
  return r;
}

export function mountBackoffice(app: Express, deps: BackofficeDeps): { storage: Storage } {
  const storage = deps.storage ?? createStorage(deps.env);
  const companies = companiesRouter(deps.prisma);
  companies.use("/:companyId/documents", documentsRouter(deps.prisma, storage, deps.env));
  companies.use("/:companyId/transactions", transactionsRouter(deps.prisma));
  companies.use("/:companyId/issues", issuesRouter(deps.prisma));
  companies.use("/:companyId/periods", periodsRouter(deps.prisma, deps.env));
  companies.use("/:companyId/reports", reportsRouter(deps.prisma, storage, deps.env));
  companies.use("/:companyId/members", membersRouter(deps.prisma));
  app.use("/companies", companies);
  app.use("/admin/ifta-rates", iftaRatesRouter(deps.prisma));
  app.use(filesRouter(storage, deps.env));
  return { storage };
}

export function createBackofficeApp(deps: BackofficeDeps): { app: Express; storage: Storage } {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "1mb" }));
  const { storage } = mountBackoffice(app, deps);
  app.use(errorHandler);
  return { app, storage };
}
