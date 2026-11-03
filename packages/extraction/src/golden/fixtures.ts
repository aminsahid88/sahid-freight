/**
 * Fictional receipts for the golden dataset. Every vendor, address, unit,
 * driver and number here is invented for "Demo Freight LLC". Amounts are
 * computed with decimal math so each receipt's arithmetic is internally
 * consistent (the F001/F002 rules must pass on clean fixtures).
 */
import { formatFixed, money, toDecimal } from "@tbo/core";
import type { GoldenExpected, LineItem, Receipt } from "../contract";

export type Variant =
  | "clean"
  | "faded"
  | "angled"
  | "crumpled"
  | "multi_receipt"
  | "multi_page_pdf"
  | "reefer_and_tractor"
  | "def"
  | "liters_cad"
  | "missing_unit"
  | "duplicate"
  | "refund"
  | "unreadable_gallons"
  | "card_fee";

export interface Station {
  name: string;
  store: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: "US" | "CA";
}

export interface FuelLine {
  label: string; // printed description
  category: "motor_fuel" | "reefer_fuel" | "def";
  fuelType: string;
  quantity: string; // gallons or liters as printed, 3 dp
  unit: "gal" | "L";
  unitPrice: string; // 3 dp
}

export interface ReceiptSpec {
  station: Station;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  pump: string;
  unit: string | null;
  odometer: string | null;
  driver: string | null;
  purchaser: string | null;
  cardLast4: string;
  lines: FuelLine[];
  fee?: { label: string; amount: string };
  credit?: { label: string; amount: string };
  currency: "USD" | "CAD";
}

export const STATIONS: Record<string, Station> = {
  northstar: { name: "NORTHSTAR TRAVEL CENTER", store: "#214", street: "1450 INDUSTRIAL BLVD", city: "FARGO", state: "ND", zip: "58102", country: "US" },
  prairie: { name: "PRAIRIE FUEL STOP", store: "#31", street: "2200 HWY 10 W", city: "MOORHEAD", state: "MN", zip: "56560", country: "US" },
  bigsky: { name: "BIG SKY TRUCK PLAZA", store: "#7", street: "900 FRONTAGE RD", city: "BILLINGS", state: "MT", zip: "59101", country: "US" },
  greatlakes: { name: "GREAT LAKES FUEL", store: "#1182", street: "4100 INTERSTATE DR", city: "GARY", state: "IN", zip: "46406", country: "US" },
  lonestar: { name: "LONE STAR PETRO", store: "#58", street: "7700 I-35 N", city: "SAN ANTONIO", state: "TX", zip: "78233", country: "US" },
  buckeye: { name: "BUCKEYE TRUCK STOP", store: "#9", street: "3300 US-30", city: "MANSFIELD", state: "OH", zip: "44903", country: "US" },
  redriver: { name: "RED RIVER CARDLOCK", store: "#3", street: "1800 KING EDWARD ST", city: "WINNIPEG", state: "MB", zip: "R2R 0N1", country: "CA" },
};

const DRIVERS = ["A HASSAN", "M YUSUF", "F OMAR"];
const UNITS = ["101", "102", "103"];

export function diesel(quantity: string, unitPrice: string): FuelLine {
  return { label: "DIESEL #2", category: "motor_fuel", fuelType: "diesel", quantity, unit: "gal", unitPrice };
}
export function reefer(quantity: string, unitPrice: string): FuelLine {
  return { label: "REEFER DIESEL", category: "reefer_fuel", fuelType: "reefer_diesel", quantity, unit: "gal", unitPrice };
}
export function def(quantity: string, unitPrice: string): FuelLine {
  return { label: "DEF BULK", category: "def", fuelType: "def", quantity, unit: "gal", unitPrice };
}

export function lineAmount(line: FuelLine): string {
  return formatFixed(money(toDecimal(line.quantity).times(toDecimal(line.unitPrice))), 2);
}

