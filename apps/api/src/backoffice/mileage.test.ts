import { test } from "node:test";
import assert from "node:assert/strict";
import { detectLayout, detectMileageMapping, jurisdictionColumns, mileageMappingVersion, parseDistance, parseJurisdiction, parseMileageCsv, suggestDistanceUnit } from "./mileage";

const JUR = new Map([
  ["OH", "Ohio"],
  ["IN", "Indiana"],
  ["MN", "Minnesota"],
  ["ND", "North Dakota"],
  ["AB", "Alberta"],
]);
const UNITS = new Map([
  ["101", "v101"],
  ["102", "v102"],
]);
const base = { knownUnits: UNITS, jurisdictions: JUR, period: { start: "2026-10-01", end: "2026-12-31" } };

test("detectMileageMapping: Motive-style long header, generic synonyms, and the wide layout", () => {
  const long = ["Vehicle", "Jurisdiction", "Total Distance (mi)", "Taxable Distance (mi)", "Start Date", "End Date"];
  assert.equal(detectLayout(long, JUR), "long");
  const m = detectMileageMapping(long, "motive", "long");
  assert.deepEqual(m.mapping, { unit: "Vehicle", jurisdiction: "Jurisdiction", totalMiles: "Total Distance (mi)", taxableMiles: "Taxable Distance (mi)", periodStart: "Start Date", periodEnd: "End Date" });
  assert.deepEqual(m.missing, []);
  assert.equal(suggestDistanceUnit(m.mapping), "mi");

  const km = detectMileageMapping(["Unit #", "State/Province", "Distance (km)"], "generic", "long");
  assert.equal(km.mapping.totalMiles, "Distance (km)");
  assert.equal(suggestDistanceUnit(km.mapping), "km");

  const wide = ["Unit", "OH", "IN", "MN", "Total"];
  assert.equal(detectLayout(wide, JUR), "wide");
  assert.deepEqual(jurisdictionColumns(wide, JUR), ["OH", "IN", "MN"]);
  assert.deepEqual(detectMileageMapping(wide, "generic", "wide"), { mapping: { unit: "Unit" }, missing: [] });

  assert.deepEqual(detectMileageMapping(["Truck", "Miles"], "generic", "long").missing, ["jurisdiction"]);
  assert.notEqual(mileageMappingVersion("motive", "long", "mi", m.mapping), mileageMappingVersion("motive", "long", "km", m.mapping));
});

test("cell parsers: distances, jurisdiction codes and names", () => {
  assert.equal(parseDistance("1,234.5"), "1234.500");
  assert.equal(parseDistance(" 0 "), "0.000");
  assert.equal(parseDistance(""), null);
  assert.equal(parseDistance("-"), null);
  assert.equal(parseDistance("-4"), undefined);
  assert.equal(parseDistance("abc"), undefined);
  assert.equal(parseJurisdiction("oh", JUR), "OH");
  assert.equal(parseJurisdiction("North Dakota", JUR), "ND");
  assert.equal(parseJurisdiction("US-IN", JUR), "IN");
  assert.equal(parseJurisdiction("XX", JUR), null);
});

test("long layout: sums monthly rows per unit × jurisdiction, defaults taxable to total, skips totals rows and repeated headers", () => {
  const csv = [
    "Unit,Jurisdiction,Total Miles,Taxable Miles",
    "101,OH,1200,1200",
    "101,OH,800.5,",
    "101,in,300,250",
    "",
    "Unit,Jurisdiction,Total Miles,Taxable Miles",
    "102,Ohio,\"2,000\",",
    "Total,,4300.5,",
  ].join("\n");
  const p = parseMileageCsv(csv, { ...base, layout: "long", distanceUnit: "mi", mapping: { unit: "Unit", jurisdiction: "Jurisdiction", totalMiles: "Total Miles", taxableMiles: "Taxable Miles" } });
  assert.deepEqual(p.errors, []);
  assert.equal(p.skipped, 2, "totals row and repeated header; the CSV reader drops blank lines itself");
  assert.deepEqual(
    p.records.map((r) => [r.unit, r.jurisdiction, r.totalMiles, r.taxableMiles, r.sourceRows]),
    [
      ["101", "IN", "300.000", "250.000", [4]],
      ["101", "OH", "2000.500", "2000.500", [2, 3]],
      ["102", "OH", "2000.000", "2000.000", [6]],
    ],
  );
  assert.deepEqual(p.unitsSeen, ["101", "102"]);
  assert.deepEqual(p.unknownUnits, []);
});

