import { test } from "node:test";
import assert from "node:assert/strict";
import { FakeExtractor } from "./client";
import { evaluateGolden, goldenAnswers } from "./evaluate";
import { PASS_A } from "./prompts";

test("a perfect extractor scores 100% on the golden set and the duplicate shares its source's answer", async () => {
  const fake = new FakeExtractor(goldenAnswers());
  const report = await evaluateGolden(fake, { model: "claude-opus-5-5", prompt: PASS_A });
  assert.equal(report.summary.fixtures, 20);
  assert.equal(report.summary.materialAccuracyPercent, "100.0");
  assert.equal(report.summary.touchlessPercent, "100.0");
  assert.equal(report.summary.wrongValues, 0);
  assert.equal(report.summary.errors, 0);
  assert.equal(report.summary.receiptsMatched, 20);
  assert.ok(Number(report.summary.totalCostUsd) > 0, "cost is tracked even for the fake");
  assert.equal(fake.calls.length, 20);
});

test("a wrong total and an honest null are scored differently", async () => {
  const answers = goldenAnswers();
  const g001 = [...answers.entries()].find(([, v]) => v.id === "g001")!;
  const tampered = structuredClone(g001[1]);
  tampered.receipts[0]!.fields.receipt_total!.value = 416.72; // transposed digits: a wrong value
  tampered.receipts[0]!.fields.vendor!.value = null; // an honest miss
  const fake = new FakeExtractor(new Map([[g001[0], tampered]]));
  const report = await evaluateGolden(fake, { model: "claude-sonnet-5-5", prompt: PASS_A, only: ["g001"] });
  assert.equal(report.summary.fixtures, 1);
  assert.equal(report.summary.wrongValues, 1);
  assert.equal(report.summary.honestMisses, 1);
  assert.equal(report.summary.touchlessPercent, "0.0");
  assert.equal(report.summary.fieldAccuracy.receiptTotal?.percent, "0.0");
  assert.equal(report.summary.fieldAccuracy.date?.percent, "100.0");
});

test("an extractor that returns nothing scores zero with errors counted", async () => {
  const fake = new FakeExtractor(new Map());
  const report = await evaluateGolden(fake, { model: "claude-opus-5-5", prompt: PASS_A, only: ["g001", "g019"] });
  assert.equal(report.summary.errors, 2);
  assert.equal(report.summary.materialAccuracyPercent, "0.0");
  assert.equal(report.summary.receiptsMatched, 0);
});
