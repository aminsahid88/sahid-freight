/**
 * Official IFTA rate tables (platform reference data, not tenant data).
 * Only a platform admin (legacy User.role ADMIN) may load them; the rows are
 * the single source of tax rates for every worksheet (never an LLM).
 *
 * POST /admin/ifta-rates            {quarter, sourceUrl, fuelType?, rows: [{jurisdiction, rate, surcharge?}]}  upsert
 * GET  /admin/ifta-rates/:quarter   list (optional ?fuelType=diesel)
 */
import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { auditPlatform } from "../audit/log";
import { type AuthRequest, protect } from "../middleware/auth.middleware";
import { badRequest, parse, wrap } from "./errors";
import { platformAdminOnly } from "./platform-admin";

const rateString = z.string().trim().regex(/^\d{1,5}(\.\d{1,5})?$/, "must be a plain decimal with up to 5 places");
const quarterLabel = z.string().trim().regex(/^\d{4}Q[1-4]$/, "must look like 2026Q4");

const loadSchema = z.object({
  quarter: quarterLabel,
  sourceUrl: z.string().trim().url().max(500),
  fuelType: z.string().trim().min(1).max(20).default("diesel"),
  rows: z
    .array(
      z.object({
        jurisdiction: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "must be a 2-letter code"),
        rate: rateString,
        surcharge: rateString.optional(),
      }),
    )
    .min(1)
    .max(100),
});

const listQuery = z.object({ fuelType: z.string().trim().min(1).max(20).optional() });

export function iftaRatesRouter(prisma: PrismaClient): Router {
  const r = Router();
  r.use(protect, platformAdminOnly);

  r.post(
    "/",
    wrap(async (req: AuthRequest, res) => {
      const body = parse(loadSchema, req.body, "rate table");
      const seen = new Set<string>();
      for (const row of body.rows) {
        if (seen.has(row.jurisdiction)) throw badRequest(`Jurisdiction ${row.jurisdiction} appears more than once`);
        seen.add(row.jurisdiction);
      }
      const known = new Set((await prisma.jurisdiction.findMany({ select: { code: true } })).map((j) => j.code));
      const unknown = body.rows.map((x) => x.jurisdiction).filter((j) => !known.has(j));
      if (unknown.length) {
        res.status(400).json({ error: "validation", message: `Unknown jurisdiction(s): ${unknown.join(", ")}`, details: unknown.map((j) => ({ path: "rows.jurisdiction", message: `${j} is not a known jurisdiction` })) });
        return;
      }
      const importedAt = new Date();
      const rates = await prisma.$transaction(
        body.rows.map((row) =>
          prisma.iftaRate.upsert({
            where: { quarter_jurisdiction_fuelType: { quarter: body.quarter, jurisdiction: row.jurisdiction, fuelType: body.fuelType } },
            update: { rate: row.rate, surcharge: row.surcharge ?? null, sourceUrl: body.sourceUrl, importedAt },
            create: { quarter: body.quarter, jurisdiction: row.jurisdiction, fuelType: body.fuelType, rate: row.rate, surcharge: row.surcharge ?? null, sourceUrl: body.sourceUrl, importedAt },
          }),
        ),
      );
      await auditPlatform(prisma, {
        userId: req.user!.userId,
        action: "edit",
        target: `IftaRate:${body.quarter}`,
        meta: { quarter: body.quarter, fuelType: body.fuelType, rows: rates.length, sourceUrl: body.sourceUrl },
        ip: req.ip,
      });
      res.status(201).json({ quarter: body.quarter, fuelType: body.fuelType, rows: rates.length, rates });
    }),
  );

  r.get(
    "/:quarter",
    wrap(async (req: AuthRequest, res) => {
      const quarter = parse(quarterLabel, req.params.quarter, "quarter");
      const q = parse(listQuery, req.query, "query");
      const rates = await prisma.iftaRate.findMany({ where: { quarter, ...(q.fuelType ? { fuelType: q.fuelType } : {}) }, orderBy: [{ fuelType: "asc" }, { jurisdiction: "asc" }] });
      res.json({ quarter, rates });
    }),
  );

  return r;
}
