/**
 * ELD mileage: the DB side of the import and the M-rules that depend on it.
 *
 *  - `importMileage`: writes a MileageImport with its records for a period and
 *    supersedes (never deletes) earlier records of the same period for the
 *    vehicles the new file covers. Different vehicles from different files
 *    (two ELD providers) coexist.
 *  - `loadMileageContext`: the RuleContext.mileage block for one vehicle in a
 *    period, from active (non-superseded) records. Used by the extraction
 *    reconcile job so M001/M002 fire as soon as mileage exists.
 *  - `reevaluateMileageRules`: after an import, re-runs M001/M002 on every fuel
 *    transaction of the period with a vehicle, M003 once for the fleet, and
 *    refreshes transaction status from the open ERROR issues. Human-handled
 *    issues (RESOLVED/ACCEPTED) are left alone.
 */
import type { PrismaClient } from "@prisma/client";
import { computeIftaWorksheet, formatFixed, M001, M002, M003, type RuleContext, type RuleIssue, type RuleSettings, type RuleTransaction, toDecimal } from "@tbo/core";
import type { TenantClient } from "../tenant/client";
import type { PeriodRow } from "./ifta";
import type { MileageLayout, ParsedMileageRecord } from "./mileage";

export interface ImportMileageArgs {
  db: TenantClient;
  companyId: string;
  period: PeriodRow;
  provider: string;
  filename: string | null;
  mappingVersion: string;
  fileHash: string;
  layout: MileageLayout;
  distanceUnit: "mi" | "km";
  rowsSkipped: number;
  records: ParsedMileageRecord[];
  /** unitNumber (lower-case) → vehicleId */
  vehicleIdByUnit: ReadonlyMap<string, string>;
}

export interface ImportMileageResult {
  importId: string;
  importedAt: Date;
  rows: number;
  /** Earlier records of the same period and vehicles that this import replaced. */
  supersededRecords: number;
  supersededImports: number;
}

export async function importMileage(a: ImportMileageArgs): Promise<ImportMileageResult> {
  const vehicleIds = [...new Set(a.records.map((r) => a.vehicleIdByUnit.get(r.unit.toLowerCase())!))];
  const created = await a.db.mileageImport.create({
    data: {
      provider: a.provider,
      periodId: a.period.id,
      filename: a.filename,
      mappingVersion: a.mappingVersion,
      fileHash: a.fileHash,
      layout: a.layout,
      distanceUnit: a.distanceUnit,
      rowsSkipped: a.rowsSkipped,
      records: {
        create: a.records.map((r) => ({
          companyId: a.companyId,
          vehicleId: a.vehicleIdByUnit.get(r.unit.toLowerCase())!,
          jurisdiction: r.jurisdiction,
          periodStart: a.period.startDate,
          periodEnd: a.period.endDate,
          totalMiles: r.totalMiles,
          taxableMiles: r.taxableMiles,
        })),
      },
    } as never,
    include: { _count: { select: { records: true } } },
  });

  const now = new Date();
  const toSupersede = await a.db.mileageRecord.findMany({
    where: { importId: { not: created.id }, vehicleId: { in: vehicleIds }, periodStart: { gte: a.period.startDate }, periodEnd: { lte: a.period.endDate }, supersededAt: null },
    select: { id: true, importId: true },
  });
  if (toSupersede.length) {
    await a.db.mileageRecord.updateMany({ where: { id: { in: toSupersede.map((r) => r.id) } }, data: { supersededAt: now, supersededByImportId: created.id } });
  }
  return {
    importId: created.id,
    importedAt: created.importedAt,
    rows: created._count.records,
    supersededRecords: toSupersede.length,
    supersededImports: new Set(toSupersede.map((r) => r.importId)).size,
  };
}

