/**
 * Per-period views: summary, ELD mileage import, IFTA worksheet.
 *
 * GET  /companies/:companyId/periods/:periodId/summary
 * POST /companies/:companyId/periods/:periodId/mileage-imports/preview  multipart `file` (CSV) + `provider` [+ `layout`, `distanceUnit`, `mapping` JSON]
 *      → { headers, sampleRows, layout, detectedMapping, missing, savedMapping, distanceUnit, jurisdictionColumns, parse: {records, errors, skipped, unknownUnits, unitsSeen} }
 * POST /companies/:companyId/periods/:periodId/mileage-imports          multipart `file` + `provider` [+ `layout`, `distanceUnit`, `mapping`, `saveMapping` "true"]
 *      → 201 { mileageImport, superseded: {records, imports}, rules: MileageRulesSummary }
 *      400 mileage_rows_invalid (nothing written) · 409 mileage_duplicate_file (same bytes already active for this period)
 * GET  /companies/:companyId/periods/:periodId/mileage-imports          → { imports: [{id, provider, filename, layout, distanceUnit, mappingVersion, importedAt, rows, activeRows, rowsSkipped}] } newest first
 * GET  /companies/:companyId/periods/:periodId/mileage                  active records only, grouped by vehicle and jurisdiction
 * GET  /companies/:companyId/periods/:periodId/ifta-worksheet           409 I001 when the quarter's rate table is missing
 *
 * Mapping precedence on import: explicit `mapping` > saved Setting
 * `mileage_mapping:<provider>` > header auto-detection. CSV only (no XLSX/PDF).
 */
import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { DISTANCE_UNITS, formatFixed, sum, toDecimal, ZERO } from "@tbo/core";
import { audit } from "../audit/log";
import type { Env } from "../config/env";
import { loadSettings } from "../jobs/extraction";
import { protect } from "../middleware/auth.middleware";
import type { TenantClient } from "../tenant/client";
import { parseCsv } from "./csv-reader";
import { normalizeHeader } from "./fuel-cards";
import { badRequest, HttpError, notFound, parse, wrap } from "./errors";
import { buildIftaWorksheet, IFTA_DISCLAIMER, openErrorCount, type PeriodRow, periodIssueWhere, periodTimestampRange, reviewStatus } from "./ifta";
import { type CompanyRequest, ctx, requireCompany } from "./middleware";
import { detectLayout, detectMileageMapping, fileHash, jurisdictionColumns, MILEAGE_FIELDS, MILEAGE_LAYOUTS, MILEAGE_PROVIDERS, type MileageLayout, type MileageMapping, mileageMappingVersion, type MileageProvider, missingMileageFields, parseMileageCsv, suggestDistanceUnit } from "./mileage";
import { importMileage, reevaluateMileageRules } from "./mileage-rules";
import { countBy, fuelByState, verifiedPercent } from "./summary";

// `parseCsv` lives in ./csv-reader; re-exported so existing imports keep working.
export { parseCsv };

const WRITE_ROLES = ["OWNER", "STAFF", "PARTNER", "ADMIN"] as const;

const providerSchema = z.enum(MILEAGE_PROVIDERS).default("generic");
const mappingSchema = z
  .object(Object.fromEntries(MILEAGE_FIELDS.map((f) => [f, z.string().trim().min(1).max(200).optional()])) as Record<(typeof MILEAGE_FIELDS)[number], z.ZodOptional<z.ZodString>>)
  .strict();
const previewBody = z.object({
  provider: providerSchema,
  layout: z.enum(MILEAGE_LAYOUTS).optional(),
  distanceUnit: z.enum(DISTANCE_UNITS).optional(),
  mapping: z.string().max(5000).optional(),
});
const importBody = previewBody.extend({ saveMapping: z.enum(["true", "false"]).optional() });

const settingKey = (provider: MileageProvider) => `mileage_mapping:${provider}`;