export function receiptTotal(spec: ReceiptSpec): string {
  let total = money("0");
  for (const l of spec.lines) total = total.plus(lineAmount(l));
  if (spec.fee) total = total.plus(spec.fee.amount);
  if (spec.credit) total = total.minus(spec.credit.amount);
  return formatFixed(total, 2);
}

function usDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

/** The printed lines of a receipt, in order. Shared by the SVG and PDF renderers. */
export function receiptLines(spec: ReceiptSpec): string[] {
  const s = spec.station;
  const w = 32;
  const row = (left: string, right: string) => left.padEnd(w - right.length) + right;
  const lines: string[] = [
    `${s.name} ${s.store}`.trim(),
    s.street,
    `${s.city}, ${s.state} ${s.zip}`,
    "-".repeat(w),
    `DATE ${usDate(spec.date)}  TIME ${spec.time}`,
    `PUMP ${spec.pump}${spec.unit ? `     UNIT ${spec.unit}` : ""}`,
  ];
  if (spec.odometer) lines.push(`ODOMETER ${spec.odometer}`);
  if (spec.driver) lines.push(`DRIVER: ${spec.driver}`);
  lines.push("-".repeat(w));
  for (const l of spec.lines) {
    const qty = `${l.quantity} ${l.unit === "gal" ? "GAL" : "L"}`;
    lines.push(`${l.label}`);
    lines.push(row(`  ${qty} @ ${l.unitPrice}`, lineAmount(l)));
  }
  if (spec.fee) lines.push(row(spec.fee.label, spec.fee.amount));
  if (spec.credit) lines.push(row(spec.credit.label, `-${spec.credit.amount}`));
  lines.push("-".repeat(w));
  lines.push(row(`TOTAL ${spec.currency}`, receiptTotal(spec)));
  lines.push(`FUEL CARD ****${spec.cardLast4}`);
  lines.push("-".repeat(w));
  if (spec.purchaser) lines.push(spec.purchaser);
  lines.push("THANK YOU - DRIVE SAFE");
  return lines;
}

function field(raw: string | null, value: unknown, legibility: "clear" | "partial" | "unreadable" = "clear") {
  return { raw_text: raw, value, legibility };
}

/** Expected extraction for a receipt, with optional overrides for degraded variants. */
export function expectedReceipt(spec: ReceiptSpec, opts: { regionHint?: string | null; unreadableGallons?: boolean } = {}): Receipt {
  const s = spec.station;
  const total = receiptTotal(spec);
  const fields: Receipt["fields"] = {
    transaction_date: field(usDate(spec.date), spec.date),
    time: field(spec.time, spec.time),
    vendor: field(`${s.name} ${s.store}`.trim(), s.name),
    seller_address: field(`${s.street} ${s.city}, ${s.state} ${s.zip}`, `${s.street}, ${s.city}, ${s.state} ${s.zip}`),
    state: field(s.state, s.state),
    unit_number: spec.unit ? field(`UNIT ${spec.unit}`, spec.unit) : field(null, null),
    odometer: spec.odometer ? field(`ODOMETER ${spec.odometer}`, Number(spec.odometer)) : field(null, null),
    driver_name: spec.driver ? field(`DRIVER: ${spec.driver}`, spec.driver) : field(null, null),
    purchaser_name: spec.purchaser ? field(spec.purchaser, spec.purchaser) : field(null, null),
    payment_method: field(`FUEL CARD ****${spec.cardLast4}`, "fuel_card"),
    card_last4: field(`****${spec.cardLast4}`, spec.cardLast4),
    pump_number: field(`PUMP ${spec.pump}`, spec.pump),
    receipt_total: field(`TOTAL ${spec.currency} ${total}`, Number(total)),
    currency: field(spec.currency, spec.currency),
  };
  const line_items: LineItem[] = spec.lines.map((l, i) => {
    const unreadable = opts.unreadableGallons && i === 0;
    return {
      description_raw: `${l.label} ${l.quantity} ${l.unit === "gal" ? "GAL" : "L"} @ ${l.unitPrice}`,
      category: l.category,
      fuel_type: l.fuelType,
      quantity: unreadable ? null : Number(l.quantity),
      unit: l.unit,
      unit_price: Number(l.unitPrice),
      amount: Number(lineAmount(l)),
      legibility: unreadable ? "unreadable" : "clear",
    };
  });
  if (spec.fee) line_items.push({ description_raw: `${spec.fee.label} ${spec.fee.amount}`, category: "fee", quantity: null, unit: null, unit_price: null, amount: Number(spec.fee.amount), legibility: "clear" });
  if (spec.credit) line_items.push({ description_raw: `${spec.credit.label} -${spec.credit.amount}`, category: "credit", quantity: null, unit: null, unit_price: null, amount: -Number(spec.credit.amount), legibility: "clear" });
  return { region_hint: opts.regionHint ?? null, fields, line_items };
}

