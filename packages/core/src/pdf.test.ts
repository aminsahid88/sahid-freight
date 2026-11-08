import { test } from "node:test";
import assert from "node:assert/strict";
import { PdfDoc, textWidth } from "./pdf";

test("textWidth uses Helvetica metrics", () => {
  assert.equal(Math.round(textWidth("0000", 10)), 22); // 4 × 556/1000 × 10
  assert.ok(textWidth("WWW", 10, true) > textWidth("iii", 10, true));
});

test("PdfDoc writes a well-formed multi-page PDF with a footer on every page", () => {
  const doc = new PdfDoc((p, t) => `Fictional Hauling LLC - Q4 2026 - PRELIMINARY (${p}/${t})`);
  doc.heading("Quarter report");
  doc.keyValue([
    ["Company", "Fictional Hauling LLC"],
    ["Status", "PRELIMINARY"],
  ]);
  const rows = Array.from({ length: 120 }, (_, i) => [`2026-10-${String((i % 28) + 1).padStart(2, "0")}`, `Vendor ${i}`, "OH", "100.000", "$412.50"]);
  doc.table(
    [
      { header: "Date", width: 70 },
      { header: "Vendor", width: 200 },
      { header: "State", width: 50 },
      { header: "Gallons", width: 90, align: "right" },
      { header: "Total", width: 90, align: "right" },
    ],
    rows,
    { zebra: true },
  );
  doc.paragraph("Prepared for review by a qualified preparer; not a filed return. Net gallons − tax-paid gallons × rate.");
  const bytes = doc.toBuffer();
  const text = bytes.toString("latin1");
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.ok(text.trimEnd().endsWith("%%EOF"));
  const pages = (text.match(/\/Type \/Page\b/g) ?? []).length;
  assert.ok(pages >= 3, `expected pagination, got ${pages} pages`);
  assert.equal((text.match(/\/Count (\d+)/) ?? [])[1], String(pages));
  assert.ok(text.includes(`Page 1 of ${pages}`));
  assert.ok(text.includes("Fictional Hauling LLC - Q4 2026 - PRELIMINARY \\(1/" + pages + "\\)"), "footer text present (parentheses escaped)");
  assert.ok(!text.includes("−"), "non-latin characters are mapped");
  // xref offsets point at "N 0 obj"
  const startxref = Number(text.match(/startxref\n(\d+)/)![1]);
  assert.ok(text.slice(startxref).startsWith("xref"));
  const firstOffset = Number(text.match(/xref\n0 \d+\n0000000000 65535 f \n(\d{10})/)![1]);
  assert.ok(text.slice(firstOffset).startsWith("1 0 obj"));
});
