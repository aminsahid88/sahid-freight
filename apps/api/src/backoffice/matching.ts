/**
 * Receipt ↔ fuel-card matching service (docs/00 workflow step 6).
 *
 * Loads the company's FUEL transactions and FuelCardTransaction rows (optionally
 * limited to a period's calendar dates), hands the ones without a Match to the
 * pure matcher in @tbo/core, and persists the outcome:
 *   - Match row {score, fieldsUsed, ruleVersion} per new pair,
 *   - transaction.corroboration = RECEIPT_AND_CARD,
 *   - D003 (INFO) on the transaction, once,
 *   - I003 (WARNING) once per unmatched card row; resolved when it later matches,
 *   - I004 (INFO) once per unmatched card-paid receipt; resolved when it later matches.
 * Re-running is idempotent: rows that already have a Match are never re-paired.
 *
 * Tolerances come from Setting `card_match_tolerance` ({days, gallonsRatio,
 * amountUsd}; company first, then global), else the matcher's defaults.
 */
import type { PrismaClient } from "@prisma/client";
import { formatFixed, type MatchCard, type MatchOptions, type MatchReceipt, MATCH_RULE_VERSION, matchReceiptsToCards, sum, toIsoDate } from "@tbo/core";
import { audit } from "../audit/log";
import type { TenantClient } from "../tenant/client";
import type { PeriodRow } from "./ifta";

export interface MatchSummary {
  receiptsConsidered: number;
  cardRowsConsidered: number;
  matched: number;
  newMatches: number;
  unmatchedReceipts: number;
  unmatchedCardRows: number;
}

export const ISSUE_VERSIONS = { D003: "D003-v1", I003: "I003-v1", I004: "I004-v1" } as const;

/** Payment methods (extraction vocabulary) that imply a card statement row should exist. */
const CARD_PAYMENT_METHODS: ReadonlySet<string> = new Set(["fuel_card", "credit_card"]);

export async function loadMatchOptions(prisma: PrismaClient, db: TenantClient): Promise<MatchOptions> {
  const key = "card_match_tolerance";
  const companyRow = await db.setting.findFirst({ where: { key } });
  const globalRow = companyRow ? null : await prisma.setting.findFirst({ where: { companyId: null, key } });
  const value = ((companyRow ?? globalRow)?.value ?? {}) as { days?: number | string; gallonsRatio?: string; amountUsd?: string };
  const opts: MatchOptions = {};
  if (value.days !== undefined && Number.isInteger(Number(value.days)) && Number(value.days) >= 0) opts.dateToleranceDays = Number(value.days);
  if (typeof value.gallonsRatio === "string") opts.gallonsRatio = value.gallonsRatio;
  if (typeof value.amountUsd === "string") opts.amountToleranceUsd = value.amountUsd;
  return opts;
}

type TxRow = {
  id: string;
  date: Date | null;
  state: string | null;
  receiptTotal: { toString(): string } | null;
  cardLast4: string | null;
  vendor: string | null;
  paymentMethod: string | null;
  lines: Array<{ category: string; quantity: { toString(): string } | null; unit: string | null }>;
  matches: Array<{ id: string }>;
};

/** Motor-fuel gallons only (reefer/DEF never count); null when there are none or any motor-fuel line is in liters. */
export function receiptGallons(lines: TxRow["lines"]): string | null {
  const motor = lines.filter((l) => l.category === "MOTOR_FUEL" && l.quantity !== null);
  if (motor.length === 0) return null;
  if (motor.some((l) => l.unit === "L")) return null;
  return formatFixed(sum(motor.map((l) => l.quantity!.toString())), 3);
}

export function toMatchReceipt(tx: TxRow): MatchReceipt {
  return {
    id: tx.id,
    date: tx.date ? toIsoDate(tx.date) : null,
    state: tx.state,
    gallons: receiptGallons(tx.lines),
    amount: tx.receiptTotal === null ? null : formatFixed(tx.receiptTotal.toString(), 2),
    cardLast4: tx.cardLast4,
    vendor: tx.vendor,
  };
}

export interface RunMatchingArgs {
  prisma: PrismaClient;
  db: TenantClient;
  companyId: string;
  userId: string;
  ip?: string | null;
  period?: PeriodRow | null;
}

