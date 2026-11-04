/**
 * ELD jurisdiction-mileage import: provider presets, header auto-detection,
 * long/wide layout detection and the CSV → record parser. Pure (no I/O); the
 * DB-backed import, supersession and M-rule re-evaluation live in
 * ./mileage-rules.ts and the HTTP routes in ./periods.routes.ts.
 *
 * Layouts:
 *  - long: one row per unit × jurisdiction (unit, jurisdiction, total[, taxable][, from, to]).
 *    Rows for the same unit and jurisdiction (monthly breakdowns) are summed.
 *  - wide: one row per unit, one column per jurisdiction code (OH, IN, …).
 *    Blank, "-" and zero cells produce no record; there is no taxable split.
 *
 * Distances are stored in miles. A file in kilometres is converted once here
 * (@tbo/core `toMiles`) and the unit is recorded on the import.
 *
 * CSV only. XLSX/PDF reports must be exported to CSV first (no parser is
 * installable: the npm registry is blocked from this machine).
 */
import { createHash } from "node:crypto";
import { type DistanceUnit, formatFixed, toDecimal, toMiles } from "@tbo/core";
import { parseCsv } from "./csv-reader";
import { normalizeHeader, parseCardDate, parseUnitNumber } from "./fuel-cards";

export const MILEAGE_PROVIDERS = ["motive", "samsara", "geotab", "omnitracs", "generic"] as const;
export type MileageProvider = (typeof MILEAGE_PROVIDERS)[number];

export const MILEAGE_FIELDS = ["unit", "jurisdiction", "totalMiles", "taxableMiles", "periodStart", "periodEnd"] as const;
export type MileageField = (typeof MILEAGE_FIELDS)[number];

export const MILEAGE_LAYOUTS = ["long", "wide"] as const;
export type MileageLayout = (typeof MILEAGE_LAYOUTS)[number];

/** field → header text as it appears in the file (matched case/space-insensitively). */
export type MileageMapping = Partial<Record<MileageField, string>>;

export interface MileageRowError {
  row: number;
  field: string;
  message: string;
}

/** One record per unit × jurisdiction, already summed and in miles. */
export interface ParsedMileageRecord {
  unit: string;
  jurisdiction: string;
  /** 3 dp decimal strings, miles. */
  totalMiles: string;
  taxableMiles: string;
  /** 1-based file lines that contributed. */
  sourceRows: number[];
}

export interface ParsedMileage {
  headers: string[];
  layout: MileageLayout;
  records: ParsedMileageRecord[];
  errors: MileageRowError[];
  /** Totals rows, repeated headers and blank lines that were ignored. */
  skipped: number;
  /** Units named in the file that match no vehicle of the company. */
  unknownUnits: string[];
  /** Every unit named in the file, in file order. */
  unitsSeen: string[];
}

export interface MileageParseOptions {
  layout: MileageLayout;
  mapping: MileageMapping;
  distanceUnit: DistanceUnit;
  /** unitNumber → vehicleId for the company (case-insensitive match on unitNumber). */
  knownUnits: ReadonlyMap<string, string>;
  /** code → full name of every IFTA jurisdiction. Names are accepted in the jurisdiction column too. */
  jurisdictions: ReadonlyMap<string, string>;
  /** Inclusive YYYY-MM-DD bounds; rows carrying their own dates must fall inside. */
  period?: { start: string; end: string } | null;
}

// ── Header synonyms ──────────────────────────────────────────────────────────

const SYNONYMS: Record<MileageField, string[]> = {
  unit: ["unit number", "unit #", "unit no", "unit", "vehicle name", "vehicle id", "vehicle number", "vehicle #", "vehicle", "truck number", "truck #", "truck", "power unit", "asset name", "asset", "equipment", "device"],
  jurisdiction: ["jurisdiction", "state province", "state", "province", "juris", "region"],
  totalMiles: ["total miles", "total distance mi", "total distance", "miles", "distance mi", "distance", "mileage", "total km", "distance km", "kilometers", "kilometres", "km", "total"],
  taxableMiles: ["taxable miles", "taxable distance mi", "taxable distance", "taxable", "ifta miles", "ifta distance", "taxable km"],
  periodStart: ["start date", "period start", "from date", "date from", "from", "start"],
  periodEnd: ["end date", "period end", "to date", "date to", "to", "end"],
};

/**
 * Provider header preferences, tried before the generic list. Best effort from
 * the vendors' public IFTA-report descriptions; a wrong guess is harmless
 * because the owner confirms the columns and the choice is remembered.
 */
