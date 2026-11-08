/**
 * Reports: deterministic CSV exports stored immutably with a content hash.
 *
 * POST /companies/:companyId/reports        {type: TRANSACTIONS_CSV | IFTA_WORKSHEET, periodId}
 * GET  /companies/:companyId/reports        newest first (optional periodId filter)
 * GET  /companies/:companyId/reports/:id    report + short-lived signed URL (audited as export)
 */
import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { audit } from "../audit/log";
import type { Env } from "../config/env";
import { protect } from "../middleware/auth.middleware";
import type { Storage } from "../storage";
import type { TenantClient } from "../tenant/client";
import { notFound, parse, wrap } from "./errors";
import { buildIftaWorksheet, type PeriodRow, reviewStatus } from "./ifta";
import { type CompanyRequest, ctx, requireCompany } from "./middleware";
import { buildIftaWorksheetCsv, buildTransactionsCsv, reportStorageKey, type TransactionCsvRow } from "./reports";
import { buildPeriodPdf, buildSupportZip, gatherPeriod } from "./period-report";

const createSchema = z.object({
  type: z.enum(["TRANSACTIONS_CSV", "IFTA_WORKSHEET", "PERIOD_PDF", "SUPPORT_ZIP"]),
  periodId: z.string().uuid(),
});

