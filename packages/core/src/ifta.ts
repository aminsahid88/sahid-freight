/**
 * IFTA worksheet arithmetic (docs/05-ifta-logic.md). Pure and deterministic:
 * Decimal in, Decimal out, every rounding step written to `roundingNotes`.
 *
 * Callers are responsible for the inputs:
 *  - `mileage` holds distance records for qualified vehicles only.
 *  - `fuel` holds tax-paid MOTOR-FUEL gallons only. Reefer fuel and DEF never
 *    count as IFTA gallons; the API layer filters TransactionLine.category ===
 *    MOTOR_FUEL before calling this function and must test that filter itself.
 *  - `rates` come only from the loaded official rate table (IftaRate). Pass
 *    `null` when the quarter's table is not loaded; the worksheet is then
 *    produced without tax columns and flagged `ratesMissing` (rule I001).
 */
import { Decimal, type DecimalInput, formatFixed, toDecimal, ZERO } from "./decimal";

export interface IftaMileageInput {
  vehicleId: string;
  jurisdiction: string;
  totalMiles: DecimalInput;
  taxableMiles: DecimalInput;
}

export interface IftaFuelInput {
  jurisdiction: string;
  /** Tax-paid motor-fuel gallons purchased in the jurisdiction. */
  gallons: DecimalInput;
}

export interface IftaRateInput {
  jurisdiction: string;
  rate: DecimalInput;
  surcharge?: DecimalInput | null;
}

export interface IftaWorksheetInput {
  mileage: IftaMileageInput[];
  fuel: IftaFuelInput[];
  rates: IftaRateInput[] | null;
  /** Decimal places for fleet MPG (base-jurisdiction rule; default 2). */
  mpgDecimals?: number;
}

export interface IftaJurisdictionRow {
  jurisdiction: string;
  totalMiles: Decimal;
  taxableMiles: Decimal;
  /** taxableMiles / fleetMpg, 3 dp; null when fleet MPG is undefined. */
  gallonsConsumed: Decimal | null;
  taxPaidGallons: Decimal;
  /** gallonsConsumed − taxPaidGallons, 3 dp; negative means a credit. */
  netTaxableGallons: Decimal | null;
  rate: Decimal | null;
  surcharge: Decimal | null;
  /** net × rate (+ net × surcharge), 2 dp; null without a rate or without MPG. */
  taxDue: Decimal | null;
}

export interface IftaWorksheet {
  totals: {
    totalMiles: Decimal;
    totalTaxableMiles: Decimal;
    totalTaxableGallons: Decimal;
    /** Sum of per-jurisdiction gallonsConsumed (null when MPG is undefined). */
    totalGallonsConsumed: Decimal | null;
    /** Sum of per-jurisdiction taxDue over rows that have one; null when no row has one. */
    totalTaxDue: Decimal | null;
  };
  fleetMpg: Decimal | null;
  mpgDecimals: number;
  rows: IftaJurisdictionRow[];
  roundingNotes: string[];
  /** True when `rates` was null or any jurisdiction with activity has no rate row. */
  ratesMissing: boolean;
  missingRateJurisdictions: string[];
}

const HALF_UP = Decimal.ROUND_HALF_UP;

function normalizeJurisdiction(code: string): string {
  return code.trim().toUpperCase();
}

