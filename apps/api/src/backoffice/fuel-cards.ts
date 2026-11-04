/**
 * Fuel-card statement import: provider presets, header auto-detection and the
 * CSV → row parser. Pure (no I/O); the DB-backed matching service lives in
 * ./matching.ts and the HTTP routes in ./fuel-cards.routes.ts.
 *
 * CSV only. XLSX statements must be exported to CSV first (no XLSX library is
 * available: the npm registry is blocked from this machine).
 */
import { createHash } from "node:crypto";
import { formatFixed, parseIsoDate, toDecimal, toIsoDate } from "@tbo/core";
import { parseCsv } from "./csv-reader";

export const FUEL_CARD_PROVIDERS = ["comdata", "wex_efs", "atob", "tcs", "generic"] as const;
export type FuelCardProvider = (typeof FUEL_CARD_PROVIDERS)[number];

export const FUEL_CARD_FIELDS = ["date", "location", "state", "unitNumber", "cardLast4", "fuelType", "gallons", "amount"] as const;
export type FuelCardField = (typeof FUEL_CARD_FIELDS)[number];

/** field → header text as it appears in the file (matched case/space-insensitively). */
export type FuelCardMapping = Partial<Record<FuelCardField, string>>;

export interface ParsedCardRow {
  /** 1-based line number in the file (header = 1). */
  row: number;
  /** YYYY-MM-DD */
  date: string;
  location: string | null;
  /** Two-letter upper-case code or null. */
  state: string | null;
  unitNumber: string | null;
  /** Last four digits of the card column, or null. */
  cardLast4: string | null;
  fuelType: string | null;
  /** 3dp decimal string or null. */
  gallons: string | null;
  /** 2dp decimal string or null; negative for credits. */
  amount: string | null;
  /** header → cell value for every column in the row. */
  raw: Record<string, string>;
}

export interface CardRowError {
  row: number;
  field: string;
  message: string;
}

// ── Header synonyms ──────────────────────────────────────────────────────────

/** Generic synonyms per field, most specific first. Compared after `normalizeHeader`. */
const SYNONYMS: Record<FuelCardField, string[]> = {
  date: ["transaction date", "trans date", "transaction dt", "tran date", "posting date", "post date", "purchase date", "date"],
  location: ["merchant name", "merchant", "location name", "location", "site name", "site", "truck stop", "vendor", "station", "store"],
  state: ["merchant state", "location state", "site state", "state", "st"],
  unitNumber: ["unit number", "unit #", "unit no", "unit", "vehicle id", "vehicle number", "vehicle #", "vehicle", "truck number", "truck #", "truck"],
  cardLast4: ["card last 4", "card last4", "last 4", "last4", "card number", "card #", "card no", "card"],
  fuelType: ["product description", "product desc", "product", "fuel type", "item description", "item"],
  gallons: ["gallons", "gallons purchased", "quantity", "qty", "units", "volume"],
  amount: ["total amount", "net amount", "transaction amount", "trans amount", "total", "amount"],
};

/** Provider-specific header preferences, tried before the generic list. */
const PROVIDER_PREFERENCES: Record<FuelCardProvider, Partial<Record<FuelCardField, string[]>>> = {
  comdata: {
    date: ["transaction date"],
    location: ["merchant name"],
    state: ["merchant state"],
    unitNumber: ["unit number"],
    cardLast4: ["card number"],
    fuelType: ["product description"],
    gallons: ["quantity"],
    amount: ["total amount"],
  },
  wex_efs: {
    date: ["trans date"],
    location: ["location name"],
    state: ["location state"],
    unitNumber: ["unit"],
    cardLast4: ["card #"],
    fuelType: ["product"],
    gallons: ["units", "gallons"],
    amount: ["net amount"],
  },
  atob: {
    date: ["date"],
    location: ["merchant"],
    unitNumber: ["vehicle"],
    cardLast4: ["card"],
    fuelType: ["fuel type"],
    gallons: ["gallons"],
    amount: ["amount"],
  },
  tcs: {
    date: ["transaction date"],
    location: ["location"],
    unitNumber: ["truck"],
    cardLast4: ["card number"],
    fuelType: ["product"],
    gallons: ["qty"],
    amount: ["total"],
  },
  generic: {},
};

/** Lower-case, punctuation (other than #) and runs of whitespace/underscores collapsed to one space. */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9#]+/g, " ")
    .trim();
}

