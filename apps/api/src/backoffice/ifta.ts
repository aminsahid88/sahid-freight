/**
 * Loads a reporting period's IFTA inputs through the tenant client and hands
 * them to the pure `computeIftaWorksheet` in @tbo/core.
 *
 *  - Mileage: active (non-superseded) MileageRecord rows whose [periodStart, periodEnd] lies inside the period.
 *  - Fuel: TransactionLine rows with category MOTOR_FUEL only (reefer fuel and
 *    DEF never count), from transactions assigned to the period that have a state.
 *  - Rates: IftaRate rows for the quarter label of the period start and the
 *    fuel type "diesel". No rows → rule I001; the caller answers 409.
 *
 * Review status: REVIEWED only when the period is APPROVED and no open ERROR
 * issue touches the period; otherwise PRELIMINARY.
 */
import type { PeriodStatus, ReportStatus } from "@prisma/client";
import { computeIftaWorksheet, type IftaWorksheetJson, iftaWorksheetToJson, quarterOf } from "@tbo/core";
import type { TenantClient } from "../tenant/client";

export const IFTA_DISCLAIMER = "Prepared for review by a qualified preparer; not a filed return.";
export const IFTA_FUEL_TYPE = "diesel";

export interface PeriodRow {
  id: string;
  startDate: Date;
  endDate: Date;
  status: PeriodStatus;
}

/** Half-open timestamp range covering the period's calendar days (for `receivedAt`). */
export function periodTimestampRange(period: PeriodRow): { gte: Date; lt: Date } {
  const lt = new Date(period.endDate.getTime());
  lt.setUTCDate(lt.getUTCDate() + 1);
  return { gte: period.startDate, lt };
}

/** Issues "in" a period: on a transaction assigned to it, or on a document received during it. */
export function periodIssueWhere(period: PeriodRow) {
  return { OR: [{ transaction: { periodId: period.id } }, { document: { receivedAt: periodTimestampRange(period) } }, { transactionId: null, documentId: null, evidence: { path: ["periodId"], equals: period.id } }] };
}

export async function openErrorCount(db: TenantClient, period: PeriodRow): Promise<number> {
  return db.issue.count({ where: { status: "OPEN", severity: "ERROR", ...periodIssueWhere(period) } });
}

export async function reviewStatus(db: TenantClient, period: PeriodRow): Promise<ReportStatus> {
  if (period.status !== "APPROVED") return "PRELIMINARY";
  return (await openErrorCount(db, period)) === 0 ? "REVIEWED" : "PRELIMINARY";
}

export interface RateSource {
  quarter: string;
  fuelType: string;
  sourceUrl: string;
  importedAt: Date;
  jurisdictions: number;
}

export type IftaBuildResult =
  | { ok: true; worksheet: IftaWorksheetJson; rateSource: RateSource; quarter: string; unassignedTransactions: number }
  | { ok: false; quarter: string };

export async function buildIftaWorksheet(db: TenantClient, period: PeriodRow): Promise<IftaBuildResult> {
  const quarter = quarterOf(period.startDate).label;
  // IftaRate is reference data (not tenant-scoped); the tenant client passes it through unchanged.
  const rateRows = await db.iftaRate.findMany({ where: { quarter, fuelType: IFTA_FUEL_TYPE }, orderBy: { jurisdiction: "asc" } });
  if (rateRows.length === 0) return { ok: false, quarter };

  const mileage = await db.mileageRecord.findMany({
    where: { periodStart: { gte: period.startDate }, periodEnd: { lte: period.endDate }, supersededAt: null },
    select: { vehicleId: true, jurisdiction: true, totalMiles: true, taxableMiles: true },
    orderBy: [{ jurisdiction: "asc" }, { vehicleId: "asc" }],
  });

  // Fuel is read through Transaction (tenant-scoped); only MOTOR_FUEL lines count.
  const txs = await db.transaction.findMany({
    where: { periodId: period.id },
    select: { state: true, lines: { where: { category: "MOTOR_FUEL" }, select: { quantity: true } } },
  });
  const fuel: Array<{ jurisdiction: string; gallons: string }> = [];
  let unassignedTransactions = 0;
  for (const tx of txs) {
    if (!tx.state) {
      unassignedTransactions += 1;
      continue;
    }
    for (const line of tx.lines) if (line.quantity !== null) fuel.push({ jurisdiction: tx.state, gallons: line.quantity.toString() });
  }

  const worksheet = computeIftaWorksheet({
    mileage: mileage.map((m) => ({ vehicleId: m.vehicleId, jurisdiction: m.jurisdiction, totalMiles: m.totalMiles, taxableMiles: m.taxableMiles })),
    fuel,
    rates: rateRows.map((r) => ({ jurisdiction: r.jurisdiction, rate: r.rate, surcharge: r.surcharge })),
  });
  const newest = rateRows.reduce((a, b) => (b.importedAt > a.importedAt ? b : a));
  return {
    ok: true,
    worksheet: iftaWorksheetToJson(worksheet),
    rateSource: { quarter, fuelType: IFTA_FUEL_TYPE, sourceUrl: newest.sourceUrl, importedAt: newest.importedAt, jurisdictions: rateRows.length },
    quarter,
    unassignedTransactions,
  };
}