interface SavedMapping {
  layout: MileageLayout;
  distanceUnit: "mi" | "km";
  mapping: MileageMapping;
}
const savedSchema = z.object({ layout: z.enum(MILEAGE_LAYOUTS), distanceUnit: z.enum(DISTANCE_UNITS), mapping: mappingSchema });

async function savedMapping(db: TenantClient, provider: MileageProvider): Promise<SavedMapping | null> {
  const row = await db.setting.findFirst({ where: { key: settingKey(provider) } });
  if (!row) return null;
  const parsed = savedSchema.safeParse(row.value);
  return parsed.success ? { ...parsed.data, mapping: stripUndefined(parsed.data.mapping) } : null;
}

function stripUndefined(m: MileageMapping): MileageMapping {
  const out: MileageMapping = {};
  for (const f of MILEAGE_FIELDS) if (m[f] !== undefined) out[f] = m[f];
  return out;
}

function parseMappingJson(text: string): MileageMapping {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw badRequest("`mapping` must be a JSON object of field → header");
  }
  return stripUndefined(parse(mappingSchema, json, "mapping"));
}

async function loadPeriod(db: TenantClient, periodId: string): Promise<PeriodRow> {
  const period = await db.reportingPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw notFound("Period");
  return period;
}

async function referenceData(prisma: PrismaClient, db: TenantClient) {
  const vehicles = await db.vehicle.findMany({ select: { id: true, unitNumber: true } });
  const jurisdictionRows = await prisma.jurisdiction.findMany({ select: { code: true, name: true } });
  const vehicleIdByUnit = new Map(vehicles.map((v) => [v.unitNumber.toLowerCase(), v.id]));
  const knownUnits = new Map(vehicles.map((v) => [v.unitNumber, v.id]));
  const jurisdictions = new Map(jurisdictionRows.map((j) => [j.code, j.name]));
  return { vehicleIdByUnit, knownUnits, jurisdictions };
}

/** Resolve layout, unit and mapping for a file: explicit choice > saved mapping > detection. */
async function resolveChoices(db: TenantClient, headers: string[], jurisdictions: ReadonlyMap<string, string>, body: z.infer<typeof previewBody>) {
  const saved = await savedMapping(db, body.provider);
  // A remembered mapping only applies when every column it names is in this file; otherwise the headers changed and we detect afresh.
  const normalized = new Set(headers.map(normalizeHeader));
  const savedFits = saved !== null && Object.values(saved.mapping).every((h) => h === undefined || normalized.has(normalizeHeader(h)));
  const layout: MileageLayout = body.layout ?? (savedFits ? saved!.layout : detectLayout(headers, jurisdictions));
  const detected = detectMileageMapping(headers, body.provider, layout);
  const mapping: MileageMapping = body.mapping !== undefined ? parseMappingJson(body.mapping) : savedFits && saved!.layout === layout ? saved!.mapping : detected.mapping;
  const distanceUnit = body.distanceUnit ?? saved?.distanceUnit ?? suggestDistanceUnit(mapping);
  return { saved, layout, detected, mapping, distanceUnit };
}

const periodBounds = (p: PeriodRow) => ({ start: p.startDate.toISOString().slice(0, 10), end: p.endDate.toISOString().slice(0, 10) });

