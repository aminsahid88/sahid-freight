/**
 * Normalization: turns a contract receipt (raw model output) into typed,
 * comparable values. Pure and deterministic. Never invents: anything that
 * does not parse cleanly becomes null and keeps its raw text.
 */
import type { Legibility, LineItem, Receipt } from "./contract";

export type Category = "MOTOR_FUEL" | "REEFER_FUEL" | "DEF" | "NON_FUEL" | "TAX" | "FEE" | "DISCOUNT" | "CREDIT";

export interface NormalizedLine {
  descriptionRaw: string;
  category: Category;
  fuelType: string | null;
  quantity: string | null; // decimal string, 3 dp
  unit: "gal" | "L" | "each" | null;
  unitPrice: string | null; // 4 dp
  amount: string | null; // 2 dp, signed (credits/discounts negative)
  legibility: Legibility;
}

export interface NormalizedReceipt {
  regionHint: string | null;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:MM
  vendor: string | null;
  sellerAddress: string | null;
  state: string | null; // 2-letter upper
  unitNumber: string | null;
  odometer: string | null; // 1 dp
  driverName: string | null;
  purchaserName: string | null;
  paymentMethod: "fuel_card" | "credit_card" | "cash" | "other" | null;
  cardLast4: string | null;
  pumpNumber: string | null;
  receiptTotal: string | null; // 2 dp
  currency: string | null; // ISO
  lines: NormalizedLine[];
  /** Per contract field: raw text as printed. */
  rawText: Record<string, string | null>;
  /** Per contract field and line field: legibility. */
  legibility: Record<string, Legibility>;
}

const US_STATES = new Set(["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"]);
const CA_PROVINCES = new Set(["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"]);
const STATE_NAMES: Record<string, string> = {
  alabama:"AL",alaska:"AK",arizona:"AZ",arkansas:"AR",california:"CA",colorado:"CO",connecticut:"CT",delaware:"DE",florida:"FL",georgia:"GA",hawaii:"HI",idaho:"ID",illinois:"IL",indiana:"IN",iowa:"IA",kansas:"KS",kentucky:"KY",louisiana:"LA",maine:"ME",maryland:"MD",massachusetts:"MA",michigan:"MI",minnesota:"MN",mississippi:"MS",missouri:"MO",montana:"MT",nebraska:"NE",nevada:"NV","new hampshire":"NH","new jersey":"NJ","new mexico":"NM","new york":"NY","north carolina":"NC","north dakota":"ND",ohio:"OH",oklahoma:"OK",oregon:"OR",pennsylvania:"PA","rhode island":"RI","south carolina":"SC","south dakota":"SD",tennessee:"TN",texas:"TX",utah:"UT",vermont:"VT",virginia:"VA",washington:"WA","west virginia":"WV",wisconsin:"WI",wyoming:"WY",alberta:"AB","british columbia":"BC",manitoba:"MB","new brunswick":"NB","nova scotia":"NS",ontario:"ON",quebec:"QC",saskatchewan:"SK",
};

export function normalizeState(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  const up = s.toUpperCase();
  if (US_STATES.has(up) || CA_PROVINCES.has(up)) return up;
  const byName = STATE_NAMES[s.toLowerCase()];
  return byName ?? null;
}

/** Accepts YYYY-MM-DD, MM/DD/YYYY, M/D/YY, DD-MM-YYYY is rejected as ambiguous unless day > 12. */
/** Find a date token inside printed text such as "DATE 10/02/2026 TIME 06:41" and normalize it. */
export function dateFromRawText(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const m = /(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[\/.-]\d{1,2}[\/.-](?:\d{4}|\d{2})(?!\d))/.exec(String(raw));
  return m ? normalizeDate(m[1]) : null;
}

