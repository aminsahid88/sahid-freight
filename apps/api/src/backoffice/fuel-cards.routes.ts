/**
 * Fuel-card statement import and receipt ↔ card matching.
 *
 * POST /companies/:companyId/fuel-card-imports/preview   multipart `file` (CSV ≤ 10 MB) + `provider`
 *      → { headers, sampleRows, detectedMapping, missing, savedMapping }
 * POST /companies/:companyId/fuel-card-imports           multipart `file` + `provider` [+ `mapping` JSON] [+ `saveMapping` "true"]
 *      → 201 { fuelCardImport: {id, provider, mappingVersion, importedAt, rows, duplicates}, matching: MatchSummary }
 *      400 fuel_card_rows_invalid when any row fails validation (nothing written)
 * GET  /companies/:companyId/fuel-card-imports           → { imports: [{id, provider, mappingVersion, importedAt, rows, matched}] } newest first
 * GET  /companies/:companyId/fuel-card-transactions      ?importId=&periodId=&matched=true|false&cursor=&limit=
 *      → { rows: [{...FuelCardTransaction, match: {transactionId, score, fieldsUsed} | null}], nextCursor }
 * POST /companies/:companyId/periods/:periodId/match     → MatchSummary
 *
 * Mapping precedence on import: explicit `mapping` > saved Setting
 * `fuel_card_mapping:<provider>` > header auto-detection. CSV only (no XLSX).
 */
import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { formatFixed, parseIsoDate } from "@tbo/core";
import { audit } from "../audit/log";
import { protect } from "../middleware/auth.middleware";
import type { TenantClient } from "../tenant/client";
import { parseCsv } from "./csv-reader";
import { badRequest, HttpError, notFound, parse, wrap } from "./errors";
import { detectMapping, duplicateKey, FUEL_CARD_FIELDS, FUEL_CARD_PROVIDERS, type FuelCardMapping, type FuelCardProvider, mappingVersion, missingFields, parseFuelCardCsv } from "./fuel-cards";
import { type CompanyRequest, ctx, requireCompany } from "./middleware";
import { runCardMatching } from "./matching";

export const FUEL_CARD_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const WRITE_ROLES = ["OWNER", "STAFF", "PARTNER", "ADMIN"] as const;

const providerSchema = z.enum(FUEL_CARD_PROVIDERS);
const mappingSchema = z
  .object(Object.fromEntries(FUEL_CARD_FIELDS.map((f) => [f, z.string().trim().min(1).max(200).optional()])) as Record<(typeof FUEL_CARD_FIELDS)[number], z.ZodOptional<z.ZodString>>)
  .strict();

const previewBody = z.object({ provider: providerSchema });
const importBody = z.object({
  provider: providerSchema,
  mapping: z.string().max(5000).optional(),
  saveMapping: z.enum(["true", "false"]).optional(),
});

const listQuery = z.object({
  importId: z.string().uuid().optional(),
  periodId: z.string().uuid().optional(),
  matched: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().uuid().optional(),
});

const settingKey = (provider: FuelCardProvider) => `fuel_card_mapping:${provider}`;

async function savedMapping(db: TenantClient, provider: FuelCardProvider): Promise<FuelCardMapping | null> {
  const row = await db.setting.findFirst({ where: { key: settingKey(provider) } });
  if (!row) return null;
  const parsed = mappingSchema.safeParse(row.value);
  return parsed.success ? stripUndefined(parsed.data) : null;
}

function stripUndefined(m: FuelCardMapping): FuelCardMapping {
  const out: FuelCardMapping = {};
  for (const f of FUEL_CARD_FIELDS) if (m[f] !== undefined) out[f] = m[f];
  return out;
}

function fileText(req: CompanyRequest): string {
  const file = req.file;
  if (!file) throw badRequest("No file received. Send a CSV in the `file` field.");
  return file.buffer.toString("utf8");
}

