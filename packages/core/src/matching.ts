/**
 * Receipt ↔ fuel-card row matching (docs/00 master prompt, workflow step 6).
 *
 * Pure and deterministic: no I/O, no floats on money or gallons. The API maps
 * Transaction / FuelCardTransaction rows onto `MatchReceipt` / `MatchCard`,
 * calls `matchReceiptsToCards`, and persists the result as `Match` rows.
 *
 * A receipt and a card row are *candidates* when
 *   - both have a date and the dates are within ±dateToleranceDays,
 *   - at least one of gallons / amount is present on both sides, and every
 *     one that is present on both sides is within tolerance
 *     (gallons: ratio of the larger value; amount: absolute USD),
 *   - state, when present on both sides, is equal,
 *   - cardLast4, when present on both sides, is equal.
 *
 * Score = weighted fraction of agreeing fields over the fields that could be
 * compared (a field absent on either side counts for neither numerator nor
 * denominator). Date "agrees" only when the two dates are identical; a date
 * inside the tolerance still qualifies the pair but scores 0 on that field,
 * so an exact-date pair outranks a ±1-day pair.
 *
 * Pairs are assigned one-to-one, highest score first; ties go to the smaller
 * date distance, then the lexically smaller receipt id, then card id.
 */
import { Decimal, formatFixed, toDecimal, withinTolerance } from "./decimal";
import { parseIsoDate } from "./period";

export interface MatchReceipt {
  id: string;
  /** YYYY-MM-DD or null. */
  date: string | null;
  state: string | null;
  /** Motor-fuel gallons as a decimal string (reefer/DEF excluded by the caller); null when unknown or in liters. */
  gallons: string | null;
  /** Receipt total as a decimal string. */
  amount: string | null;
  cardLast4: string | null;
  vendor: string | null;
}

export interface MatchCard {
  id: string;
  /** YYYY-MM-DD. */
  date: string;
  state: string | null;
  gallons: string | null;
  amount: string | null;
  cardLast4: string | null;
  location: string | null;
  unitNumber: string | null;
}

export interface MatchOptions {
  /** Default 1. */
  dateToleranceDays?: number;
  /** Fraction of the larger gallons value; default "0.005" (0.5%). */
  gallonsRatio?: string;
  /** Absolute USD; default "0.50". */
  amountToleranceUsd?: string;
}

export interface MatchResult {
  receiptId: string;
  cardId: string;
  /** 0..1 as a 3dp decimal string. */
  score: string;
  fieldsUsed: string[];
  evidence: Record<string, unknown>;
}

export interface MatchOutcome {
  matches: MatchResult[];
  unmatchedReceiptIds: string[];
  unmatchedCardIds: string[];
}

export const MATCH_RULE_VERSION = "match-v1";

export const MATCH_DEFAULTS: Required<MatchOptions> = { dateToleranceDays: 1, gallonsRatio: "0.005", amountToleranceUsd: "0.50" };

const WEIGHTS: Record<"date" | "gallons" | "amount" | "state" | "cardLast4", Decimal> = {
  date: new Decimal("0.25"),
  gallons: new Decimal("0.30"),
  amount: new Decimal("0.30"),
  state: new Decimal("0.10"),
  cardLast4: new Decimal("0.05"),
};

const MS_PER_DAY = 86_400_000;

function dec(value: string | null): Decimal | null {
  if (value === null || value.trim() === "") return null;
  try {
    return toDecimal(value);
  } catch {
    return null;
  }
}

function dayNumber(iso: string | null): number | null {
  if (iso === null) return null;
  try {
    return Math.round(parseIsoDate(iso).getTime() / MS_PER_DAY);
  } catch {
    return null;
  }
}

function normCode(value: string | null): string | null {
  if (value === null) return null;
  const v = value.trim().toUpperCase();
  return v === "" ? null : v;
}

interface Candidate {
  receiptId: string;
  cardId: string;
  scoreDec: Decimal;
  score: string;
  dateDistance: number;
  fieldsUsed: string[];
  evidence: Record<string, unknown>;
}