/** Active records inside the period, grouped per vehicle. */
export async function activeMileage(db: TenantClient, period: PeriodRow) {
  return db.mileageRecord.findMany({
    where: { periodStart: { gte: period.startDate }, periodEnd: { lte: period.endDate }, supersededAt: null },
    select: { vehicleId: true, jurisdiction: true, totalMiles: true, taxableMiles: true },
    orderBy: [{ vehicleId: "asc" }, { jurisdiction: "asc" }],
  });
}

type ActiveRecord = Awaited<ReturnType<typeof activeMileage>>[number];

function perVehicle(records: ActiveRecord[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const r of records) {
    const set = out.get(r.vehicleId) ?? new Set<string>();
    if (toDecimal(r.totalMiles.toString()).gt(0)) set.add(r.jurisdiction);
    out.set(r.vehicleId, set);
  }
  return out;
}

/**
 * RuleContext.mileage for one vehicle. Null (M-rules silent) when the vehicle
 * is unknown (V-rules already flag a missing unit) or when the period has no
 * mileage at all yet: ELD reports arrive at quarter end, and flagging every
 * receipt M001 until then would be noise. Once the quarter's mileage is in,
 * new receipts are checked immediately. `fleetMpg` is left null here; M003 is
 * evaluated fleet-wide by `reevaluateMileageRules`.
 */
export async function loadMileageContext(db: TenantClient, period: PeriodRow | null, vehicleId: string | null): Promise<RuleContext["mileage"]> {
  if (!period || !vehicleId) return null;
  const records = await activeMileage(db, period);
  if (records.length === 0) return null;
  const byVehicle = perVehicle(records);
  const jurisdictions = byVehicle.get(vehicleId);
  return { vehicleHasMileage: jurisdictions !== undefined, jurisdictionsWithMiles: jurisdictions ?? new Set<string>(), fleetMpg: null };
}

export interface MileageRulesSummary {
  transactionsChecked: number;
  fleetMpg: string | null;
  opened: Record<"M001" | "M002" | "M003", number>;
  resolved: number;
}

export interface ReevaluateArgs {
  prisma: PrismaClient;
  db: TenantClient;
  companyId: string;
  period: PeriodRow;
  settings: RuleSettings;
  userId: string;
}

const M_CODES = new Set(["M001", "M002"]);
const RESOLUTION = "No longer flagged after the mileage import";

function skeletonTx(tx: { state: string | null; unitNumber: string | null; lines: Array<{ category: string; quantity: unknown; unit: string | null; fuelType: string | null }> }): RuleTransaction {
  return {
    date: null,
    vendor: null,
    sellerAddress: null,
    state: tx.state,
    stateSource: tx.state ? "printed" : null,
    unitNumber: tx.unitNumber,
    unitSource: tx.unitNumber ? "receipt" : null,
    purchaserName: null,
    receiptTotal: null,
    currency: null,
    odometer: null,
    lines: tx.lines.map((l) => ({ category: l.category as RuleTransaction["lines"][number]["category"], fuelType: l.fuelType, quantity: l.quantity === null ? null : String(l.quantity), unit: l.unit as "gal" | "L" | "each" | null, unitPrice: null, amount: null })),
    fieldLegibility: {},
    passValues: null,
    imageQualityScore: null,
  };
}