const PROVIDER_PREFERENCES: Record<MileageProvider, Partial<Record<MileageField, string[]>>> = {
  motive: { unit: ["vehicle"], jurisdiction: ["jurisdiction"], totalMiles: ["total distance mi", "total miles"], taxableMiles: ["taxable distance mi", "taxable miles"] },
  samsara: { unit: ["vehicle name", "vehicle"], jurisdiction: ["jurisdiction"], totalMiles: ["total distance mi", "distance mi"], taxableMiles: ["taxable distance mi"] },
  geotab: { unit: ["device", "vehicle"], jurisdiction: ["state province", "jurisdiction"], totalMiles: ["distance"] },
  omnitracs: { unit: ["unit"], jurisdiction: ["jurisdiction"], totalMiles: ["total miles"], taxableMiles: ["taxable miles"] },
  generic: {},
};

export function isMileageProvider(value: string): value is MileageProvider {
  return (MILEAGE_PROVIDERS as readonly string[]).includes(value);
}

export function isMileageLayout(value: string): value is MileageLayout {
  return (MILEAGE_LAYOUTS as readonly string[]).includes(value);
}

/** Headers that are IFTA jurisdiction codes (OH, IN, AB …), as written in the file. */
export function jurisdictionColumns(headers: string[], jurisdictions: ReadonlyMap<string, string>): string[] {
  return headers.filter((h) => {
    const code = h.trim().toUpperCase();
    return /^[A-Z]{2}$/.test(code) && jurisdictions.has(code);
  });
}

/** Wide when two or more headers are jurisdiction codes and none is a jurisdiction column. */
export function detectLayout(headers: string[], jurisdictions: ReadonlyMap<string, string>): MileageLayout {
  const normalized = headers.map(normalizeHeader);
  const hasJurisdictionColumn = normalized.some((h) => SYNONYMS.jurisdiction.includes(h));
  return !hasJurisdictionColumn && jurisdictionColumns(headers, jurisdictions).length >= 2 ? "wide" : "long";
}

/**
 * Detect a mapping from the header row. Provider preferences win over generic
 * synonyms; each header is claimed by at most one field. In the wide layout
 * only `unit` is mapped; jurisdiction columns are found by code.
 */
export function detectMileageMapping(headers: string[], provider: MileageProvider, layout: MileageLayout): { mapping: MileageMapping; missing: MileageField[] } {
  const normalized = headers.map(normalizeHeader);
  const claimed = new Set<number>();
  const mapping: MileageMapping = {};
  const fields: readonly MileageField[] = layout === "wide" ? ["unit"] : MILEAGE_FIELDS;
  for (const field of fields) {
    const candidates = [...(PROVIDER_PREFERENCES[provider][field] ?? []), ...SYNONYMS[field]];
    let found = -1;
    for (const synonym of candidates) {
      found = normalized.findIndex((h, i) => h === synonym && !claimed.has(i));
      if (found >= 0) break;
    }
    if (found >= 0) {
      claimed.add(found);
      mapping[field] = headers[found]!.trim();
    }
  }
  return { mapping, missing: missingMileageFields(mapping, layout) };
}

export function missingMileageFields(mapping: MileageMapping, layout: MileageLayout): MileageField[] {
  const required: MileageField[] = layout === "wide" ? ["unit"] : ["unit", "jurisdiction", "totalMiles"];
  return required.filter((f) => !mapping[f]);
}

/** "km" when the distance header says so, else "mi". */
export function suggestDistanceUnit(mapping: MileageMapping): DistanceUnit {
  const header = normalizeHeader(mapping.totalMiles ?? "");
  return /\b(km|kilomet(er|re)s?)\b/.test(header) ? "km" : "mi";
}

/** `${provider}:${layout}:${unit}:${sha256(sorted mapping)[0..8]}`. */
export function mileageMappingVersion(provider: MileageProvider, layout: MileageLayout, unit: DistanceUnit, mapping: MileageMapping): string {
  const sorted: Record<string, string> = {};
  for (const field of [...MILEAGE_FIELDS].sort()) {
    const header = mapping[field];
    if (header !== undefined && header !== "") sorted[field] = header;
  }
  return `${provider}:${layout}:${unit}:${createHash("sha256").update(JSON.stringify(sorted)).digest("hex").slice(0, 8)}`;
}

