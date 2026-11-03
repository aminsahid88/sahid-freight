/**
 * Per-period views: summary, mileage import, IFTA worksheet.
 *
 * GET  /companies/:companyId/periods/:periodId/summary
 * POST /companies/:companyId/periods/:periodId/mileage-imports   multipart `file` (CSV) + `provider`
 * GET  /companies/:companyId/periods/:periodId/mileage
 * GET  /companies/:companyId/periods/:periodId/ifta-worksheet     409 I001 when the quarter's rate table is missing
 */
import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { formatFixed, sum, toDecimal, ZERO } from "@tbo/core";
import { audit } from "../audit/log";
import type { Env } from "../config/env";
import { protect } from "../middleware/auth.middleware";
import type { TenantClient } from "../tenant/client";
import { badRequest, HttpError, notFound, parse, wrap } from "./errors";
import { buildIftaWorksheet, IFTA_DISCLAIMER, openErrorCount, type PeriodRow, periodIssueWhere, periodTimestampRange, reviewStatus } from "./ifta";
import { type CompanyRequest, ctx, requireCompany } from "./middleware";
import { countBy, fuelByState, verifiedPercent } from "./summary";

// ── Small RFC 4180 reader (no dependency) ────────────────────────────────────

/** Parse CSV text into rows of cells. Handles quoted fields, doubled quotes, CR/LF/CRLF, and a UTF-8 BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // Drop fully blank lines.
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

const HEADER_ALIASES: Record<"unit" | "jurisdiction" | "total_miles" | "taxable_miles", string[]> = {
  unit: ["unit", "unit_number", "unitnumber", "unit number", "vehicle", "truck", "unit_no", "unit no"],
  jurisdiction: ["jurisdiction", "state", "province", "juris"],
  total_miles: ["total_miles", "miles", "total miles", "totalmiles", "distance"],
  taxable_miles: ["taxable_miles", "taxable miles", "taxablemiles", "taxable"],
};

export interface MileageRowError {
  row: number;
  field: string;
  message: string;
}

export interface ParsedMileageRow {
  row: number;
  unit: string;
  jurisdiction: string;
  totalMiles: string;
  taxableMiles: string;
}

const MILES = /^\d{1,9}(\.\d{1,3})?$/;

/** Map the header row onto the generic columns; returns null for a missing required column. */
export function mapMileageHeader(header: string[]): { index: Record<keyof typeof HEADER_ALIASES, number>; missing: string[] } {
  const norm = header.map((h) => h.trim().toLowerCase().replace(/[-\s]+/g, "_"));
  const index = { unit: -1, jurisdiction: -1, total_miles: -1, taxable_miles: -1 };
  for (const key of Object.keys(HEADER_ALIASES) as Array<keyof typeof HEADER_ALIASES>) {
    const aliases = HEADER_ALIASES[key].map((a) => a.replace(/[-\s]+/g, "_"));
    index[key] = norm.findIndex((h) => aliases.includes(h));
  }
  const missing = (["unit", "jurisdiction", "total_miles"] as const).filter((k) => index[k] < 0);
  return { index, missing };
}

export function parseMileageCsv(text: string, knownUnits: Set<string>, knownJurisdictions: Set<string>): { rows: ParsedMileageRow[]; errors: MileageRowError[] } {
  const errors: MileageRowError[] = [];
  const rows: ParsedMileageRow[] = [];
  const table = parseCsv(text);
  if (table.length === 0) return { rows, errors: [{ row: 0, field: "file", message: "The file is empty" }] };
  const { index, missing } = mapMileageHeader(table[0]!);
  if (missing.length) return { rows, errors: [{ row: 1, field: "header", message: `Missing column(s): ${missing.join(", ")}. Expected unit, jurisdiction, total_miles[, taxable_miles].` }] };
  for (let i = 1; i < table.length; i++) {
    const line = table[i]!;
    const rowNo = i + 1;
    const unit = (line[index.unit] ?? "").trim();
    const jurisdiction = (line[index.jurisdiction] ?? "").trim().toUpperCase();
    const totalMiles = (line[index.total_miles] ?? "").trim().replace(/,/g, "");
    const taxableRaw = index.taxable_miles >= 0 ? (line[index.taxable_miles] ?? "").trim().replace(/,/g, "") : "";
    const taxableMiles = taxableRaw === "" ? totalMiles : taxableRaw;
    if (!unit) errors.push({ row: rowNo, field: "unit", message: "unit is empty" });
    else if (!knownUnits.has(unit)) errors.push({ row: rowNo, field: "unit", message: `unit "${unit}" does not match any vehicle of this company` });
    if (!/^[A-Z]{2}$/.test(jurisdiction)) errors.push({ row: rowNo, field: "jurisdiction", message: `jurisdiction "${jurisdiction}" must be a 2-letter code` });
    else if (!knownJurisdictions.has(jurisdiction)) errors.push({ row: rowNo, field: "jurisdiction", message: `jurisdiction "${jurisdiction}" is not a known IFTA jurisdiction` });
    if (!MILES.test(totalMiles)) errors.push({ row: rowNo, field: "total_miles", message: `total_miles "${totalMiles}" must be a non-negative decimal (up to 3 places)` });
    if (!MILES.test(taxableMiles)) errors.push({ row: rowNo, field: "taxable_miles", message: `taxable_miles "${taxableMiles}" must be a non-negative decimal (up to 3 places)` });
    else if (MILES.test(totalMiles) && toDecimal(taxableMiles).gt(toDecimal(totalMiles))) errors.push({ row: rowNo, field: "taxable_miles", message: "taxable_miles cannot exceed total_miles" });
    rows.push({ row: rowNo, unit, jurisdiction, totalMiles, taxableMiles });
  }
  if (rows.length === 0) errors.push({ row: 1, field: "file", message: "The file has a header but no data rows" });
  return { rows, errors };
}