export function normalizeDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  let y: number, m: number, d: number;
  let match: RegExpExecArray | null;
  if ((match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/.exec(s))) {
    let a = Number(match[1]);
    let b = Number(match[2]);
    y = Number(match[3]);
    if (y < 100) y += 2000;
    if (a > 12 && b <= 12) [a, b] = [b, a]; // DD/MM printed; only unambiguous case accepted
    [m, d] = [a, b];
  } else {
    return null;
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (y < 2000 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function normalizeTime(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().toUpperCase();
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/.exec(s);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (m[3] === "PM" && h < 12) h += 12;
  if (m[3] === "AM" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Parse a printed number into a fixed-place decimal string, or null. Accepts "1,234.56", "$461.72", "461.72-". */
export function normalizeDecimal(value: unknown, places: number): string | null {
  if (value === null || value === undefined || value === "") return null;
  let s = typeof value === "number" ? value.toString() : String(value).trim();
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.endsWith("-") || s.endsWith("CR")) {
    negative = true;
    s = s.replace(/-$|CR$/, "");
  }
  s = s.replace(/[$,\s]/g, "").replace(/^[A-Z]{1,3}/, "");
  if (s.startsWith("-")) {
    negative = !negative;
    s = s.slice(1);
  }
  if (!/^\d*(\.\d+)?$/.test(s) || s === "" || s === ".") return null;
  const [whole = "0", frac = ""] = s.split(".");
  // Round half up on a string basis to avoid floats.
  const digits = (frac + "0".repeat(places + 1)).slice(0, places + 1);
  let kept = BigInt(whole + digits.slice(0, places));
  if (Number(digits[places]) >= 5) kept += 1n;
  const asStr = kept.toString().padStart(places + 1, "0");
  const out = places ? `${asStr.slice(0, -places)}.${asStr.slice(-places)}` : asStr;
  if (/^0*\.?0*$/.test(out.replace(".", ""))) return out.replace(/^-/, "");
  return negative ? `-${out}` : out;
}

export function normalizeCurrency(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(s)) return s;
  if (s === "$" || s === "US$" || s === "DOLLARS") return "USD";
  if (s === "C$" || s === "CA$") return "CAD";
  return null;
}

const CATEGORY_MAP: Record<string, Category> = { motor_fuel: "MOTOR_FUEL", reefer_fuel: "REEFER_FUEL", def: "DEF", non_fuel: "NON_FUEL", tax: "TAX", fee: "FEE", discount: "DISCOUNT", credit: "CREDIT" };

export function normalizeLine(l: LineItem, index: number, legibility: Record<string, Legibility>): NormalizedLine {
  const category = CATEGORY_MAP[l.category] ?? "NON_FUEL";
  const amountRaw = normalizeDecimal(l.amount, 2);
  // Discounts and credits reduce the total: store them negative.
  const amount = amountRaw && (category === "DISCOUNT" || category === "CREDIT") && !amountRaw.startsWith("-") ? `-${amountRaw}` : amountRaw;
  const leg = l.legibility ?? "clear";
  legibility[`line_items.${index}.quantity`] = leg;
  legibility[`line_items.${index}.amount`] = leg;
  return {
    descriptionRaw: l.description_raw,
    category,
    fuelType: l.fuel_type ?? null,
    quantity: normalizeDecimal(l.quantity, 3),
    unit: l.unit ?? null,
    unitPrice: normalizeDecimal(l.unit_price, 4),
    amount,
    legibility: leg,
  };
}

function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
}

export function normalizeReceipt(r: Receipt): NormalizedReceipt {
  const f = (key: string) => r.fields[key];
  const rawText: Record<string, string | null> = {};
  const legibility: Record<string, Legibility> = {};
  for (const [k, v] of Object.entries(r.fields)) {
    rawText[k] = v.raw_text;
    legibility[k] = v.legibility;
  }
  const pm = str(f("payment_method")?.value)?.toLowerCase() ?? null;
  const lines = r.line_items.map((l, i) => normalizeLine(l, i, legibility));
  return {
    regionHint: r.region_hint ?? null,
    // The model transcribes; the month/day convention is applied here (US-first, DD/MM only when unambiguous).
    date: normalizeDate(f("transaction_date")?.value) ?? dateFromRawText(f("transaction_date")?.raw_text),
    time: normalizeTime(f("time")?.value),
    vendor: str(f("vendor")?.value)?.toUpperCase() ?? null,
    sellerAddress: str(f("seller_address")?.value),
    state: normalizeState(f("state")?.value) ?? normalizeState(/\b([A-Z]{2})\s+\d{5}(-\d{4})?\b/.exec(String(f("seller_address")?.value ?? ""))?.[1]),
    unitNumber: str(f("unit_number")?.value)?.replace(/^(UNIT|TRUCK|TR)\s*#?\s*/i, "") ?? null,
    odometer: normalizeDecimal(f("odometer")?.value, 1),
    driverName: str(f("driver_name")?.value),
    purchaserName: str(f("purchaser_name")?.value),
    paymentMethod: pm === "fuel_card" || pm === "credit_card" || pm === "cash" || pm === "other" ? pm : null,
    cardLast4: (str(f("card_last4")?.value)?.replace(/\D/g, "").slice(-4) ?? null) || null,
    pumpNumber: str(f("pump_number")?.value),
    receiptTotal: normalizeDecimal(f("receipt_total")?.value, 2),
    currency: normalizeCurrency(f("currency")?.value),
    lines,
    rawText,
    legibility,
  };
}
