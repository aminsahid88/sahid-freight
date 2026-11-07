import { test } from "node:test";
import assert from "node:assert/strict";
import {
  InvalidDateError,
  iftaDueDate,
  isInPeriod,
  isWithinRetention,
  parseIsoDate,
  quarterOf,
  retentionUntil,
  toIsoDate,
} from "./period";

test("quarterOf maps dates to IFTA quarters", () => {
  const q4 = quarterOf("2026-11-03");
  assert.equal(q4.label, "2026Q4");
  assert.equal(toIsoDate(q4.start), "2026-10-01");
  assert.equal(toIsoDate(q4.end), "2026-12-31");
  assert.equal(quarterOf("2026-01-01").label, "2026Q1");
  assert.equal(quarterOf("2026-03-31").label, "2026Q1");
  assert.equal(quarterOf("2026-04-01").label, "2026Q2");
  assert.equal(quarterOf("2026-09-30").label, "2026Q3");
  assert.equal(quarterOf(new Date(Date.UTC(2026, 11, 31, 23, 59))).label, "2026Q4");
});

test("iftaDueDate is the last day of the month after the quarter", () => {
  assert.equal(toIsoDate(iftaDueDate(2026, 1)), "2026-04-30");
  assert.equal(toIsoDate(iftaDueDate(2026, 2)), "2026-07-31");
  assert.equal(toIsoDate(iftaDueDate(2026, 3)), "2026-10-31");
  assert.equal(toIsoDate(iftaDueDate(2026, 4)), "2027-01-31");
});

test("retentionUntil is 4 years after the due date of the receiving quarter", () => {
  assert.equal(toIsoDate(retentionUntil("2026-11-03")), "2031-01-31");
  assert.equal(toIsoDate(retentionUntil("2026-02-14")), "2030-04-30");
  assert.equal(toIsoDate(retentionUntil("2026-02-14", 7)), "2033-04-30");
});

test("isWithinRetention compares against now", () => {
  const until = retentionUntil("2026-11-03");
  assert.equal(isWithinRetention(until, new Date("2030-01-01T00:00:00Z")), true);
  assert.equal(isWithinRetention(until, new Date("2031-01-31T00:00:00Z")), false);
});

test("parseIsoDate rejects impossible and malformed dates", () => {
  assert.throws(() => parseIsoDate("2026-02-30"), InvalidDateError);
  assert.throws(() => parseIsoDate("2026-13-01"), InvalidDateError);
  assert.throws(() => parseIsoDate("11/03/2026"), InvalidDateError);
  assert.throws(() => parseIsoDate(""), InvalidDateError);
  assert.equal(toIsoDate(parseIsoDate("2024-02-29")), "2024-02-29");
});

test("isInPeriod is inclusive on both ends", () => {
  assert.equal(isInPeriod("2026-10-01", "2026-10-01", "2026-12-31"), true);
  assert.equal(isInPeriod("2026-12-31", "2026-10-01", "2026-12-31"), true);
  assert.equal(isInPeriod("2027-01-01", "2026-10-01", "2026-12-31"), false);
});

test("addBusinessDays skips weekends", async () => {
  const { addBusinessDays } = await import("./period");
  assert.equal(addBusinessDays("2026-11-06", 1).toISOString().slice(0, 10), "2026-11-09"); // Friday → Monday
  assert.equal(addBusinessDays("2026-11-07", 1).toISOString().slice(0, 10), "2026-11-09"); // Saturday → Monday
  assert.equal(addBusinessDays("2026-11-04", 2).toISOString().slice(0, 10), "2026-11-06");
  assert.equal(addBusinessDays(new Date("2026-11-06T15:30:00Z"), 1).toISOString(), "2026-11-09T15:30:00.000Z");
});