export interface Fixture {
  id: string;
  variant: Variant;
  format: "png" | "pdf";
  receipts: ReceiptSpec[];
  notes: string;
  /** For duplicates: copy this fixture's bytes instead of rendering. */
  duplicateOf?: string;
  unreadableGallons?: boolean;
}

function spec(
  stationKey: keyof typeof STATIONS,
  date: string,
  time: string,
  pump: string,
  unitIdx: number | null,
  odometer: string | null,
  driverIdx: number | null,
  lines: FuelLine[],
  extra: Partial<ReceiptSpec> = {},
): ReceiptSpec {
  const station = STATIONS[stationKey]!;
  return {
    station,
    date,
    time,
    pump,
    unit: unitIdx === null ? null : UNITS[unitIdx]!,
    odometer,
    driver: driverIdx === null ? null : DRIVERS[driverIdx]!,
    purchaser: "DEMO FREIGHT LLC",
    cardLast4: "4417",
    lines,
    currency: station.country === "CA" ? "CAD" : "USD",
    ...extra,
  };
}

/** The first 20 fixtures (Phase 0). Phase 1 grows this to 60+. */
export const FIXTURES: Fixture[] = [
  { id: "g001", variant: "clean", format: "png", notes: "clean thermal receipt", receipts: [spec("northstar", "2026-10-02", "06:41", "07", 1, "412885", 1, [diesel("118.420", "3.899")])] },
  { id: "g002", variant: "clean", format: "png", notes: "clean, different station/state", receipts: [spec("prairie", "2026-10-03", "14:12", "03", 0, "298114", 0, [diesel("96.105", "3.759")])] },
  { id: "g003", variant: "clean", format: "png", notes: "clean, Montana", receipts: [spec("bigsky", "2026-10-07", "19:55", "11", 2, "150332", 2, [diesel("142.880", "3.949")])] },
  { id: "g004", variant: "clean", format: "png", notes: "clean, Indiana (surcharge state)", receipts: [spec("greatlakes", "2026-10-09", "11:03", "02", 1, "413902", 1, [diesel("101.000", "3.829")])] },
  { id: "g005", variant: "clean", format: "png", notes: "clean, Texas", receipts: [spec("lonestar", "2026-10-12", "08:27", "14", 0, "299870", 0, [diesel("127.336", "3.599")])] },
  { id: "g006", variant: "clean", format: "png", notes: "clean, Ohio", receipts: [spec("buckeye", "2026-10-15", "16:48", "05", 2, "151776", 2, [diesel("88.250", "3.889")])] },
  { id: "g007", variant: "faded", format: "png", notes: "faded thermal print, low contrast", receipts: [spec("northstar", "2026-10-18", "05:58", "07", 1, "415010", 1, [diesel("120.004", "3.879")])] },
  { id: "g008", variant: "angled", format: "png", notes: "photo taken at an angle", receipts: [spec("prairie", "2026-10-20", "13:30", "01", 0, "301226", 0, [diesel("110.500", "3.769")])] },
  { id: "g009", variant: "crumpled", format: "png", notes: "crumpled receipt with crease lines", receipts: [spec("bigsky", "2026-10-22", "21:14", "09", 2, "152980", 2, [diesel("133.120", "3.939")])] },
  { id: "g010", variant: "reefer_and_tractor", format: "png", notes: "tractor diesel and reefer fuel on one receipt; reefer excluded from IFTA", receipts: [spec("greatlakes", "2026-10-24", "10:05", "02", 1, "416233", 1, [diesel("105.300", "3.819"), reefer("38.700", "3.719")])] },
  { id: "g011", variant: "def", format: "png", notes: "DEF line present; excluded from IFTA gallons", receipts: [spec("lonestar", "2026-10-27", "07:52", "12", 0, "302540", 0, [diesel("115.000", "3.609"), def("6.500", "3.199")])] },
  { id: "g012", variant: "liters_cad", format: "png", notes: "Canadian cardlock: liters and CAD", receipts: [spec("redriver", "2026-10-29", "15:21", "4", 2, "154108", 2, [{ label: "DIESEL", category: "motor_fuel", fuelType: "diesel", quantity: "452.300", unit: "L", unitPrice: "1.689" }])] },
  { id: "g013", variant: "missing_unit", format: "png", notes: "no unit number printed (V002/S001 path)", receipts: [spec("buckeye", "2026-11-01", "09:40", "06", null, null, null, [diesel("97.420", "3.869")])] },
  { id: "g014", variant: "duplicate", format: "png", notes: "byte-identical copy of g001 (D001)", receipts: [], duplicateOf: "g001" },
  { id: "g015", variant: "refund", format: "png", notes: "credit line for a pump misfill refund", receipts: [spec("northstar", "2026-11-03", "12:16", "08", 1, "417402", 1, [diesel("112.000", "3.899")], { credit: { label: "CREDIT MISFILL", amount: "15.60" } })] },
  { id: "g016", variant: "card_fee", format: "png", notes: "fuel card transaction fee as a non-fuel line", receipts: [spec("prairie", "2026-11-05", "17:09", "02", 0, "303771", 0, [diesel("104.260", "3.749")], { fee: { label: "CARD FEE", amount: "0.75" } })] },
  { id: "g017", variant: "unreadable_gallons", format: "png", notes: "gallons line smudged; value must be null, not guessed", receipts: [spec("bigsky", "2026-11-08", "20:33", "10", 2, "155690", 2, [diesel("129.900", "3.929")])], unreadableGallons: true },
  { id: "g018", variant: "multi_receipt", format: "png", notes: "two receipts in one photo -> two regions", receipts: [spec("greatlakes", "2026-11-10", "08:11", "01", 1, "418555", 1, [diesel("99.000", "3.809")]), spec("buckeye", "2026-11-10", "18:47", "03", 1, "419012", 1, [diesel("91.300", "3.879")])] },
  { id: "g019", variant: "multi_page_pdf", format: "pdf", notes: "three receipts, one per page, in a single PDF", receipts: [spec("lonestar", "2026-11-12", "06:20", "13", 0, "304900", 0, [diesel("118.700", "3.589")]), spec("northstar", "2026-11-14", "22:05", "06", 1, "420118", 1, [diesel("124.420", "3.899")]), spec("prairie", "2026-11-16", "11:58", "04", 2, "156873", 2, [diesel("87.650", "3.759")])] },
  { id: "g020", variant: "clean", format: "pdf", notes: "single-page PDF receipt (emailed)", receipts: [spec("buckeye", "2026-11-18", "14:02", "02", 0, "305611", 0, [diesel("109.090", "3.859")])] },
];

export function expectedFor(fixture: Fixture, resolveDuplicate: (id: string) => Fixture): GoldenExpected {
  const source = fixture.duplicateOf ? resolveDuplicate(fixture.duplicateOf) : fixture;
  const receipts = source.receipts.map((r, i) =>
    expectedReceipt(r, {
      regionHint: source.receipts.length > 1 ? (source.format === "pdf" ? `page ${i + 1}` : `receipt ${i + 1} of ${source.receipts.length}`) : null,
      unreadableGallons: source.unreadableGallons,
    }),
  );
  return { id: fixture.id, variant: fixture.variant, file: `${fixture.id}.${source.format}`, notes: fixture.notes, receipts };
}
