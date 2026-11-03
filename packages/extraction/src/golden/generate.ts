/**
 * Generates the golden dataset into packages/extraction/golden/:
 *   <id>.png | <id>.pdf        the document as a driver would send it
 *   <id>.expected.json         the correct extraction (contract shape)
 *   manifest.json              id, variant, file, sha256 for every fixture
 *
 * Deterministic: same inputs → same bytes, so the files are committed and the
 * Phase 1 evaluator can diff model output against them. Run: npm run golden:generate
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { expectedFor, FIXTURES, type Fixture, receiptLines, type Variant } from "./fixtures";
import { buildTextPdf } from "./pdf";

export const GOLDEN_DIR = path.resolve(__dirname, "../../golden");

const LINE_H = 22;
const CHAR_W = 10.2;
const PAD = 24;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** One receipt as an SVG group. Returns the markup and its size. */
function receiptSvg(lines: string[], opts: { x: number; y: number; opacity?: number; ink?: string; paper?: string; smudgeLine?: number; creases?: boolean }): { svg: string; w: number; h: number } {
  const w = Math.ceil(34 * CHAR_W) + PAD * 2;
  const h = lines.length * LINE_H + PAD * 2;
  const paper = opts.paper ?? "#FBFBF7";
  const ink = opts.ink ?? "#1A1A1A";
  const text = lines
    .map((l, i) => `<text x="${PAD}" y="${PAD + LINE_H * (i + 1) - 6}" font-family="Courier New, Courier, monospace" font-size="16" fill="${ink}" xml:space="preserve">${esc(l)}</text>`)
    .join("");
  const creases = opts.creases
    ? `<path d="M 10 ${h * 0.3} L ${w - 10} ${h * 0.34}" stroke="#B8B5AD" stroke-width="2" opacity="0.7"/><path d="M ${w * 0.4} 8 L ${w * 0.45} ${h - 8}" stroke="#C9C6BE" stroke-width="1.5" opacity="0.7"/><path d="M 6 ${h * 0.72} L ${w - 6} ${h * 0.69}" stroke="#B8B5AD" stroke-width="2" opacity="0.6"/>`
    : "";
  const smudge =
    opts.smudgeLine !== undefined
      ? `<rect x="${PAD - 4}" y="${PAD + LINE_H * opts.smudgeLine + 2}" width="${w * 0.62}" height="${LINE_H - 2}" fill="#6B6B6B" opacity="0.88" rx="3"/>`
      : "";
  return {
    svg: `<g transform="translate(${opts.x},${opts.y})" opacity="${opts.opacity ?? 1}"><rect width="${w}" height="${h}" fill="${paper}" stroke="#D6D3CB"/>${text}${creases}${smudge}</g>`,
    w,
    h,
  };
}

function variantSvg(fixture: Fixture): string {
  const v: Variant = fixture.variant;
  const all = fixture.receipts.map(receiptLines);
  if (v === "multi_receipt") {
    const a = receiptSvg(all[0]!, { x: 30, y: 40 });
    const b = receiptSvg(all[1]!, { x: a.w + 70, y: 90 });
    const W = a.w + b.w + 110;
    const H = Math.max(a.h + 40, b.h + 90) + 40;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#8A7F72"/>${a.svg}${b.svg}</svg>`;
  }
  const lines = all[0]!;
  const opts: Parameters<typeof receiptSvg>[1] = { x: 30, y: 30 };
  if (v === "faded") Object.assign(opts, { opacity: 0.42, ink: "#4A4A4A", paper: "#F3F1EA" });
  if (v === "crumpled") opts.creases = true;
  if (v === "unreadable_gallons") {
    // The gallons/price row is the line after the first fuel label (index of "  <qty> @").
    opts.smudgeLine = lines.findIndex((l) => /^\s+[\d.]+ (GAL|L) @/.test(l));
  }
  const r = receiptSvg(lines, opts);
  if (v === "angled") {
    const W = r.w + 160;
    const H = r.h + 140;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#9A8F83"/><g transform="rotate(-7 ${W / 2} ${H / 2}) translate(60,50)">${r.svg}</g></svg>`;
  }
  const W = r.w + 60;
  const H = r.h + 60;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#B9B2A6"/>${r.svg}</svg>`;
}

async function renderFixture(fixture: Fixture): Promise<Buffer> {
  if (fixture.format === "pdf") {
    return buildTextPdf(fixture.receipts.map((r) => ({ lines: receiptLines(r) })));
  }
  const svg = variantSvg(fixture);
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

export async function generateGolden(dir = GOLDEN_DIR): Promise<Array<{ id: string; variant: string; file: string; sha256: string }>> {
  mkdirSync(dir, { recursive: true });
  const byId = new Map(FIXTURES.map((f) => [f.id, f]));
  const manifest: Array<{ id: string; variant: string; file: string; sha256: string }> = [];
  for (const fixture of FIXTURES) {
    const source = fixture.duplicateOf ? byId.get(fixture.duplicateOf)! : fixture;
    const file = `${fixture.id}.${source.format}`;
    const bytes = fixture.duplicateOf ? readFileSync(path.join(dir, `${fixture.duplicateOf}.${source.format}`)) : await renderFixture(fixture);
    writeFileSync(path.join(dir, file), bytes);
    const expected = expectedFor(fixture, (id) => byId.get(id)!);
    writeFileSync(path.join(dir, `${fixture.id}.expected.json`), JSON.stringify(expected, null, 2) + "\n");
    manifest.push({ id: fixture.id, variant: fixture.variant, file, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ generatedBy: "packages/extraction/src/golden/generate.ts", fictional: true, fixtures: manifest }, null, 2) + "\n");
  return manifest;
}

if (require.main === module) {
  generateGolden()
    .then((m) => console.log(`Golden dataset: ${m.length} fixtures written to ${GOLDEN_DIR}`))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