export function isFuelCardProvider(value: string): value is FuelCardProvider {
  return (FUEL_CARD_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Detect a mapping from the header row. Provider preferences win over generic
 * synonyms; each header is claimed by at most one field. `missing` lists the
 * required fields that could not be found: `date`, and both `gallons` and
 * `amount` when neither was found.
 */
export function detectMapping(headers: string[], provider: FuelCardProvider): { mapping: FuelCardMapping; missing: FuelCardField[] } {
  const normalized = headers.map(normalizeHeader);
  const claimed = new Set<number>();
  const mapping: FuelCardMapping = {};
  for (const field of FUEL_CARD_FIELDS) {
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
  return { mapping, missing: missingFields(mapping) };
}

export function missingFields(mapping: FuelCardMapping): FuelCardField[] {
  const missing: FuelCardField[] = [];
  if (!mapping.date) missing.push("date");
  if (!mapping.gallons && !mapping.amount) missing.push("gallons", "amount");
  return missing;
}

/** `${provider}:${sha256(sorted mapping)[0..8]}` — changes whenever a column assignment changes. */
export function mappingVersion(provider: FuelCardProvider, mapping: FuelCardMapping): string {
  const sorted: Record<string, string> = {};
  for (const field of [...FUEL_CARD_FIELDS].sort()) {
    const header = mapping[field];
    if (header !== undefined && header !== "") sorted[field] = header;
  }
  return `${provider}:${createHash("sha256").update(JSON.stringify(sorted)).digest("hex").slice(0, 8)}`;
}

// ── Cell parsers ─────────────────────────────────────────────────────────────

const DATE_ISO = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;
const DATE_US = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2}|\d{4})$/;

/** Accepts YYYY-MM-DD, YYYY/MM/DD, MM/DD/YYYY, M/D/YY (and dashes); a trailing time is ignored. Returns null when unparseable. */
export function parseCardDate(value: string): string | null {
  const token = value.trim().split(/\s+/)[0] ?? "";
  let y: number;
  let m: number;
  let d: number;
  const iso = DATE_ISO.exec(token);
  const us = DATE_US.exec(token);
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else if (us) {
    m = Number(us[1]);
    d = Number(us[2]);
    y = Number(us[3]);
    if (us[3]!.length === 2) y += 2000;
  } else return null;
  const isoText = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  try {
    return toIsoDate(parseIsoDate(isoText));
  } catch {
    return null;
  }
}

const NUMERIC = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

/** Strip "$", commas, spaces; "(12.34)" or "12.34-" → negative. Returns null for blank, undefined for garbage. */
function parseSignedNumber(value: string): string | null | undefined {
  let s = value.replace(/[$,\s]/g, "");
  if (s === "") return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith("-")) {
    negative = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith("+")) s = s.slice(1);
  if (!NUMERIC.test(s)) return undefined;
  const dec = toDecimal(s);
  return (negative ? dec.negated() : dec).toString();
}

export function parseGallons(value: string): string | null | undefined {
  const n = parseSignedNumber(value);
  return n == null ? n : formatFixed(n, 3);
}

export function parseAmount(value: string): string | null | undefined {
  const n = parseSignedNumber(value);
  return n == null ? n : formatFixed(n, 2);
}

export function parseState(value: string): string | null {
  const s = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : null;
}