export function computeIftaWorksheet(input: IftaWorksheetInput): IftaWorksheet {
  const mpgDecimals = input.mpgDecimals ?? 2;
  if (!Number.isInteger(mpgDecimals) || mpgDecimals < 0 || mpgDecimals > 6) {
    throw new RangeError(`mpgDecimals must be an integer between 0 and 6, got ${mpgDecimals}`);
  }
  const notes: string[] = [];

  // Aggregate miles per jurisdiction (across vehicles) and fleet totals.
  const miles = new Map<string, { total: Decimal; taxable: Decimal }>();
  let totalMiles = ZERO;
  let totalTaxableMiles = ZERO;
  for (const m of input.mileage) {
    const j = normalizeJurisdiction(m.jurisdiction);
    const total = toDecimal(m.totalMiles);
    const taxable = toDecimal(m.taxableMiles);
    const cur = miles.get(j) ?? { total: ZERO, taxable: ZERO };
    miles.set(j, { total: cur.total.plus(total), taxable: cur.taxable.plus(taxable) });
    totalMiles = totalMiles.plus(total);
    totalTaxableMiles = totalTaxableMiles.plus(taxable);
  }

  // Aggregate tax-paid gallons per jurisdiction.
  const fuel = new Map<string, Decimal>();
  let totalTaxableGallons = ZERO;
  for (const f of input.fuel) {
    const j = normalizeJurisdiction(f.jurisdiction);
    const g = toDecimal(f.gallons);
    fuel.set(j, (fuel.get(j) ?? ZERO).plus(g));
    totalTaxableGallons = totalTaxableGallons.plus(g);
  }

  const rates = new Map<string, { rate: Decimal; surcharge: Decimal | null }>();
  if (input.rates) {
    for (const r of input.rates) {
      rates.set(normalizeJurisdiction(r.jurisdiction), {
        rate: toDecimal(r.rate),
        surcharge: r.surcharge === undefined || r.surcharge === null ? null : toDecimal(r.surcharge),
      });
    }
  }

  // Fleet MPG.
  let fleetMpg: Decimal | null = null;
  if (totalTaxableGallons.isZero()) {
    notes.push(
      `Fleet MPG undefined: total motor-fuel gallons are 0 (total miles ${totalMiles.toString()}); gallons consumed and tax cannot be computed.`,
    );
  } else {
    fleetMpg = totalMiles.div(totalTaxableGallons).toDecimalPlaces(mpgDecimals, HALF_UP);
    notes.push(
      `Fleet MPG = total miles ${totalMiles.toString()} ÷ total motor-fuel gallons ${totalTaxableGallons.toString()} = ${totalMiles
        .div(totalTaxableGallons)
        .toSignificantDigits(12)
        .toString()}, rounded HALF_UP to ${mpgDecimals} decimal place(s) = ${fleetMpg.toString()}.`,
    );
    if (fleetMpg.isZero()) {
      notes.push("Fleet MPG rounds to 0; gallons consumed cannot be computed (division by zero).");
      fleetMpg = null;
    }
  }

  const jurisdictions = [...new Set([...miles.keys(), ...fuel.keys()])].sort();
  if (input.rates === null) notes.push("No rate table supplied for this quarter (I001): rate, surcharge and tax due are left blank.");

  const rows: IftaJurisdictionRow[] = [];
  const missingRateJurisdictions: string[] = [];
  let totalGallonsConsumed: Decimal | null = fleetMpg ? ZERO : null;
  let totalTaxDue: Decimal | null = null;

  for (const j of jurisdictions) {
    const m = miles.get(j) ?? { total: ZERO, taxable: ZERO };
    const taxPaid = fuel.get(j) ?? ZERO;
    if (!miles.has(j)) notes.push(`${j}: fuel purchased (${taxPaid.toString()} gal) but no miles recorded; shown with 0 miles (see rule M002).`);

    let gallonsConsumed: Decimal | null = null;
    let net: Decimal | null = null;
    if (fleetMpg) {
      const raw = m.taxable.div(fleetMpg);
      gallonsConsumed = raw.toDecimalPlaces(3, HALF_UP);
      net = gallonsConsumed.minus(taxPaid).toDecimalPlaces(3, HALF_UP);
      notes.push(
        `${j}: gallons consumed = taxable miles ${m.taxable.toString()} ÷ MPG ${fleetMpg.toString()} = ${raw
          .toSignificantDigits(12)
          .toString()}, rounded HALF_UP to 3 dp = ${gallonsConsumed.toFixed(3)}; net taxable gallons = ${gallonsConsumed.toFixed(3)} − tax-paid ${taxPaid.toFixed(3)} = ${net.toFixed(3)}.`,
      );
      totalGallonsConsumed = (totalGallonsConsumed ?? ZERO).plus(gallonsConsumed);
    }

    const rateRow = rates.get(j) ?? null;
    let taxDue: Decimal | null = null;
    if (input.rates !== null && !rateRow) {
      missingRateJurisdictions.push(j);
      notes.push(`${j}: no rate in the loaded table; tax due left blank.`);
    }
    if (rateRow && net) {
      const base = net.times(rateRow.rate);
      let unrounded = base;
      let formula = `${net.toFixed(3)} × rate ${rateRow.rate.toString()}`;
      if (rateRow.surcharge) {
        const sur = net.times(rateRow.surcharge);
        unrounded = base.plus(sur);
        formula += ` + ${net.toFixed(3)} × surcharge ${rateRow.surcharge.toString()}`;
      }
      taxDue = unrounded.toDecimalPlaces(2, HALF_UP);
      notes.push(`${j}: tax due = ${formula} = ${unrounded.toSignificantDigits(12).toString()}, rounded HALF_UP to 2 dp = ${taxDue.toString()}.`);
      totalTaxDue = (totalTaxDue ?? ZERO).plus(taxDue);
    }

    rows.push({
      jurisdiction: j,
      totalMiles: m.total,
      taxableMiles: m.taxable,
      gallonsConsumed,
      taxPaidGallons: taxPaid,
      netTaxableGallons: net,
      rate: rateRow?.rate ?? null,
      surcharge: rateRow?.surcharge ?? null,
      taxDue,
    });
  }

  return {
    totals: { totalMiles, totalTaxableMiles, totalTaxableGallons, totalGallonsConsumed, totalTaxDue },
    fleetMpg,
    mpgDecimals,
    rows,
    roundingNotes: notes,
    ratesMissing: input.rates === null || missingRateJurisdictions.length > 0,
    missingRateJurisdictions,
  };
}