export async function reevaluateMileageRules({ prisma, db, companyId, period, settings, userId }: ReevaluateArgs): Promise<MileageRulesSummary> {
  const jurisdictions = new Set((await prisma.jurisdiction.findMany({ select: { code: true } })).map((j) => j.code));
  const records = await activeMileage(db, period);
  const byVehicle = perVehicle(records);
  const txs = await db.transaction.findMany({
    where: { periodId: period.id, type: "FUEL" },
    select: { id: true, state: true, status: true, vehicleId: true, unitNumberRaw: true, vehicle: { select: { unitNumber: true } }, lines: { select: { category: true, quantity: true, unit: true, fuelType: true } } },
    orderBy: { id: "asc" },
  });

  // Fleet MPG with the same arithmetic as the worksheet (motor fuel only, rates not needed).
  const fuel = txs.flatMap((t) => (t.state ? t.lines.filter((l) => l.category === "MOTOR_FUEL" && l.quantity !== null && l.unit !== "L").map((l) => ({ jurisdiction: t.state!, gallons: String(l.quantity) })) : []));
  const worksheet = computeIftaWorksheet({ mileage: records.map((r) => ({ vehicleId: r.vehicleId, jurisdiction: r.jurisdiction, totalMiles: r.totalMiles, taxableMiles: r.taxableMiles })), fuel, rates: null });
  const fleetMpg = worksheet.fleetMpg === null ? null : formatFixed(worksheet.fleetMpg, 2);

  const summary: MileageRulesSummary = { transactionsChecked: 0, fleetMpg, opened: { M001: 0, M002: 0, M003: 0 }, resolved: 0 };
  const now = new Date();
  const base: Omit<RuleContext, "mileage"> = { period: { start: period.startDate.toISOString().slice(0, 10), end: period.endDate.toISOString().slice(0, 10) }, jurisdictions, vehicle: null, settings };

  const apply = async (transactionId: string | null, produced: RuleIssue[], codes: ReadonlySet<string>, extraWhere: Record<string, unknown>) => {
    const open = await db.issue.findMany({ where: { status: "OPEN", code: { in: [...codes] }, ...extraWhere } });
    const producedCodes = new Set(produced.map((i) => i.code));
    for (const o of open) {
      if (producedCodes.has(o.code)) continue;
      await db.issue.update({ where: { id: o.id }, data: { status: "RESOLVED", resolvedBy: userId, resolvedAt: now, resolutionNote: RESOLUTION } });
      summary.resolved += 1;
    }
    for (const i of produced) {
      const match = open.find((o) => o.code === i.code);
      if (match) await db.issue.update({ where: { id: match.id }, data: { message: i.message, fields: i.fields, evidence: i.evidence as never, ruleVersion: i.ruleVersion } });
      else {
        await db.issue.create({ data: { companyId, transactionId, documentId: null, code: i.code, ruleVersion: i.ruleVersion, severity: i.severity, message: i.message, fields: i.fields, evidence: i.evidence as never } });
        summary.opened[i.code as "M001" | "M002" | "M003"] += 1;
      }
    }
  };

  for (const t of txs) {
    if (!t.vehicleId) continue;
    summary.transactionsChecked += 1;
    const jur = byVehicle.get(t.vehicleId);
    const ctx: RuleContext = { ...base, mileage: { vehicleHasMileage: jur !== undefined, jurisdictionsWithMiles: jur ?? new Set<string>(), fleetMpg: null } };
    const ruleTx = skeletonTx({ state: t.state, unitNumber: t.vehicle?.unitNumber ?? t.unitNumberRaw, lines: t.lines });
    const produced = [...M001.check(ruleTx, ctx), ...M002.check(ruleTx, ctx)];
    await apply(t.id, produced, M_CODES, { transactionId: t.id });

    if (t.status !== "UNABLE_TO_VERIFY") {
      const openErrors = await db.issue.count({ where: { transactionId: t.id, status: "OPEN", severity: "ERROR" } });
      const next = openErrors > 0 ? "NEEDS_ATTENTION" : "VERIFIED";
      if (next !== t.status) await db.transaction.update({ where: { id: t.id }, data: { status: next, ...(next === "VERIFIED" ? { verifiedAt: now } : {}) } });
    }
  }

  // M003 once per period, as a period-level issue (evidence.periodId) with no transaction.
  const fleetCtx: RuleContext = { ...base, mileage: { vehicleHasMileage: true, jurisdictionsWithMiles: new Set<string>(), fleetMpg } };
  const m003 = M003.check(skeletonTx({ state: null, unitNumber: null, lines: [] }), fleetCtx).map((i) => ({ ...i, evidence: { ...i.evidence, periodId: period.id } }));
  await apply(null, m003, new Set(["M003"]), { transactionId: null, evidence: { path: ["periodId"], equals: period.id } });

  return summary;
}