/** Strip a leading "UNIT", "TRUCK", "#", ":" and surrounding whitespace. */
export function parseUnitNumber(value: string): string | null {
  const s = value
    .trim()
    .replace(/^(unit|truck|vehicle)\b\s*/i, "")
    .replace(/^[#:\-\s]+/, "")
    .trim();
  return s === "" ? null : s;
}

/** Last four digits of whatever is in the card column ("****4417", "XXXX-XXXX-1234", "4417"). */
export function parseCardLast4(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

function textOrNull(value: string): string | null {
  const s = value.trim().replace(/\s+/g, " ");
  return s === "" ? null : s;
}

// ── File parser ──────────────────────────────────────────────────────────────

/** Resolve mapping header texts to column indexes (case/space-insensitive). */
export function resolveMapping(headers: string[], mapping: FuelCardMapping): { index: Partial<Record<FuelCardField, number>>; unresolved: FuelCardField[] } {
  const normalized = headers.map(normalizeHeader);
  const index: Partial<Record<FuelCardField, number>> = {};
  const unresolved: FuelCardField[] = [];
  for (const field of FUEL_CARD_FIELDS) {
    const header = mapping[field];
    if (header === undefined || header.trim() === "") continue;
    const i = normalized.indexOf(normalizeHeader(header));
    if (i < 0) unresolved.push(field);
    else index[field] = i;
  }
  return { index, unresolved };
}

/**
 * Parse a statement. Every row is validated; the caller refuses the whole file
 * when `errors` is non-empty. Repeated header lines (per-page headers in some
 * exports) and blank lines are skipped.
 */
export function parseFuelCardCsv(text: string, mapping: FuelCardMapping): { headers: string[]; rows: ParsedCardRow[]; errors: CardRowError[] } {
  const rows: ParsedCardRow[] = [];
  const errors: CardRowError[] = [];
  const table = parseCsv(text);
  if (table.length === 0) return { headers: [], rows, errors: [{ row: 0, field: "file", message: "The file is empty" }] };
  const headers = table[0]!.map((h) => h.trim());
  const headerKey = headers.map(normalizeHeader).join("\u0000");

  const missing = missingFields(mapping);
  if (missing.length) return { headers, rows, errors: [{ row: 1, field: "header", message: `Mapping is missing required column(s): ${missing.join(", ")}` }] };
  const { index, unresolved } = resolveMapping(headers, mapping);
  if (unresolved.length) {
    return { headers, rows, errors: unresolved.map((f) => ({ row: 1, field: f, message: `Mapped column "${mapping[f]}" for ${f} is not in the file header` })) };
  }
  const cell = (line: string[], field: FuelCardField): string | null => {
    const i = index[field];
    return i === undefined ? null : (line[i] ?? "");
  };

  for (let i = 1; i < table.length; i++) {
    const line = table[i]!;
    const rowNo = i + 1;
    if (line.map(normalizeHeader).join("\u0000") === headerKey) continue; // repeated header
    const raw: Record<string, string> = {};
    headers.forEach((h, col) => {
      raw[h === "" ? `column_${col + 1}` : h] = (line[col] ?? "").trim();
    });

    const dateText = cell(line, "date") ?? "";
    const date = parseCardDate(dateText);
    if (date === null) errors.push({ row: rowNo, field: "date", message: dateText.trim() === "" ? "date is empty" : `date "${dateText.trim()}" is not a recognised date (use YYYY-MM-DD or MM/DD/YYYY)` });

    const gallonsText = cell(line, "gallons");
    const gallons = gallonsText === null ? null : parseGallons(gallonsText);
    if (gallons === undefined) errors.push({ row: rowNo, field: "gallons", message: `gallons "${gallonsText!.trim()}" is not a number` });

    const amountText = cell(line, "amount");
    const amount = amountText === null ? null : parseAmount(amountText);
    if (amount === undefined) errors.push({ row: rowNo, field: "amount", message: `amount "${amountText!.trim()}" is not a number` });

    if (gallons === null && amount === null) errors.push({ row: rowNo, field: "amount", message: "row has neither gallons nor amount" });
    if (date === null || gallons === undefined || amount === undefined || (gallons === null && amount === null)) continue;

    const locationText = cell(line, "location");
    const stateText = cell(line, "state");
    const unitText = cell(line, "unitNumber");
    const cardText = cell(line, "cardLast4");
    const fuelText = cell(line, "fuelType");
    rows.push({
      row: rowNo,
      date,
      location: locationText === null ? null : textOrNull(locationText),
      state: stateText === null ? null : parseState(stateText),
      unitNumber: unitText === null ? null : parseUnitNumber(unitText),
      cardLast4: cardText === null ? null : parseCardLast4(cardText),
      fuelType: fuelText === null ? null : textOrNull(fuelText),
      gallons,
      amount,
      raw,
    });
  }
  if (rows.length === 0 && errors.length === 0) errors.push({ row: 1, field: "file", message: "The file has a header but no data rows" });
  return { headers, rows, errors };
}

/** Exact-duplicate key: same date, amount, gallons, cardLast4 and location. */
export function duplicateKey(row: { date: string; amount: string | null; gallons: string | null; cardLast4: string | null; location: string | null }): string {
  return [row.date, row.amount ?? "", row.gallons ?? "", row.cardLast4 ?? "", (row.location ?? "").trim().toLowerCase()].join("|");
}