// ── Router ───────────────────────────────────────────────────────────────────

const importBody = z.object({ provider: z.string().trim().min(1).max(40).default("generic") });

async function loadPeriod(db: TenantClient, periodId: string): Promise<PeriodRow> {
  const period = await db.reportingPeriod.findUnique({ where: { id: periodId } });
  if (!period) throw notFound("Period");
  return period;
}

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
    "/:periodId/mileage-imports",
    requireCompany(prisma, "OWNER", "STAFF", "PARTNER", "ADMIN"),
    upload.single("file"),
    wrap(async (req: CompanyRequest, res) => {
      const { db, company, userId } = ctx(req);
      const period = await loadPeriod(db, req.params.periodId as string);
      const file = req.file;
      if (!file) throw badRequest("No file received. Send a CSV in the `file` field.");
      const body = parse(importBody, req.body ?? {}, "mileage import");

      const vehicles = await db.vehicle.findMany({ select: { id: true, unitNumber: true } });
      const jurisdictions = await prisma.jurisdiction.findMany({ select: { code: true } });
      const byUnit = new Map(vehicles.map((v) => [v.unitNumber, v.id]));
      const { rows, errors } = parseMileageCsv(file.buffer.toString("utf8"), new Set(byUnit.keys()), new Set(jurisdictions.map((j) => j.code)));
      if (errors.length) throw new HttpError(400, `${errors.length} problem(s) in the mileage file; nothing was imported`, "mileage_rows_invalid", errors);

      const mileageImport = await db.mileageImport.create({
        data: {
          provider: body.provider,
          records: {
            create: rows.map((row) => ({
              companyId: company.id,
              vehicleId: byUnit.get(row.unit)!,
              jurisdiction: row.jurisdiction,
              periodStart: period.startDate,
              periodEnd: period.endDate,
              totalMiles: row.totalMiles,
              taxableMiles: row.taxableMiles,
            })),
          },
        } as never,
        include: { _count: { select: { records: true } } },
      });
      await audit(db, {
        action: "upload",
        userId,
        target: `MileageImport:${mileageImport.id}`,
        meta: { rows: rows.length, provider: body.provider, periodId: period.id, filename: file.originalname },
        ip: req.ip,
      });
      res.status(201).json({ mileageImport: { id: mileageImport.id, provider: mileageImport.provider, importedAt: mileageImport.importedAt, rows: mileageImport._count.records } });
    }),
  );

  r.get(
    "/:periodId/mileage",
    requireCompany(prisma),
    wrap(async (req: CompanyRequest, res) => {
      const { db } = ctx(req);
      const period = await loadPeriod(db, req.params.periodId as string);
      const records = await db.mileageRecord.findMany({
        where: { periodStart: { gte: period.startDate }, periodEnd: { lte: period.endDate } },
        include: { vehicle: { select: { id: true, unitNumber: true } }, import: { select: { id: true, provider: true, importedAt: true } } },
        orderBy: [{ vehicle: { unitNumber: "asc" } }, { jurisdiction: "asc" }, { id: "asc" }],
      });
      const byVehicle = new Map<string, { vehicleId: string; unitNumber: string; totalMiles: ReturnType<typeof toDecimal>; taxableMiles: ReturnType<typeof toDecimal> }>();
      const byJurisdiction = new Map<string, { jurisdiction: string; totalMiles: ReturnType<typeof toDecimal>; taxableMiles: ReturnType<typeof toDecimal> }>();
      for (const rec of records) {
        const v = byVehicle.get(rec.vehicleId) ?? { vehicleId: rec.vehicleId, unitNumber: rec.vehicle.unitNumber, totalMiles: ZERO, taxableMiles: ZERO };
        v.totalMiles = v.totalMiles.plus(rec.totalMiles);
        v.taxableMiles = v.taxableMiles.plus(rec.taxableMiles);
        byVehicle.set(rec.vehicleId, v);
        const j = byJurisdiction.get(rec.jurisdiction) ?? { jurisdiction: rec.jurisdiction, totalMiles: ZERO, taxableMiles: ZERO };
        j.totalMiles = j.totalMiles.plus(rec.totalMiles);
        j.taxableMiles = j.taxableMiles.plus(rec.taxableMiles);
        byJurisdiction.set(rec.jurisdiction, j);
      }
      const fmt = <T extends { totalMiles: ReturnType<typeof toDecimal>; taxableMiles: ReturnType<typeof toDecimal> }>(x: T) => ({ ...x, totalMiles: formatFixed(x.totalMiles, 3), taxableMiles: formatFixed(x.taxableMiles, 3) });
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
