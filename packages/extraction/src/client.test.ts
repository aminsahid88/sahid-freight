import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { estimateCostUsd, FakeExtractor, modelOutputSchema } from "./client";
import { PASS_A, PASS_B } from "./prompts";

test("estimateCostUsd uses published per-token prices with exact decimal math", () => {
  const { costUsd, known } = estimateCostUsd("claude-opus-5-5", { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
  assert.equal(known, true);
  assert.equal(costUsd, "4.00000");
  assert.equal(estimateCostUsd("claude-sonnet-5-5", { inputTokens: 1500, outputTokens: 400, cacheReadTokens: 0, cacheWriteTokens: 0 }).costUsd, "0.00700");
  assert.equal(estimateCostUsd("claude-opus-5-5", { inputTokens: 1, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }).costUsd, "0.00000", "sub-cent rounds to 5 places");
  assert.deepEqual(estimateCostUsd("claude-made-up", { inputTokens: 10, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0 }), { costUsd: "0.00000", known: false });
});

test("FakeExtractor answers by content hash and records calls per pass", async () => {
  const bytes = Buffer.from("fake receipt");
  const sha = createHash("sha256").update(bytes).digest("hex");
  const answer = { receipts: [{ region_hint: null, fields: { vendor: { raw_text: "X", value: "X", legibility: "clear" as const } }, line_items: [] }] };
  const fake = new FakeExtractor(new Map([[sha, answer]]));
  const a = await fake.extract({ bytes, mimeType: "image/png", prompt: PASS_A, model: "m-a" });
  const b = await fake.extract({ bytes, mimeType: "image/png", prompt: PASS_B, model: "m-b" });
  assert.equal(a.result?.receipts[0]?.fields.vendor?.value, "X");
  assert.equal(b.error, null);
  assert.deepEqual(fake.calls.map((c) => c.pass), ["A", "B"]);
  const miss = await fake.extract({ bytes: Buffer.from("other"), mimeType: "image/png", prompt: PASS_A, model: "m-a" });
  assert.equal(miss.result, null);
  assert.equal(miss.error, "no_fake_answer");
});

test("the strict model output schema accepts the contract shape and rejects extra keys", () => {
  const ok = modelOutputSchema.safeParse({
    receipts: [
      {
        region_hint: null,
        fields: Object.fromEntries(["transaction_date", "time", "vendor", "seller_address", "state", "unit_number", "odometer", "driver_name", "purchaser_name", "payment_method", "card_last4", "pump_number", "receipt_total", "currency"].map((k) => [k, { raw_text: null, value: null, legibility: "unreadable" }])),
        line_items: [{ description_raw: "DIESEL", category: "motor_fuel", fuel_type: "diesel", quantity: 1, unit: "gal", unit_price: 3.5, amount: 3.5, legibility: "clear" }],
      },
    ],
  });
  assert.equal(ok.success, true);
  const bad = modelOutputSchema.safeParse({ receipts: [{ region_hint: null, fields: {}, line_items: [{ description_raw: "x", category: "snacks" }] }] });
  assert.equal(bad.success, false);
});
