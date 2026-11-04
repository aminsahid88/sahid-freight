import { test } from "node:test";
import assert from "node:assert/strict";
import { MATCH_RULE_VERSION, type MatchCard, type MatchReceipt, matchReceiptsToCards } from "./matching";

const receipt = (over: Partial<MatchReceipt> = {}): MatchReceipt => ({ id: "r1", date: "2026-10-15", state: "OH", gallons: "100.000", amount: "412.50", cardLast4: "4242", vendor: "Fictional Fuel Stop", ...over });
const card = (over: Partial<MatchCard> = {}): MatchCard => ({ id: "c1", date: "2026-10-15", state: "OH", gallons: "100.000", amount: "412.50", cardLast4: "4242", location: "FICTIONAL FUEL STOP #12", unitNumber: "101", ...over });

test("exact match: all five fields agree, score 1.000, nothing left over", () => {
  const out = matchReceiptsToCards([receipt()], [card()]);
  assert.equal(out.matches.length, 1);
  const m = out.matches[0]!;
  assert.equal(m.receiptId, "r1");
  assert.equal(m.cardId, "c1");
  assert.equal(m.score, "1.000");
  assert.deepEqual(m.fieldsUsed, ["date", "gallons", "amount", "state", "cardLast4"]);
  assert.equal(m.evidence.dateDistanceDays, 0);
  assert.deepEqual(out.unmatchedReceiptIds, []);
  assert.deepEqual(out.unmatchedCardIds, []);
  assert.equal(MATCH_RULE_VERSION, "match-v1");
});

test("date ±1 day still matches (date contributes 0 to the score); ±2 days does not", () => {
  const plusOne = matchReceiptsToCards([receipt()], [card({ date: "2026-10-16" })]);
  assert.equal(plusOne.matches.length, 1);
  assert.equal(plusOne.matches[0]!.score, "0.750");
  assert.equal(plusOne.matches[0]!.evidence.dateDistanceDays, 1);
  const minusOne = matchReceiptsToCards([receipt()], [card({ date: "2026-10-14" })]);
  assert.equal(minusOne.matches.length, 1);
  const plusTwo = matchReceiptsToCards([receipt()], [card({ date: "2026-10-17" })]);
  assert.equal(plusTwo.matches.length, 0);
  assert.deepEqual(plusTwo.unmatchedReceiptIds, ["r1"]);
  assert.deepEqual(plusTwo.unmatchedCardIds, ["c1"]);
  // A receipt without a date can never be a candidate.
  assert.equal(matchReceiptsToCards([receipt({ date: null })], [card()]).matches.length, 0);
});

test("gallons: 0.4% off matches, 0.6% off is a near-miss", () => {
  // 100.000 vs 100.400 → diff 0.400 ≤ 100.400 × 0.005 = 0.502
  assert.equal(matchReceiptsToCards([receipt()], [card({ gallons: "100.400" })]).matches.length, 1);
  // 100.000 vs 100.600 → diff 0.600 > 100.600 × 0.005 = 0.503
  const miss = matchReceiptsToCards([receipt()], [card({ gallons: "100.600" })]);
  assert.equal(miss.matches.length, 0);
  // Wider ratio from settings lets it through.
  assert.equal(matchReceiptsToCards([receipt()], [card({ gallons: "100.600" })], { gallonsRatio: "0.01" }).matches.length, 1);
});

test("amount: $0.49 off matches, $0.51 off does not", () => {
  assert.equal(matchReceiptsToCards([receipt()], [card({ amount: "412.99" })]).matches.length, 1);
  assert.equal(matchReceiptsToCards([receipt()], [card({ amount: "412.01" })]).matches.length, 1);
  assert.equal(matchReceiptsToCards([receipt()], [card({ amount: "413.01" })]).matches.length, 0);
  assert.equal(matchReceiptsToCards([receipt()], [card({ amount: "411.99" })]).matches.length, 0);
});