export function fileHash(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// ── Cell parsers ─────────────────────────────────────────────────────────────

const DISTANCE = /^\d{1,9}(\.\d{1,3})?$/;
const TOTALS_WORDS = new Set(["total", "totals", "grand total", "fleet total", "sum", "all", "all vehicles", "all units"]);

/** Non-negative distance text ("1,234.5", "1234") → 3 dp string; null for blank/"-"; undefined for garbage or negative. */
export function parseDistance(value: string): string | null | undefined {
  const s = value.replace(/[,\s]/g, "");
  if (s === "" || s === "-" || s === "—") return null;
  if (!DISTANCE.test(s)) return undefined;
  return formatFixed(s, 3);
}

/** Two-letter code, or a full jurisdiction name, → code. Null when neither. */
export function parseJurisdiction(value: string, jurisdictions: ReadonlyMap<string, string>): string | null {
  const s = value.trim();
  if (s === "") return null;
  const code = s.toUpperCase().replace(/^(US|CA)[-\s]/, "");
  if (/^[A-Z]{2}$/.test(code) && jurisdictions.has(code)) return code;
  const name = s.toLowerCase();
  for (const [c, n] of jurisdictions) if (n.toLowerCase() === name) return c;
  return null;
}

function isTotalsRow(unitCell: string): boolean {
  return TOTALS_WORDS.has(unitCell.trim().toLowerCase());
}

function resolve(headers: string[], mapping: MileageMapping): { index: Partial<Record<MileageField, number>>; unresolved: MileageField[] } {
  const normalized = headers.map(normalizeHeader);
  const index: Partial<Record<MileageField, number>> = {};
  const unresolved: MileageField[] = [];
  for (const field of MILEAGE_FIELDS) {
    const header = mapping[field];
    if (header === undefined || header.trim() === "") continue;
    const i = normalized.indexOf(normalizeHeader(header));
    if (i < 0) unresolved.push(field);
    else index[field] = i;
  }
  return { index, unresolved };
}

// ── File parser ──────────────────────────────────────────────────────────────

/**
 * Parse a report. Every row is validated and the caller refuses the whole file
 * when `errors` is non-empty; `records` is still filled so previews can show
 * what would be imported once the problems are fixed.
 */
export function parseMileageCsv(text: string, opts: MileageParseOptions): ParsedMileage {
  const errors: MileageRowError[] = [];
  const table = parseCsv(text);
  const empty = (layout: MileageLayout, headers: string[] = []): ParsedMileage => ({ headers, layout, records: [], errors, skipped: 0, unknownUnits: [], unitsSeen: [] });
  if (table.length === 0) {
    errors.push({ row: 0, field: "file", message: "The file is empty" });
    return empty(opts.layout);
  }
  const headers = table[0]!.map((h) => h.trim());
  const headerKey = headers.map(normalizeHeader).join("\u0000");

  const missing = missingMileageFields(opts.mapping, opts.layout);
  if (missing.length) {
    errors.push({ row: 1, field: "header", message: `Mapping is missing required column(s): ${missing.join(", ")}` });
    return empty(opts.layout, headers);
  }
  const { index, unresolved } = resolve(headers, opts.mapping);
  if (unresolved.length) {
    for (const f of unresolved) errors.push({ row: 1, field: f, message: `Mapped column "${opts.mapping[f]}" for ${f} is not in the file header` });
    return empty(opts.layout, headers);
  }
  const wideColumns = opts.layout === "wide" ? jurisdictionColumns(headers, opts.jurisdictions) : [];
  if (opts.layout === "wide" && wideColumns.length === 0) {
    errors.push({ row: 1, field: "header", message: "No jurisdiction columns (OH, IN, …) found in the header" });
    return empty(opts.layout, headers);
  }

  const knownByLower = new Map<string, string>();
  for (const [unit, id] of opts.knownUnits) knownByLower.set(unit.toLowerCase(), id);

  const records = new Map<string, ParsedMileageRecord>();
  const unknownUnits: string[] = [];
  const unitsSeen: string[] = [];
  let skipped = 0;

  const addRecord = (rowNo: number, unit: string, jurisdiction: string, total: string, taxable: string) => {
    const key = `${unit.toLowerCase()}|${jurisdiction}`;
    const existing = records.get(key);
    if (existing) {
      existing.totalMiles = formatFixed(toDecimal(existing.totalMiles).plus(total), 3);
      existing.taxableMiles = formatFixed(toDecimal(existing.taxableMiles).plus(taxable), 3);
      existing.sourceRows.push(rowNo);
    } else records.set(key, { unit, jurisdiction, totalMiles: total, taxableMiles: taxable, sourceRows: [rowNo] });
  };

  for (let i = 1; i < table.length; i++) {
    const line = table[i]!;
    const rowNo = i + 1;
    if (line.every((c) => c.trim() === "")) {
      skipped += 1;
      continue;
    }
    if (line.map(normalizeHeader).join("\u0000") === headerKey) {
      skipped += 1;
      continue;
    }
    const errorsBefore = errors.length;
    const unitCell = line[index.unit!] ?? "";
    if (isTotalsRow(unitCell)) {
      skipped += 1;
      continue;
    }
    const unit = parseUnitNumber(unitCell);
    if (unit === null) {
      errors.push({ row: rowNo, field: "unit", message: "unit is empty" });
      continue;
    }
    if (!unitsSeen.some((u) => u.toLowerCase() === unit.toLowerCase())) unitsSeen.push(unit);
    const known = knownByLower.has(unit.toLowerCase());
    if (!known) {
      if (!unknownUnits.some((u) => u.toLowerCase() === unit.toLowerCase())) unknownUnits.push(unit);
      errors.push({ row: rowNo, field: "unit", message: `unit "${unit}" does not match any vehicle of this company` });
    }

    if (opts.layout === "wide") {
      for (const column of wideColumns) {
        const col = headers.indexOf(column);
        const cell = line[col] ?? "";
        const total = parseDistance(cell);
        if (total === undefined) {
          errors.push({ row: rowNo, field: column.toUpperCase(), message: `${column.toUpperCase()} "${cell.trim()}" is not a non-negative distance` });
          continue;
        }
        if (total === null || toDecimal(total).isZero()) continue;
        const miles = formatFixed(toMiles(total, opts.distanceUnit), 3);
        if (known) addRecord(rowNo, unit, column.trim().toUpperCase(), miles, miles);
      }
      continue;
    }

    const jurisdictionCell = line[index.jurisdiction!] ?? "";
    const jurisdiction = parseJurisdiction(jurisdictionCell, opts.jurisdictions);
    if (jurisdiction === null) {
      errors.push({ row: rowNo, field: "jurisdiction", message: jurisdictionCell.trim() === "" ? "jurisdiction is empty" : `jurisdiction "${jurisdictionCell.trim()}" is not a known IFTA jurisdiction` });
    }
    const totalCell = line[index.totalMiles!] ?? "";
    const total = parseDistance(totalCell);
    if (total == null) errors.push({ row: rowNo, field: "totalMiles", message: total === null ? "total distance is empty" : `total distance "${totalCell.trim()}" is not a non-negative number (up to 3 decimals)` });
    let taxable: string | null | undefined = total ?? null;
    if (index.taxableMiles !== undefined) {
      const taxableCell = line[index.taxableMiles] ?? "";
      const parsed = parseDistance(taxableCell);
      if (parsed === undefined) errors.push({ row: rowNo, field: "taxableMiles", message: `taxable distance "${taxableCell.trim()}" is not a non-negative number (up to 3 decimals)` });
      else if (parsed !== null) taxable = parsed;
      if (parsed != null && total != null && toDecimal(parsed).gt(toDecimal(total))) errors.push({ row: rowNo, field: "taxableMiles", message: "taxable distance cannot exceed total distance" });
    }
    for (const field of ["periodStart", "periodEnd"] as const) {
      const col = index[field];
      if (col === undefined) continue;
      const cell = (line[col] ?? "").trim();
      if (cell === "") continue;
      const iso = parseCardDate(cell);
      if (iso === null) errors.push({ row: rowNo, field, message: `${field === "periodStart" ? "start" : "end"} date "${cell}" is not a recognised date` });
      else if (opts.period && (iso < opts.period.start || iso > opts.period.end)) {
        errors.push({ row: rowNo, field, message: `${field === "periodStart" ? "start" : "end"} date ${iso} is outside the quarter (${opts.period.start} to ${opts.period.end}); is this the right file?` });
      }
    }
    if (errors.length > errorsBefore || jurisdiction === null || total == null || taxable == null) continue;
    addRecord(rowNo, unit, jurisdiction, formatFixed(toMiles(total, opts.distanceUnit), 3), formatFixed(toMiles(taxable, opts.distanceUnit), 3));
  }

  const out = [...records.values()].sort((a, b) => a.unit.localeCompare(b.unit) || a.jurisdiction.localeCompare(b.jurisdiction));
  if (out.length === 0 && errors.length === 0) errors.push({ row: 1, field: "file", message: "The file has a header but no mileage rows" });
  return { headers, layout: opts.layout, records: out, errors, skipped, unknownUnits, unitsSeen };
}