test("long layout: every problem is reported with its row; unknown units are listed; dates outside the quarter are refused", () => {
  const csv = ["unit,state,miles,taxable,from,to", "101,OH,1200,1300,10/01/2026,12/31/2026", "103,XX,-4,,2026-07-01,", "102,IN,abc,,,", ",OH,5,,,"].join("\n");
  const p = parseMileageCsv(csv, { ...base, layout: "long", distanceUnit: "mi", mapping: { unit: "unit", jurisdiction: "state", totalMiles: "miles", taxableMiles: "taxable", periodStart: "from", periodEnd: "to" } });
  assert.deepEqual(
    p.errors.map((e) => `${e.row}:${e.field}`),
    ["2:taxableMiles", "3:unit", "3:jurisdiction", "3:totalMiles", "3:periodStart", "4:totalMiles", "5:unit"],
  );
  assert.deepEqual(p.unknownUnits, ["103"]);
  assert.deepEqual(p.unitsSeen, ["101", "103", "102"]);
  assert.equal(p.records.length, 0, "a row with any error produces no record");
});

test("wide layout: one record per non-zero jurisdiction cell, kilometres converted to miles, totals column ignored", () => {
  const csv = ["Unit,OH,IN,MN,AB,Total", "101,\"1,000\",0,-,250,1250", "102,,500,,,500", "Fleet total,1000,500,0,250,1750"].join("\n");
  const p = parseMileageCsv(csv, { ...base, layout: "wide", distanceUnit: "km", mapping: { unit: "Unit" } });
  assert.deepEqual(p.errors, []);
  assert.equal(p.skipped, 1);
  assert.deepEqual(
    p.records.map((r) => [r.unit, r.jurisdiction, r.totalMiles, r.taxableMiles]),
    [
      ["101", "AB", "155.343", "155.343"],
      ["101", "OH", "621.370", "621.370"],
      ["102", "IN", "310.685", "310.685"],
    ],
  );
  const bad = parseMileageCsv("Unit,OH,IN\n101,x,5\n", { ...base, layout: "wide", distanceUnit: "mi", mapping: { unit: "Unit" } });
  assert.deepEqual(bad.errors.map((e) => `${e.row}:${e.field}`), ["2:OH"]);
});

test("header problems: empty file, missing required mapping, mapped column not in file, no data rows", () => {
  const long = { ...base, layout: "long" as const, distanceUnit: "mi" as const };
  assert.equal(parseMileageCsv("", { ...long, mapping: { unit: "u", jurisdiction: "j", totalMiles: "m" } }).errors[0]!.field, "file");
  assert.equal(parseMileageCsv("u,j,m\n", { ...long, mapping: { unit: "u", jurisdiction: "j" } }).errors[0]!.message, "Mapping is missing required column(s): totalMiles");
  assert.equal(parseMileageCsv("u,j,m\n", { ...long, mapping: { unit: "u", jurisdiction: "j", totalMiles: "miles" } }).errors[0]!.field, "totalMiles");
  assert.equal(parseMileageCsv("u,j,m\n", { ...long, mapping: { unit: "u", jurisdiction: "j", totalMiles: "m" } }).errors[0]!.message, "The file has a header but no mileage rows");
  assert.equal(parseMileageCsv("Unit,Miles\n101,5\n", { ...base, layout: "wide", distanceUnit: "mi", mapping: { unit: "Unit" } }).errors[0]!.message, "No jurisdiction columns (OH, IN, …) found in the header");
});