export async function runCardMatching({ prisma, db, companyId, userId, ip, period }: RunMatchingArgs): Promise<MatchSummary> {
  const dateRange = period ? { gte: period.startDate, lte: period.endDate } : { not: null };
  const txRows = await db.transaction.findMany({
    where: { type: "FUEL", date: dateRange },
    select: { id: true, date: true, state: true, receiptTotal: true, cardLast4: true, vendor: true, paymentMethod: true, lines: { select: { category: true, quantity: true, unit: true } }, matches: { select: { id: true } } },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });
  const cardRows = await db.fuelCardTransaction.findMany({
    where: period ? { date: { gte: period.startDate, lte: period.endDate } } : {},
    select: { id: true, date: true, state: true, gallons: true, amount: true, cardLast4: true, location: true, unitNumber: true, matches: { select: { id: true } } },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });

  const openReceipts = txRows.filter((t) => t.matches.length === 0);
  const openCards = cardRows.filter((c) => c.matches.length === 0);
  const receipts: MatchReceipt[] = openReceipts.map(toMatchReceipt);
  const cards: MatchCard[] = openCards.map((c) => ({
    id: c.id,
    date: toIsoDate(c.date),
    state: c.state,
    gallons: c.gallons === null ? null : formatFixed(c.gallons, 3),
    amount: c.amount === null ? null : formatFixed(c.amount, 2),
    cardLast4: c.cardLast4,
    location: c.location,
    unitNumber: c.unitNumber,
  }));

  const outcome = matchReceiptsToCards(receipts, cards, await loadMatchOptions(prisma, db));
  const now = new Date();

  for (const m of outcome.matches) {
    await db.match.create({ data: { transactionId: m.receiptId, cardTransactionId: m.cardId, score: m.score, fieldsUsed: m.fieldsUsed, ruleVersion: MATCH_RULE_VERSION } });
    await db.transaction.update({ where: { id: m.receiptId }, data: { corroboration: "RECEIPT_AND_CARD" } });
    const existing = await db.issue.findFirst({ where: { transactionId: m.receiptId, code: "D003", status: "OPEN" }, select: { id: true } });
    if (!existing) {
      await db.issue.create({
        data: {
          companyId,
          transactionId: m.receiptId,
          code: "D003",
          ruleVersion: ISSUE_VERSIONS.D003,
          severity: "INFO",
          message: "Receipt and fuel card row describe the same purchase",
          fields: ["match"],
          evidence: { cardTransactionId: m.cardId, score: m.score, fieldsUsed: m.fieldsUsed },
        },
      });
    }
    await db.issue.updateMany({
      where: { code: "I003", status: "OPEN", evidence: { path: ["fuelCardTransactionId"], equals: m.cardId } },
      data: { status: "RESOLVED", resolvedBy: userId, resolvedAt: now, resolutionNote: "Matched to a receipt" },
    });
    await db.issue.updateMany({
      where: { code: "I004", status: "OPEN", transactionId: m.receiptId },
      data: { status: "RESOLVED", resolvedBy: userId, resolvedAt: now, resolutionNote: "Matched to a fuel card row" },
    });
  }

  const unmatchedCardIds = new Set(outcome.unmatchedCardIds);
  for (const c of openCards) {
    if (!unmatchedCardIds.has(c.id)) continue;
    const existing = await db.issue.findFirst({ where: { code: "I003", evidence: { path: ["fuelCardTransactionId"], equals: c.id } }, select: { id: true } });
    if (existing) continue;
    await db.issue.create({
      data: {
        companyId,
        transactionId: null,
        documentId: null,
        code: "I003",
        ruleVersion: ISSUE_VERSIONS.I003,
        severity: "WARNING",
        message: "Fuel card purchase with no matching receipt",
        fields: ["fuelCardTransaction"],
        evidence: {
          fuelCardTransactionId: c.id,
          date: toIsoDate(c.date),
          amount: c.amount === null ? null : formatFixed(c.amount, 2),
          gallons: c.gallons === null ? null : formatFixed(c.gallons, 3),
          location: c.location,
        },
      },
    });
  }

  const unmatchedReceiptIds = new Set(outcome.unmatchedReceiptIds);
  for (const t of openReceipts) {
    if (!unmatchedReceiptIds.has(t.id)) continue;
    if (!t.paymentMethod || !CARD_PAYMENT_METHODS.has(t.paymentMethod.trim().toLowerCase())) continue;
    const existing = await db.issue.findFirst({ where: { code: "I004", transactionId: t.id }, select: { id: true } });
    if (existing) continue;
    await db.issue.create({
      data: {
        companyId,
        transactionId: t.id,
        code: "I004",
        ruleVersion: ISSUE_VERSIONS.I004,
        severity: "INFO",
        message: "Receipt paid by card with no matching card row (statement may be missing)",
        fields: ["paymentMethod"],
        evidence: { paymentMethod: t.paymentMethod, date: t.date ? toIsoDate(t.date) : null, receiptTotal: t.receiptTotal === null ? null : formatFixed(t.receiptTotal.toString(), 2), cardLast4: t.cardLast4 },
      },
    });
  }

  const summary: MatchSummary = {
    receiptsConsidered: txRows.length,
    cardRowsConsidered: cardRows.length,
    matched: txRows.length - openReceipts.length + outcome.matches.length,
    newMatches: outcome.matches.length,
    unmatchedReceipts: outcome.unmatchedReceiptIds.length,
    unmatchedCardRows: outcome.unmatchedCardIds.length,
  };
  await audit(db, { action: "edit", userId, target: period ? `Period:${period.id}` : `Company:${companyId}`, meta: { matching: summary, ruleVersion: MATCH_RULE_VERSION }, ip: ip ?? null });
  return summary;
}
