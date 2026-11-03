import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { sniffBinaryMime } from "@tbo/core";
import { goldenExpected, MATERIAL_FIELDS } from "../contract";
import { FIXTURES, lineAmount, receiptTotal } from "./fixtures";
import { GOLDEN_DIR } from "./generate";
import { buildTextPdf } from "./pdf";

const manifest = JSON.parse(readFileSync(path.join(GOLDEN_DIR, "manifest.json"), "utf8")) as { fixtures: Array<{ id: string; variant: string; file: string; sha256: string }> };

test("the golden set has at least 20 fixtures covering every required variant", () => {
  assert.ok(FIXTURES.length >= 20);
  const variants = new Set(FIXTURES.map((f) => f.variant));
  for (const v of ["clean", "faded", "crumpled", "angled", "multi_receipt", "multi_page_pdf", "reefer_and_tractor", "def", "liters_cad", "missing_unit", "duplicate", "refund", "unreadable_gallons"]) {
    assert.ok(variants.has(v as never), `missing variant ${v}`);
  }
});

test("every fixture file exists, matches the manifest hash, and is really a PNG or PDF", () => {
  for (const entry of manifest.fixtures) {
    const file = path.join(GOLDEN_DIR, entry.file);
    assert.ok(existsSync(file), `${entry.file} missing — run npm run golden:generate`);
    const bytes = readFileSync(file);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256, `${entry.file} changed since manifest`);
    const mime = sniffBinaryMime(bytes);
    assert.equal(mime, entry.file.endsWith(".pdf") ? "application/pdf" : "image/png");
    assert.ok(bytes.length > 500, `${entry.file} is suspiciously small`);
  }
});

test("every expected.json validates against the extraction contract and never invents values", () => {
  for (const fixture of FIXTURES) {
    const expected = goldenExpected.parse(JSON.parse(readFileSync(path.join(GOLDEN_DIR, `${fixture.id}.expected.json`), "utf8")));
    assert.equal(expected.id, fixture.id);
    assert.ok(expected.receipts.length >= 1);
    for (const r of expected.receipts) {
      for (const key of MATERIAL_FIELDS) assert.ok(key in r.fields, `${fixture.id}: material field ${key} missing`);
      for (const [name, f] of Object.entries(r.fields)) {
        // Rule: missing/unreadable → null, never a guess.
        if (f.legibility === "unreadable" || f.raw_text === null) assert.equal(f.value, null, `${fixture.id}.${name} should be null`);
      }
      for (const li of r.line_items) {
        if (li.legibility === "unreadable") assert.equal(li.quantity, null, `${fixture.id}: unreadable line must not carry a quantity`);
      }
    }
  }
});

test("clean fixtures are arithmetically consistent (F001/F002 would pass)", () => {
  for (const fixture of FIXTURES) {
    for (const r of fixture.receipts) {
      let sum = 0;
      for (const l of r.lines) {
        const amount = Number(lineAmount(l));
        assert.ok(Math.abs(Number(l.quantity) * Number(l.unitPrice) - amount) < 0.011, `${fixture.id}: line arithmetic`);
        sum += amount;
      }
      if (r.fee) sum += Number(r.fee.amount);
      if (r.credit) sum -= Number(r.credit.amount);
      assert.ok(Math.abs(sum - Number(receiptTotal(r))) < 0.005, `${fixture.id}: total arithmetic`);
    }
  }
});

test("reefer and DEF lines are categorised so they can be excluded from IFTA gallons", () => {
  const read = (id: string) => goldenExpected.parse(JSON.parse(readFileSync(path.join(GOLDEN_DIR, `${id}.expected.json`), "utf8")));
  const g010 = read("g010").receipts[0]!;
  assert.deepEqual(
    g010.line_items.map((l) => l.category),
    ["motor_fuel", "reefer_fuel"],
  );
  const g011 = read("g011").receipts[0]!;
  assert.deepEqual(
    g011.line_items.map((l) => l.category),
    ["motor_fuel", "def"],
  );
  const g012 = read("g012").receipts[0]!;
  assert.equal(g012.line_items[0]!.unit, "L");
  assert.equal(g012.fields.currency!.value, "CAD");
  assert.equal(g012.fields.state!.value, "MB");
});

test("the duplicate fixture is byte-identical to its source and multi-receipt fixtures have one region per receipt", () => {
  const dup = manifest.fixtures.find((f) => f.id === "g014")!;
  const src = manifest.fixtures.find((f) => f.id === "g001")!;
  assert.equal(dup.sha256, src.sha256);
  const read = (id: string) => goldenExpected.parse(JSON.parse(readFileSync(path.join(GOLDEN_DIR, `${id}.expected.json`), "utf8")));
  assert.equal(read("g018").receipts.length, 2);
  assert.equal(read("g019").receipts.length, 3);
  assert.equal(read("g019").receipts[2]!.region_hint, "page 3");
  assert.equal(read("g013").receipts[0]!.fields.unit_number!.value, null);
  assert.equal(read("g017").receipts[0]!.line_items[0]!.quantity, null);
});

test("the minimal PDF writer produces a well-formed document", () => {
  const pdf = buildTextPdf([{ lines: ["HELLO (WORLD)", "LINE 2"] }, { lines: ["PAGE 2"] }]);
  const text = pdf.toString("latin1");
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.match(text, /\/Type \/Pages \/Kids \[\d+ 0 R \d+ 0 R\] \/Count 2/);
  assert.match(text, /\(HELLO \\\(WORLD\\\)\) Tj/);
  assert.match(text, /startxref\n\d+\n%%EOF\n$/);
  // Every xref offset points at "N 0 obj".
  const xrefStart = Number(/startxref\n(\d+)/.exec(text)![1]);
  const xrefLines = text.slice(xrefStart).split("\n").slice(2, 2 + 1 + 6);
  for (let i = 1; i < xrefLines.length; i++) {
    const off = Number(xrefLines[i]!.slice(0, 10));
    assert.ok(text.slice(off).startsWith(`${i} 0 obj`), `object ${i} offset`);
  }
});