test("when both gallons and amount are comparable, both must be within tolerance", () => {
  // Gallons agree, amount does not → excluded even though gallons alone would qualify.
  assert.equal(matchReceiptsToCards([receipt()], [card({ amount: "420.00" })]).matches.length, 0);
});

test("state mismatch excludes the pair; a missing state on one side is simply not compared", () => {
  assert.equal(matchReceiptsToCards([receipt()], [card({ state: "IN" })]).matches.length, 0);
  const noState = matchReceiptsToCards([receipt()], [card({ state: null })]);
  assert.equal(noState.matches.length, 1);
  assert.equal(noState.matches[0]!.score, "1.000");
  assert.deepEqual(noState.matches[0]!.fieldsUsed, ["date", "gallons", "amount", "cardLast4"]);
  // Case-insensitive.
  assert.equal(matchReceiptsToCards([receipt({ state: "oh" })], [card()]).matches.length, 1);
});

test("cardLast4 mismatch excludes the pair", () => {
  assert.equal(matchReceiptsToCards([receipt()], [card({ cardLast4: "9999" })]).matches.length, 0);
  assert.equal(matchReceiptsToCards([receipt({ cardLast4: null })], [card({ cardLast4: "9999" })]).matches.length, 1);
});

test("two receipts competing for one card: the best score wins, the other stays unmatched", () => {
  const exact = receipt({ id: "r-exact", date: "2026-10-15" });
  const dayOff = receipt({ id: "r-dayoff", date: "2026-10-16" });
  const out = matchReceiptsToCards([dayOff, exact], [card()]);
  assert.equal(out.matches.length, 1);
  assert.equal(out.matches[0]!.receiptId, "r-exact");
  assert.equal(out.matches[0]!.score, "1.000");
  assert.deepEqual(out.unmatchedReceiptIds, ["r-dayoff"]);
  // Equal scores: smaller date distance, then lexical id. Both exact here → "r-a" wins over "r-b".
  const tie = matchReceiptsToCards([receipt({ id: "r-b" }), receipt({ id: "r-a" })], [card()]);
  assert.equal(tie.matches[0]!.receiptId, "r-a");
  assert.deepEqual(tie.unmatchedReceiptIds, ["r-b"]);
});

test("reefer/DEF are not the matcher's concern: caller passes motor-fuel gallons only", () => {
  // Receipt bought 100 gal motor fuel + 20 gal reefer; the caller passes 100.000 and the card shows 100.000.
  const out = matchReceiptsToCards([receipt({ gallons: "100.000", amount: "494.50" })], [card({ gallons: "100.000", amount: "494.50" })]);
  assert.equal(out.matches.length, 1);
  assert.equal(out.matches[0]!.score, "1.000");
});

test("a liters receipt (null gallons) still matches on amount; score covers the compared fields only", () => {
  const out = matchReceiptsToCards([receipt({ gallons: null })], [card()]);
  assert.equal(out.matches.length, 1);
  assert.deepEqual(out.matches[0]!.fieldsUsed, ["date", "amount", "state", "cardLast4"]);
  assert.equal(out.matches[0]!.score, "1.000");
  // Neither gallons nor amount comparable → no candidate.
  assert.equal(matchReceiptsToCards([receipt({ gallons: null, amount: null })], [card()]).matches.length, 0);
});

test("deterministic: input order does not change the assignment", () => {
  const rs = [receipt({ id: "r1" }), receipt({ id: "r2", date: "2026-10-16", gallons: "80.000", amount: "330.00" })];
  const cs = [card({ id: "c2", date: "2026-10-16", gallons: "80.000", amount: "330.00" }), card({ id: "c1" })];
  const a = matchReceiptsToCards(rs, cs);
  const b = matchReceiptsToCards([...rs].reverse(), [...cs].reverse());
  const pairs = (o: typeof a) => o.matches.map((m) => `${m.receiptId}->${m.cardId}`).sort();
  assert.deepEqual(pairs(a), ["r1->c1", "r2->c2"]);
  assert.deepEqual(pairs(b), pairs(a));
});