export function periodsRouter(prisma: PrismaClient, env: Env): Router {
  const r = Router({ mergeParams: true });
  r.use(protect);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 } });

  r.get(
    "/:periodId/summary",
    requireCompany(prisma),
    wrap(async (req: CompanyRequest, res) => {
      const { db } = ctx(req);
      const period = await loadPeriod(db, req.params.periodId as string);
      const received = periodTimestampRange(period);

      const docGroups = await db.document.groupBy({ by: ["status"], where: { receivedAt: received, deletedAt: null }, _count: { _all: true } });
      const txGroups = await db.transaction.groupBy({ by: ["status"], where: { periodId: period.id }, _count: { _all: true } });
      const issueGroups = await db.issue.groupBy({ by: ["severity"], where: { status: "OPEN", ...periodIssueWhere(period) }, _count: { _all: true } });
      const lines = await db.transaction.findMany({
        where: { periodId: period.id },
        select: { state: true, lines: { select: { category: true, quantity: true, amount: true } } },
      });
      const unassigned = await db.transaction.count({ where: { periodId: period.id, state: null } });

      const docByStatus = countBy(docGroups.map((g) => ({ key: g.status, count: g._count._all })), ["RECEIVED", "PROCESSING", "PROCESSED", "FAILED", "UNREADABLE"] as const);
      const txByStatus = countBy(txGroups.map((g) => ({ key: g.status, count: g._count._all })), ["VERIFIED", "NEEDS_ATTENTION", "UNABLE_TO_VERIFY"] as const);
      const txTotal = Object.values(txByStatus).reduce((a, b) => a + b, 0);

      res.json({
        period,
        documents: { total: Object.values(docByStatus).reduce((a, b) => a + b, 0), byStatus: docByStatus },
        transactions: { total: txTotal, byStatus: txByStatus, verifiedPercent: verifiedPercent(txByStatus.VERIFIED, txTotal) },
        openIssues: countBy(issueGroups.map((g) => ({ key: g.severity, count: g._count._all })), ["ERROR", "WARNING", "INFO"] as const),
        fuelByState: fuelByState(lines.flatMap((t) => t.lines.map((l) => ({ state: t.state, category: l.category, quantity: l.quantity, amount: l.amount })))),
        unassigned,
      });
    }),
  );

  r.post(
    "/:periodId/mileage-imports/preview",
    requireCompany(prisma, ...WRITE_ROLES),
    upload.single("file"),
    wrap(async (req: CompanyRequest, res) => {
      const { db } = ctx(req);
      const period = await loadPeriod(db, req.params.periodId as string);
      const body = parse(previewBody, req.body ?? {}, "mileage preview");
      const file = req.file;
      if (!file) throw badRequest("No file received. Send a CSV in the `file` field.");
      const text = file.buffer.toString("utf8");
      const table = parseCsv(text);
      if (table.length === 0) throw badRequest("The file is empty");
      const headers = table[0]!.map((h) => h.trim());
      const { knownUnits, jurisdictions } = await referenceData(prisma, db);
      const { saved, layout, detected, mapping, distanceUnit } = await resolveChoices(db, headers, jurisdictions, body);
      const parsed = parseMileageCsv(text, { layout, mapping, distanceUnit, knownUnits, jurisdictions, period: periodBounds(period) });
      res.json({
        headers,
        sampleRows: table.slice(1, 6),
        layout,
        detectedMapping: detected.mapping,
        mapping,
        missing: missingMileageFields(mapping, layout),
        savedMapping: saved,
        distanceUnit,
        jurisdictionColumns: layout === "wide" ? jurisdictionColumns(headers, jurisdictions) : [],
        parse: { records: parsed.records, errors: parsed.errors, skipped: parsed.skipped, unknownUnits: parsed.unknownUnits, unitsSeen: parsed.unitsSeen },
      });
    }),
  );

  r.post(
    "/:periodId/mileage-imports",
    requireCompany(prisma, ...WRITE_ROLES),
    upload.single("file"),
    wrap(async (req: CompanyRequest, res) => {
      const { db, company, userId } = ctx(req);
      const period = await loadPeriod(db, req.params.periodId as string);
      const file = req.file;
      if (!file) throw badRequest("No file received. Send a CSV in the `file` field.");
      const body = parse(importBody, req.body ?? {}, "mileage import");
      const text = file.buffer.toString("utf8");
      const table = parseCsv(text);
      if (table.length === 0) throw new HttpError(400, "The file is empty", "mileage_rows_invalid", [{ row: 0, field: "file", message: "The file is empty" }]);
      const headers = table[0]!.map((h) => h.trim());
      const { vehicleIdByUnit, knownUnits, jurisdictions } = await referenceData(prisma, db);
      const { layout, mapping, distanceUnit } = await resolveChoices(db, headers, jurisdictions, body);

      const parsed = parseMileageCsv(text, { layout, mapping, distanceUnit, knownUnits, jurisdictions, period: periodBounds(period) });
      if (parsed.errors.length) {
        throw new HttpError(400, `${parsed.errors.length} problem(s) in the mileage file; nothing was imported`, "mileage_rows_invalid", { errors: parsed.errors, unknownUnits: parsed.unknownUnits });
      }

      const hash = fileHash(file.buffer);
      const sameFile = await db.mileageImport.findFirst({ where: { periodId: period.id, fileHash: hash, records: { some: { supersededAt: null } } }, select: { id: true, importedAt: true } });
      if (sameFile) throw new HttpError(409, `This exact file was already imported on ${sameFile.importedAt.toISOString().slice(0, 10)} and is still in use.`, "mileage_duplicate_file", { importId: sameFile.id, importedAt: sameFile.importedAt });

      const version = mileageMappingVersion(body.provider, layout, distanceUnit, mapping);
      const result = await importMileage({
        db,
        companyId: company.id,
        period,
        provider: body.provider,
        filename: file.originalname ?? null,
        mappingVersion: version,
        fileHash: hash,
        layout,
        distanceUnit,
        rowsSkipped: parsed.skipped,
        records: parsed.records,
        vehicleIdByUnit,
      });
      if (body.saveMapping === "true") {
        const value: SavedMapping = { layout, distanceUnit, mapping };
        await db.setting.upsert({
          where: { companyId_key: { companyId: company.id, key: settingKey(body.provider) } },
          update: { value },
          create: { key: settingKey(body.provider), value },
        } as never);
      }
      const rules = await reevaluateMileageRules({ prisma, db, companyId: company.id, period, settings: await loadSettings(prisma, company.id, env), userId });
      await audit(db, {
        action: "upload",
        userId,
        target: `MileageImport:${result.importId}`,
        meta: { rows: result.rows, skipped: parsed.skipped, provider: body.provider, layout, distanceUnit, mappingVersion: version, periodId: period.id, filename: file.originalname, supersededRecords: result.supersededRecords, mappingSaved: body.saveMapping === "true", rules },
        ip: req.ip,
      });
      res.status(201).json({
        mileageImport: { id: result.importId, provider: body.provider, layout, distanceUnit, mappingVersion: version, importedAt: result.importedAt, rows: result.rows, skipped: parsed.skipped },
        superseded: { records: result.supersededRecords, imports: result.supersededImports },
        rules,
      });
    }),
  );

  r.get(
    "/:periodId/mileage-imports",
    requireCompany(prisma),
    wrap(async (req: CompanyRequest, res) => {
      const { db } = ctx(req);
      const period = await loadPeriod(db, req.params.periodId as string);
      const imports = await db.mileageImport.findMany({
        where: { OR: [{ periodId: period.id }, { periodId: null, records: { some: { periodStart: { gte: period.startDate }, periodEnd: { lte: period.endDate } } } }] },
        orderBy: [{ importedAt: "desc" }, { id: "desc" }],
        include: { _count: { select: { records: true } } },
      });
      const out = [];
      for (const imp of imports) {
        const activeRows = await db.mileageRecord.count({ where: { importId: imp.id, supersededAt: null } });
        out.push({ id: imp.id, provider: imp.provider, filename: imp.filename, layout: imp.layout, distanceUnit: imp.distanceUnit, mappingVersion: imp.mappingVersion, importedAt: imp.importedAt, rows: imp._count.records, activeRows, rowsSkipped: imp.rowsSkipped });
      }
      res.json({ imports: out });
    }),
  );

  r.get(
    "/:periodId/mileage",
    requireCompany(prisma),
    wrap(async (req: CompanyRequest, res) => {
      const { db } = ctx(req);
      const period = await loadPeriod(db, req.params.periodId as string);
      const records = await db.mileageRecord.findMany({
        where: { periodStart: { gte: period.startDate }, periodEnd: { lte: period.endDate }, supersededAt: null },
        include: { vehicle: { select: { id: true, unitNumber: true } }, import: { select: { id: true, provider: true, importedAt: true } } },
        orderBy: [{ vehicle: { unitNumber: "asc" } }, { jurisdiction: "asc" }, { id: "asc" }],
      });
      type Dec = ReturnType<typeof toDecimal>;
      const byVehicle = new Map<string, { vehicleId: string; unitNumber: string; jurisdictions: string[]; totalMiles: Dec; taxableMiles: Dec }>();
      const byJurisdiction = new Map<string, { jurisdiction: string; totalMiles: Dec; taxableMiles: Dec }>();
      for (const rec of records) {
        const v = byVehicle.get(rec.vehicleId) ?? { vehicleId: rec.vehicleId, unitNumber: rec.vehicle.unitNumber, jurisdictions: [], totalMiles: ZERO, taxableMiles: ZERO };
        v.totalMiles = v.totalMiles.plus(rec.totalMiles);
        v.taxableMiles = v.taxableMiles.plus(rec.taxableMiles);
        if (!v.jurisdictions.includes(rec.jurisdiction)) v.jurisdictions.push(rec.jurisdiction);
        byVehicle.set(rec.vehicleId, v);
        const j = byJurisdiction.get(rec.jurisdiction) ?? { jurisdiction: rec.jurisdiction, totalMiles: ZERO, taxableMiles: ZERO };
        j.totalMiles = j.totalMiles.plus(rec.totalMiles);
        j.taxableMiles = j.taxableMiles.plus(rec.taxableMiles);
        byJurisdiction.set(rec.jurisdiction, j);
      }
      const fmt = <T extends { totalMiles: Dec; taxableMiles: Dec }>(x: T) => ({ ...x, totalMiles: formatFixed(x.totalMiles, 3), taxableMiles: formatFixed(x.taxableMiles, 3) });
      res.json({
        period: { id: period.id, startDate: period.startDate, endDate: period.endDate },
        records: records.map((rec) => ({ ...rec, totalMiles: formatFixed(rec.totalMiles, 3), taxableMiles: formatFixed(rec.taxableMiles, 3) })),
        byVehicle: [...byVehicle.values()].sort((a, b) => a.unitNumber.localeCompare(b.unitNumber)).map(fmt),
        byJurisdiction: [...byJurisdiction.values()].sort((a, b) => a.jurisdiction.localeCompare(b.jurisdiction)).map(fmt),
        totals: { totalMiles: formatFixed(sum(records.map((x) => x.totalMiles)), 3), taxableMiles: formatFixed(sum(records.map((x) => x.taxableMiles)), 3) },
      });
    }),
  );

  r.get(
    "/:periodId/ifta-worksheet",
    requireCompany(prisma),
    wrap(async (req: CompanyRequest, res) => {
      const { db } = ctx(req);
      const period = await loadPeriod(db, req.params.periodId as string);
      const built = await buildIftaWorksheet(db, period);
      if (!built.ok) {
        res.status(409).json({ error: "ifta_rates_missing", code: "I001", quarter: built.quarter, message: `No IFTA rate table is loaded for ${built.quarter}. Load the official table before preparing the worksheet.` });
        return;
      }
      const status = await reviewStatus(db, period);
      res.json({
        status,
        period: { id: period.id, startDate: period.startDate, endDate: period.endDate, status: period.status },
        openErrorIssues: await openErrorCount(db, period),
        unassignedTransactions: built.unassignedTransactions,
        worksheet: built.worksheet,
        rateSource: built.rateSource,
        disclaimer: IFTA_DISCLAIMER,
      });
    }),
  );

  return r;
}