export function fuelCardImportsRouter(prisma: PrismaClient): Router {
  const r = Router({ mergeParams: true });
  r.use(protect);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: FUEL_CARD_MAX_UPLOAD_BYTES, files: 1 } });

  r.post(
    "/preview",
    requireCompany(prisma, ...WRITE_ROLES),
    upload.single("file"),
    wrap(async (req: CompanyRequest, res) => {
      const { db } = ctx(req);
      const body = parse(previewBody, req.body ?? {}, "fuel card preview");
      const table = parseCsv(fileText(req));
      if (table.length === 0) throw badRequest("The file is empty");
      const headers = table[0]!.map((h) => h.trim());
      const { mapping, missing } = detectMapping(headers, body.provider);
      res.json({
        headers,
        sampleRows: table.slice(1, 6),
        detectedMapping: mapping,
        missing,
        savedMapping: await savedMapping(db, body.provider),
      });
    }),
  );

  r.post(
    "/",
    requireCompany(prisma, ...WRITE_ROLES),
    upload.single("file"),
    wrap(async (req: CompanyRequest, res) => {
      const { db, company, userId } = ctx(req);
      const body = parse(importBody, req.body ?? {}, "fuel card import");
      const text = fileText(req);

      let mapping: FuelCardMapping;
      if (body.mapping !== undefined) {
        let json: unknown;
        try {
          json = JSON.parse(body.mapping);
        } catch {
          throw badRequest("`mapping` must be a JSON object of field → header");
        }
        mapping = stripUndefined(parse(mappingSchema, json, "mapping"));
      } else {
        const saved = await savedMapping(db, body.provider);
        if (saved) mapping = saved;
        else {
          const table = parseCsv(text);
          mapping = table.length ? detectMapping(table[0]!.map((h) => h.trim()), body.provider).mapping : {};
        }
      }
      const missing = missingFields(mapping);
      if (missing.length) throw new HttpError(400, `Mapping is missing required column(s): ${missing.join(", ")}`, "fuel_card_rows_invalid", [{ row: 1, field: "header", message: `Missing: ${missing.join(", ")}` }]);

      const { rows, errors } = parseFuelCardCsv(text, mapping);
      if (errors.length) throw new HttpError(400, `${errors.length} problem(s) in the fuel card file; nothing was imported`, "fuel_card_rows_invalid", errors);

      // Exact duplicates of rows already imported for this company are skipped.
      const dates = [...new Set(rows.map((x) => x.date))].map(parseIsoDate);
      const existing = await db.fuelCardTransaction.findMany({ where: { date: { in: dates } }, select: { date: true, amount: true, gallons: true, cardLast4: true, location: true } });
      const seen = new Set(
        existing.map((e) =>
          duplicateKey({ date: e.date.toISOString().slice(0, 10), amount: e.amount === null ? null : formatFixed(e.amount, 2), gallons: e.gallons === null ? null : formatFixed(e.gallons, 3), cardLast4: e.cardLast4, location: e.location }),
        ),
      );
      const fresh = rows.filter((x) => !seen.has(duplicateKey(x)));
      const duplicates = rows.length - fresh.length;
      const version = mappingVersion(body.provider, mapping);

      const fuelCardImport = await db.fuelCardImport.create({
        data: {
          provider: body.provider,
          mappingVersion: version,
          rows: {
            create: fresh.map((x) => ({
              companyId: company.id,
              date: parseIsoDate(x.date),
              location: x.location,
              state: x.state,
              unitNumber: x.unitNumber,
              cardLast4: x.cardLast4,
              fuelType: x.fuelType,
              gallons: x.gallons,
              amount: x.amount,
              raw: x.raw,
            })),
          },
        } as never,
        include: { _count: { select: { rows: true } } },
      });
      if (body.saveMapping === "true") {
        await db.setting.upsert({
          where: { companyId_key: { companyId: company.id, key: settingKey(body.provider) } },
          update: { value: mapping },
          create: { key: settingKey(body.provider), value: mapping },
        } as never);
      }
      await audit(db, {
        action: "upload",
        userId,
        target: `FuelCardImport:${fuelCardImport.id}`,
        meta: { rows: fuelCardImport._count.rows, duplicates, provider: body.provider, mappingVersion: version, filename: req.file?.originalname ?? null, mappingSaved: body.saveMapping === "true" },
        ip: req.ip,
      });
      const matching = await runCardMatching({ prisma, db, companyId: company.id, userId, ip: req.ip });
      res.status(201).json({
        fuelCardImport: { id: fuelCardImport.id, provider: fuelCardImport.provider, mappingVersion: fuelCardImport.mappingVersion, importedAt: fuelCardImport.importedAt, rows: fuelCardImport._count.rows, duplicates },
        matching,
      });
    }),
  );

  r.get(
    "/",
    requireCompany(prisma),
    wrap(async (req: CompanyRequest, res) => {
      const { db } = ctx(req);
      const imports = await db.fuelCardImport.findMany({ orderBy: [{ importedAt: "desc" }, { id: "desc" }], include: { _count: { select: { rows: true } } } });
      const out = [];
      for (const imp of imports) {
        const matched = await db.fuelCardTransaction.count({ where: { importId: imp.id, matches: { some: {} } } });
        out.push({ id: imp.id, provider: imp.provider, mappingVersion: imp.mappingVersion, importedAt: imp.importedAt, rows: imp._count.rows, matched });
      }
      res.json({ imports: out });
    }),
  );

  return r;
}