function evaluate(receipt: MatchReceipt, card: MatchCard, opts: Required<MatchOptions>): Candidate | null {
  const rDay = dayNumber(receipt.date);
  const cDay = dayNumber(card.date);
  if (rDay === null || cDay === null) return null;
  const dateDistance = Math.abs(rDay - cDay);
  if (dateDistance > opts.dateToleranceDays) return null;

  const rGal = dec(receipt.gallons);
  const cGal = dec(card.gallons);
  const rAmt = dec(receipt.amount);
  const cAmt = dec(card.amount);
  const gallonsComparable = rGal !== null && cGal !== null;
  const amountComparable = rAmt !== null && cAmt !== null;
  if (!gallonsComparable && !amountComparable) return null;

  const evidence: Record<string, unknown> = { receiptDate: receipt.date, cardDate: card.date, dateDistanceDays: dateDistance };
  const fieldsUsed: string[] = ["date"];
  let numerator = dateDistance === 0 ? WEIGHTS.date : new Decimal(0);
  let denominator = WEIGHTS.date;

  if (gallonsComparable) {
    const tolerance = Decimal.max(rGal!, cGal!).abs().times(toDecimal(opts.gallonsRatio));
    if (!withinTolerance(rGal!, cGal!, tolerance)) return null;
    fieldsUsed.push("gallons");
    numerator = numerator.plus(WEIGHTS.gallons);
    denominator = denominator.plus(WEIGHTS.gallons);
    evidence.gallons = { receipt: rGal!.toString(), card: cGal!.toString(), difference: rGal!.minus(cGal!).abs().toString(), tolerance: tolerance.toString() };
  }
  if (amountComparable) {
    if (!withinTolerance(rAmt!, cAmt!, opts.amountToleranceUsd)) return null;
    fieldsUsed.push("amount");
    numerator = numerator.plus(WEIGHTS.amount);
    denominator = denominator.plus(WEIGHTS.amount);
    evidence.amount = { receipt: rAmt!.toString(), card: cAmt!.toString(), difference: rAmt!.minus(cAmt!).abs().toString(), tolerance: opts.amountToleranceUsd };
  }

  const rState = normCode(receipt.state);
  const cState = normCode(card.state);
  if (rState !== null && cState !== null) {
    if (rState !== cState) return null;
    fieldsUsed.push("state");
    numerator = numerator.plus(WEIGHTS.state);
    denominator = denominator.plus(WEIGHTS.state);
    evidence.state = rState;
  }

  const rCard = normCode(receipt.cardLast4);
  const cCard = normCode(card.cardLast4);
  if (rCard !== null && cCard !== null) {
    if (rCard !== cCard) return null;
    fieldsUsed.push("cardLast4");
    numerator = numerator.plus(WEIGHTS.cardLast4);
    denominator = denominator.plus(WEIGHTS.cardLast4);
    evidence.cardLast4 = rCard;
  }

  const scoreDec = numerator.div(denominator).toDecimalPlaces(3, Decimal.ROUND_HALF_UP);
  return { receiptId: receipt.id, cardId: card.id, scoreDec, score: formatFixed(scoreDec, 3), dateDistance, fieldsUsed, evidence };
}

function compareCandidates(a: Candidate, b: Candidate): number {
  const byScore = b.scoreDec.comparedTo(a.scoreDec);
  if (byScore !== 0) return byScore;
  if (a.dateDistance !== b.dateDistance) return a.dateDistance - b.dateDistance;
  if (a.receiptId !== b.receiptId) return a.receiptId < b.receiptId ? -1 : 1;
  if (a.cardId !== b.cardId) return a.cardId < b.cardId ? -1 : 1;
  return 0;
}

export function matchReceiptsToCards(receipts: MatchReceipt[], cards: MatchCard[], options: MatchOptions = {}): MatchOutcome {
  const opts: Required<MatchOptions> = {
    dateToleranceDays: options.dateToleranceDays ?? MATCH_DEFAULTS.dateToleranceDays,
    gallonsRatio: options.gallonsRatio ?? MATCH_DEFAULTS.gallonsRatio,
    amountToleranceUsd: options.amountToleranceUsd ?? MATCH_DEFAULTS.amountToleranceUsd,
  };
  const candidates: Candidate[] = [];
  for (const receipt of receipts) {
    for (const card of cards) {
      const c = evaluate(receipt, card, opts);
      if (c) candidates.push(c);
    }
  }
  candidates.sort(compareCandidates);

  const usedReceipts = new Set<string>();
  const usedCards = new Set<string>();
  const matches: MatchResult[] = [];
  for (const c of candidates) {
    if (usedReceipts.has(c.receiptId) || usedCards.has(c.cardId)) continue;
    usedReceipts.add(c.receiptId);
    usedCards.add(c.cardId);
    matches.push({ receiptId: c.receiptId, cardId: c.cardId, score: c.score, fieldsUsed: c.fieldsUsed, evidence: c.evidence });
  }
  return {
    matches,
    unmatchedReceiptIds: receipts.filter((r) => !usedReceipts.has(r.id)).map((r) => r.id),
    unmatchedCardIds: cards.filter((c) => !usedCards.has(c.id)).map((c) => c.id),
  };
}
