import { test } from "node:test";
import assert from "node:assert/strict";
import { dateFromRawText, normalizeCurrency, normalizeDate, normalizeDecimal, normalizeReceipt, normalizeState, normalizeTime } from "./normalize";
import type { Receipt } from "./contract";

test("normalizeDate accepts printed US and ISO formats and rejects impossible dates", () => {
  assert.equal(normalizeDate("10/02/2026"), "2026-10-02");
  assert.equal(normalizeDate("2026-10-02"), "2026-10-02");
  assert.equal(normalizeDate("1/5/26"), "2026-01-05");
  assert.equal(normalizeDate("14/10/2026"), "2026-10-14", "day > 12 disambiguates DD/MM");
  assert.equal(normalizeDate("02/30/2026"), null);
  assert.equal(normalizeDate("Oct 2 2026"), null, "unsupported formats stay null rather than guessed");
  assert.equal(normalizeDate(null), null);
});

test("normalizeTime handles 24h and 12h", () => {
  assert.equal(normalizeTime("06:41"), "06:41");
  assert.equal(normalizeTime("2:05 PM"), "14:05");
  assert.equal(normalizeTime("12:10 AM"), "00:10");
  assert.equal(normalizeTime("25:00"), null);
});

test("normalizeDecimal keeps money exact and signs credits", () => {
  assert.equal(normalizeDecimal(461.72, 2), "461.72");
  assert.equal(normalizeDecimal("$1,234.5", 2), "1234.50");
  assert.equal(normalizeDecimal("118.42", 3), "118.420");
  assert.equal(normalizeDecimal("3.8995", 4), "3.8995");
  assert.equal(normalizeDecimal("2.675", 2), "2.68", "half up");
  assert.equal(normalizeDecimal("(15.60)", 2), "-15.60");
  assert.equal(normalizeDecimal("15.60-", 2), "-15.60");
  assert.equal(normalizeDecimal("abc", 2), null);
  assert.equal(normalizeDecimal("", 2), null);
  assert.equal(normalizeDecimal(0, 2), "0.00");
});

test("normalizeState maps codes and names, rejects junk", () => {
  assert.equal(normalizeState("nd"), "ND");
  assert.equal(normalizeState("North Dakota"), "ND");
  assert.equal(normalizeState("MB"), "MB");
  assert.equal(normalizeState("ZZ"), null);
  assert.equal(normalizeCurrency("$"), "USD");
  assert.equal(normalizeCurrency("cad"), "CAD");
  assert.equal(normalizeCurrency("dollar"), null);
});

const receipt: Receipt = {
  region_hint: null,
  fields: {
    transaction_date: { raw_text: "DATE 10/02/2026", value: "10/02/2026", legibility: "clear" },
    time: { raw_text: "TIME 06:41", value: "06:41", legibility: "clear" },
    vendor: { raw_text: "NORTHSTAR TRAVEL CENTER #214", value: "Northstar Travel Center", legibility: "clear" },
    seller_address: { raw_text: "1450 INDUSTRIAL BLVD FARGO, ND 58102", value: "1450 Industrial Blvd, Fargo, ND 58102", legibility: "clear" },
    state: { raw_text: null, value: null, legibility: "unreadable" },
    unit_number: { raw_text: "UNIT 102", value: "UNIT 102", legibility: "clear" },
    odometer: { raw_text: "ODOMETER 412885", value: 412885, legibility: "clear" },
    driver_name: { raw_text: null, value: null, legibility: "clear" },
    purchaser_name: { raw_text: "DEMO FREIGHT LLC", value: "DEMO FREIGHT LLC", legibility: "clear" },
    payment_method: { raw_text: "FUEL CARD ****4417", value: "fuel_card", legibility: "clear" },
    card_last4: { raw_text: "****4417", value: "****4417", legibility: "clear" },
    pump_number: { raw_text: "PUMP 07", value: "07", legibility: "clear" },
    receipt_total: { raw_text: "TOTAL USD 461.72", value: 461.72, legibility: "clear" },
    currency: { raw_text: "USD", value: "USD", legibility: "clear" },
  },
  line_items: [
    { description_raw: "DIESEL #2 118.420 GAL @ 3.899", category: "motor_fuel", fuel_type: "diesel", quantity: 118.42, unit: "gal", unit_price: 3.899, amount: 461.72, legibility: "clear" },
    { description_raw: "CREDIT MISFILL", category: "credit", fuel_type: null, quantity: null, unit: null, unit_price: null, amount: 15.6, legibility: "partial" },
  ],
};

test("normalizeReceipt produces typed values, derives state from the address, signs credits, keeps raw text and legibility", () => {
  const n = normalizeReceipt(receipt);
  assert.equal(n.date, "2026-10-02");
  assert.equal(n.vendor, "NORTHSTAR TRAVEL CENTER");
  assert.equal(n.state, "ND", "state unreadable but the address carries it");
  assert.equal(n.unitNumber, "102");
  assert.equal(n.odometer, "412885.0");
  assert.equal(n.cardLast4, "4417");
  assert.equal(n.receiptTotal, "461.72");
  assert.equal(n.lines[0]?.quantity, "118.420");
  assert.equal(n.lines[0]?.unitPrice, "3.8990");
  assert.equal(n.lines[1]?.amount, "-15.60");
  assert.equal(n.rawText.vendor, "NORTHSTAR TRAVEL CENTER #214");
  assert.equal(n.legibility.state, "unreadable");
  assert.equal(n.legibility["line_items.1.amount"], "partial");
});

test("a date the model left null but transcribed in raw_text is recovered from the printed text (US month/day convention)", () => {
  assert.equal(dateFromRawText("DATE 10/02/2026 TIME 06:41"), "2026-10-02");
  assert.equal(dateFromRawText("DATE: 14/10/2026"), "2026-10-14", "day > 12 disambiguates DD/MM");
  assert.equal(dateFromRawText("2026-10-02 06:41"), "2026-10-02");
  assert.equal(dateFromRawText("TOTAL 461.72"), null);
  assert.equal(dateFromRawText(null), null);
  const r = normalizeReceipt({
    region_hint: null,
    fields: { transaction_date: { raw_text: "DATE 10/02/2026", value: null, legibility: "partial" }, receipt_total: { raw_text: "461.72", value: 461.72, legibility: "clear" } },
    line_items: [],
  } as never);
  assert.equal(r.date, "2026-10-02");
});
