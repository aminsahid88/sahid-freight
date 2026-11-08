import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { prisma } from "../test/fixtures";
import { seedJurisdictions } from "./test-harness";
import { applyBundledTable, loadBundledRates, parseRateFile } from "./ifta-rates-bundled";

const Q = "2032Q1";
const file = (version: string, rows: string) =>
  `# comment line\n# source=https://www.iftach.org/taxmatrix4/Taxmatrix.php\n# version=${version}\n# status=preliminary (not final)\njurisdiction,rate,surcharge\n${rows}\n`;

test.before(async () => {
  await seedJurisdictions();
  await prisma.iftaRate.deleteMany({ where: { quarter: Q } });
});
test.after(async () => {
  await prisma.iftaRate.deleteMany({ where: { quarter: Q } });
});

test("parseRateFile reads metadata and rows, rejects bad input", () => {
  const t = parseRateFile(`${Q}-diesel.csv`, file("2026-11-08", "oh,0.4700\nKY,0.2200,0.1050"));
  assert.equal(t.quarter, Q);
  assert.equal(t.fuelType, "diesel");
  assert.equal(t.version, "2026-11-08");
  assert.equal(t.sourceUrl, "https://www.iftach.org/taxmatrix4/Taxmatrix.php");
  assert.deepEqual(t.rows, [
    { jurisdiction: "OH", rate: "0.4700", surcharge: null },
    { jurisdiction: "KY", rate: "0.2200", surcharge: "0.1050" },
  ]);
  assert.throws(() => parseRateFile("diesel.csv", file("1", "OH,0.47")), /name must look like/);
  assert.throws(() => parseRateFile(`${Q}-diesel.csv`, "jurisdiction,rate\nOH,0.47\n"), /source/);
  assert.throws(() => parseRateFile(`${Q}-diesel.csv`, file("1", "OH,0.47\nOH,0.48")), /appears twice/);
  assert.throws(() => parseRateFile(`${Q}-diesel.csv`, file("1", "OH,abc")), /bad rate/);
  assert.throws(() => parseRateFile(`${Q}-diesel.csv`, file("1", "OH,0.47,1e-3")), /bad surcharge/);
});

test("bundled table: inserted, unchanged on same version, replaced on new version, never over an admin table", async () => {
  const dir = mkdtempSync(join(tmpdir(), "rates-"));
  writeFileSync(join(dir, `${Q}-diesel.csv`), file("2026-11-08", "OH,0.4700\nKY,0.2200,0.1050\nIL,0.7380"));
  writeFileSync(join(dir, "notes.txt"), "ignored");
  writeFileSync(join(dir, `${Q}-gasoline.csv`), file("2026-11-08", "ZZ,0.1000"));

  let r = await loadBundledRates(prisma, dir);
  assert.equal(r.length, 2);
  const diesel = r.find((x) => x.fuelType === "diesel")!;
  assert.equal(diesel.outcome, "inserted");
  assert.equal(diesel.rows, 3);
  const gas = r.find((x) => x.fuelType === "gasoline")!;
  assert.equal(gas.outcome, "error");
  assert.match(gas.detail ?? "", /unknown jurisdiction/);

  const stored = await prisma.iftaRate.findMany({ where: { quarter: Q, fuelType: "diesel" }, orderBy: { jurisdiction: "asc" } });
  assert.deepEqual(stored.map((x) => [x.jurisdiction, x.rate.toString(), x.surcharge?.toString() ?? null]), [
    ["IL", "0.738", null],
    ["KY", "0.22", "0.105"],
    ["OH", "0.47", null],
  ]);
  assert.ok(stored.every((x) => x.sourceUrl === "https://www.iftach.org/taxmatrix4/Taxmatrix.php#bundle=2026-11-08"));
  const audit = await prisma.auditLog.findFirst({ where: { target: `IftaRate:${Q}` }, orderBy: { createdAt: "desc" } });
  assert.ok(audit);
  assert.equal((audit.meta as { bundled?: boolean }).bundled, true);

  // Same version again: nothing happens.
  r = await loadBundledRates(prisma, dir);
  assert.equal(r.find((x) => x.fuelType === "diesel")!.outcome, "unchanged");

  // New version: the bundled rows are replaced in full (IL dropped, OH changed).
  writeFileSync(join(dir, `${Q}-diesel.csv`), file("2026-12-05", "OH,0.4800\nKY,0.2200,0.1050"));
  r = await loadBundledRates(prisma, dir);
  assert.equal(r.find((x) => x.fuelType === "diesel")!.outcome, "updated");
  const after = await prisma.iftaRate.findMany({ where: { quarter: Q, fuelType: "diesel" }, orderBy: { jurisdiction: "asc" } });
  assert.deepEqual(after.map((x) => [x.jurisdiction, x.rate.toString()]), [["KY", "0.22"], ["OH", "0.48"]]);

  // An admin-loaded table (no bundle marker) is never touched, even by a newer file.
  await prisma.iftaRate.update({ where: { quarter_jurisdiction_fuelType: { quarter: Q, jurisdiction: "OH", fuelType: "diesel" } }, data: { sourceUrl: "https://www.iftach.org/taxmatrix4/Taxmatrix.php", rate: "0.4900" } });
  const kept = await applyBundledTable(prisma, parseRateFile(`${Q}-diesel.csv`, file("2027-01-01", "OH,0.0100")), `${Q}-diesel.csv`);
  assert.equal(kept.outcome, "admin_table_kept");
  const oh = await prisma.iftaRate.findUnique({ where: { quarter_jurisdiction_fuelType: { quarter: Q, jurisdiction: "OH", fuelType: "diesel" } } });
  assert.equal(oh!.rate.toString(), "0.49");
});

test("the shipped 2026Q4 diesel file parses and has no Oregon row", () => {
  const { readFileSync } = require("fs") as typeof import("fs");
  const path = join(__dirname, "..", "..", "rates", "2026Q4-diesel.csv");
  const t = parseRateFile("2026Q4-diesel.csv", readFileSync(path, "utf8"));
  assert.equal(t.rows.length, 47);
  assert.ok(!t.rows.some((r) => r.jurisdiction === "OR"));
  assert.deepEqual(t.rows.filter((r) => r.surcharge).map((r) => r.jurisdiction), ["KY", "VA"]);
  assert.equal(t.version, "2026-11-08");
});