export function fuelCardTransactionsRouter(prisma: PrismaClient): Router {
  const r = Router({ mergeParams: true });
  r.use(protect);

  r.get(
    "/",
    requireCompany(prisma),
    wrap(async (req: CompanyRequest, res) => {
      const { db } = ctx(req);
      const q = parse(listQuery, req.query, "query");
      let dateRange: { gte: Date; lte: Date } | undefined;
      if (q.periodId) {
        const period = await db.reportingPeriod.findUnique({ where: { id: q.periodId } });
        if (!period) throw notFound("Period");
        dateRange = { gte: period.startDate, lte: period.endDate };
      }
      const rows = await db.fuelCardTransaction.findMany({
        where: {
          ...(q.importId ? { importId: q.importId } : {}),
          ...(dateRange ? { date: dateRange } : {}),
          ...(q.matched === "true" ? { matches: { some: {} } } : q.matched === "false" ? { matches: { none: {} } } : {}),
        },
        orderBy: [{ date: "desc" }, { id: "desc" }],
        take: q.limit + 1,
        ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
        include: { matches: { select: { transactionId: true, score: true, fieldsUsed: true }, orderBy: { createdAt: "asc" }, take: 1 } },
      });
      const hasMore = rows.length > q.limit;
      const out = rows.slice(0, q.limit).map(({ matches, ...row }) => ({
        ...row,
        gallons: row.gallons === null ? null : formatFixed(row.gallons, 3),
        amount: row.amount === null ? null : formatFixed(row.amount, 2),
        match: matches[0] ? { transactionId: matches[0].transactionId, score: formatFixed(matches[0].score, 3), fieldsUsed: matches[0].fieldsUsed } : null,
      }));
      res.json({ rows: out, nextCursor: hasMore ? out[out.length - 1]!.id : null });
    }),
  );

  return r;
}

/** Mounted beside the periods router: POST /:periodId/match. */
export function periodMatchRouter(prisma: PrismaClient): Router {
  const r = Router({ mergeParams: true });
  r.use(protect);

  r.post(
    "/:periodId/match",
    requireCompany(prisma, ...WRITE_ROLES),
    wrap(async (req: CompanyRequest, res) => {
      const { db, company, userId } = ctx(req);
      const period = await db.reportingPeriod.findUnique({ where: { id: req.params.periodId as string } });
      if (!period) throw notFound("Period");
      res.json(await runCardMatching({ prisma, db, companyId: company.id, userId, ip: req.ip, period }));
    }),
  );

  return r;
}