/** JSON-friendly view: every Decimal becomes a fixed-place string (miles/gallons 3 dp, rates 5 dp, tax 2 dp). */
export interface IftaWorksheetJson {
  totals: { totalMiles: string; totalTaxableMiles: string; totalTaxableGallons: string; totalGallonsConsumed: string | null; totalTaxDue: string | null };
  fleetMpg: string | null;
  mpgDecimals: number;
  rows: Array<{
    jurisdiction: string;
    totalMiles: string;
    taxableMiles: string;
    gallonsConsumed: string | null;
    taxPaidGallons: string;
    netTaxableGallons: string | null;
    rate: string | null;
    surcharge: string | null;
    taxDue: string | null;
  }>;
  roundingNotes: string[];
  ratesMissing: boolean;
  missingRateJurisdictions: string[];
}

export function iftaWorksheetToJson(w: IftaWorksheet): IftaWorksheetJson {
  const f3 = (d: Decimal | null) => (d === null ? null : formatFixed(d, 3));
  return {
    totals: {
      totalMiles: formatFixed(w.totals.totalMiles, 3),
      totalTaxableMiles: formatFixed(w.totals.totalTaxableMiles, 3),
      totalTaxableGallons: formatFixed(w.totals.totalTaxableGallons, 3),
      totalGallonsConsumed: f3(w.totals.totalGallonsConsumed),
      totalTaxDue: w.totals.totalTaxDue === null ? null : formatFixed(w.totals.totalTaxDue, 2),
    },
    fleetMpg: w.fleetMpg === null ? null : formatFixed(w.fleetMpg, w.mpgDecimals),
    mpgDecimals: w.mpgDecimals,
    rows: w.rows.map((r) => ({
      jurisdiction: r.jurisdiction,
      totalMiles: formatFixed(r.totalMiles, 3),
      taxableMiles: formatFixed(r.taxableMiles, 3),
      gallonsConsumed: f3(r.gallonsConsumed),
      taxPaidGallons: formatFixed(r.taxPaidGallons, 3),
      netTaxableGallons: f3(r.netTaxableGallons),
      rate: r.rate === null ? null : formatFixed(r.rate, 5),
      surcharge: r.surcharge === null ? null : formatFixed(r.surcharge, 5),
      taxDue: r.taxDue === null ? null : formatFixed(r.taxDue, 2),
    })),
    roundingNotes: w.roundingNotes,
    ratesMissing: w.ratesMissing,
    missingRateJurisdictions: w.missingRateJurisdictions,
  };
}