const listQuery = z.object({
  periodId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/** Load every transaction of the period with what the 31 CSV columns need. */
export async function loadTransactionCsvRows(db: TenantClient, periodId: string): Promise<TransactionCsvRow[]> {
  const txs = await db.transaction.findMany({
    where: { periodId },
    include: {
      vehicle: { select: { unitNumber: true } },
      lines: { orderBy: { id: "asc" } },
      issues: { where: { status: "OPEN" }, select: { code: true } },
      region: { select: { page: true, document: { select: { id: true, filename: true } } } },
      matches: { select: { cardTransactionId: true }, orderBy: { createdAt: "asc" } },
    },
  });
  const driverIds = [...new Set(txs.map((t) => t.driverId).filter((x): x is string => !!x))];
  const drivers = driverIds.length ? await db.driver.findMany({ where: { id: { in: driverIds } }, select: { id: true, name: true } }) : [];
  const driverName = new Map(drivers.map((d) => [d.id, d.name]));
  const edits = txs.length
    ? await db.fieldEdit.findMany({
        where: { entity: "Transaction", entityId: { in: txs.map((t) => t.id) } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { entityId: true, createdAt: true, user: { select: { fullName: true } } },
      })
    : [];
  const lastEdit = new Map<string, { by: string; at: Date }>();
  for (const e of edits) if (!lastEdit.has(e.entityId)) lastEdit.set(e.entityId, { by: e.user.fullName, at: e.createdAt });

  return txs.map((t) => ({
    id: t.id,
    status: t.status,
    date: t.date,
    time: t.time,
    vendor: t.vendor,
    sellerAddress: t.sellerAddress,
    state: t.state,
    stateSource: t.stateSource,
    vehicleUnit: t.vehicle?.unitNumber ?? t.unitNumberRaw ?? null,
    driver: t.driverId ? (driverName.get(t.driverId) ?? null) : null,
    lines: t.lines.map((l) => ({ category: l.category, fuelType: l.fuelType, quantity: l.quantity, unitPrice: l.unitPrice, amount: l.amount })),
    receiptTotal: t.receiptTotal,
    paymentMethod: t.paymentMethod,
    cardLast4: t.cardLast4,
    cardMatchId: t.matches[0]?.cardTransactionId ?? null,
    corroboration: t.corroboration,
    openIssueCodes: t.issues.map((i) => i.code),
    sourceDocumentId: t.region?.document.id ?? null,
    sourceFilename: t.region?.document.filename ?? null,
    sourcePage: t.region?.page ?? null,
    lastEditedBy: lastEdit.get(t.id)?.by ?? null,
    lastEditedAt: lastEdit.get(t.id)?.at ?? null,
  }));
}

export function reportsRouter(prisma: PrismaClient, storage: Storage, env: Env): Router {
  const r = Router({ mergeParams: true });
  r.use(protect);

  r.post(
    "/",
    requireCompany(prisma, "OWNER", "STAFF", "PARTNER", "ADMIN"),
    wrap(async (req: CompanyRequest, res) => {
      const { db, company, userId } = ctx(req);
      const body = parse(createSchema, req.body, "report request");
      const period: PeriodRow | null = await db.reportingPeriod.findUnique({ where: { id: body.periodId } });
      if (!period) throw notFound("Period");
      const status = await reviewStatus(db, period);

      const reportId = randomUUID();
      let bytes: Buffer;
      let contentType: string;
      let ext: string;
      if (body.type === "TRANSACTIONS_CSV") {
        bytes = Buffer.from(buildTransactionsCsv(await loadTransactionCsvRows(db, period.id)), "utf8");
        contentType = "text/csv";
        ext = "csv";
      } else if (body.type === "IFTA_WORKSHEET") {
        const built = await buildIftaWorksheet(db, period);
        if (!built.ok) {
          res.status(409).json({ error: "ifta_rates_missing", code: "I001", quarter: built.quarter, message: `No IFTA rate table is loaded for ${built.quarter}.` });
          return;
        }
        bytes = Buffer.from(buildIftaWorksheetCsv(built.worksheet, status, built.quarter), "utf8");
        contentType = "text/csv";
        ext = "csv";
      } else {
        // PDF and ZIP: the worksheet section is withheld (not estimated) when the rate table is missing.
        const input = { prisma, db, companyId: company.id, period, status, snapshotId: reportId, generatedAt: new Date() };
        const gathered = await gatherPeriod(input);
        const pdf = buildPeriodPdf(input, gathered);
        if (body.type === "PERIOD_PDF") {
          bytes = pdf;
          contentType = "application/pdf";
          ext = "pdf";
        } else {
          bytes = await buildSupportZip({ ...input, storage, periodPdf: pdf }, gathered);
          contentType = "application/zip";
          ext = "zip";
        }
      }

      const fileKey = reportStorageKey(company.id, reportId, ext);
      const hash = createHash("sha256").update(bytes).digest("hex");
      await storage.put(fileKey, bytes, contentType);
      const report = await db.report.create({
        data: { id: reportId, periodId: period.id, type: body.type, status, snapshotHash: hash, fileKey, generatedBy: userId } as never,
      });
      await audit(db, { action: "export", userId, target: `Report:${report.id}`, meta: { reportId: report.id, type: body.type, snapshotHash: hash, periodId: period.id, status }, ip: req.ip });
      res.status(201).json({ report, sizeBytes: bytes.length });
    }),
  );

  r.get(
    "/",
    requireCompany(prisma),
    wrap(async (req: CompanyRequest, res) => {
      const { db } = ctx(req);
      const q = parse(listQuery, req.query, "query");
      const reports = await db.report.findMany({
        where: q.periodId ? { periodId: q.periodId } : {},
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: q.limit,
        include: { period: { select: { id: true, type: true, startDate: true, endDate: true, status: true } } },
      });
      res.json({ reports });
    }),
  );

  r.get(
    "/:reportId",
    requireCompany(prisma),
    wrap(async (req: CompanyRequest, res) => {
      const { db, userId } = ctx(req);
      const report = await db.report.findUnique({
        where: { id: req.params.reportId as string },
        include: { period: { select: { id: true, type: true, startDate: true, endDate: true, status: true } } },
      });
      if (!report) throw notFound("Report");
      const signedUrl = await storage.getSignedUrl(report.fileKey, env.SIGNED_URL_TTL_SECONDS);
      await audit(db, { action: "export", userId, target: `Report:${report.id}`, meta: { reportId: report.id, type: report.type, snapshotHash: report.snapshotHash, op: "download" }, ip: req.ip });
      res.json({ report, signedUrl, signedUrlExpiresInSeconds: env.SIGNED_URL_TTL_SECONDS });
    }),
  );

  return r;
}
