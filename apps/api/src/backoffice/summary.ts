/**
 * Period summary arithmetic. Pure functions over plain rows so they can be
 * unit-tested without a database; the route in periods.routes.ts loads the
 * rows through the tenant client and calls these.
 */
import { Decimal, formatFixed, toDecimal, ZERO } from "@tbo/core";

export interface LineRow {
  state: string | null;
  category: string;
  quantity: Decimal | string | null;
  amount: Decimal | string | null;
}

export interface FuelByState {
  state: string;
  motorFuelGallons: string;
  motorFuelAmount: string;
  reeferGallons: string;
  defGallons: string;
}

/** Group motor fuel / reefer / DEF per state. Transactions with no state are excluded (reported as `unassigned`). */
export function fuelByState(lines: LineRow[]): FuelByState[] {
  const acc = new Map<string, { mg: Decimal; ma: Decimal; rg: Decimal; dg: Decimal }>();
  for (const l of lines) {
    if (!l.state) continue;
    const cur = acc.get(l.state) ?? { mg: ZERO, ma: ZERO, rg: ZERO, dg: ZERO };
    const qty = l.quantity === null ? ZERO : toDecimal(l.quantity);
    const amt = l.amount === null ? ZERO : toDecimal(l.amount);
    if (l.category === "MOTOR_FUEL") {
      cur.mg = cur.mg.plus(qty);
      cur.ma = cur.ma.plus(amt);
    } else if (l.category === "REEFER_FUEL") cur.rg = cur.rg.plus(qty);
    else if (l.category === "DEF") cur.dg = cur.dg.plus(qty);
    else continue;
    acc.set(l.state, cur);
  }
  return [...acc.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([state, v]) => ({
      state,
      motorFuelGallons: formatFixed(v.mg, 3),
      motorFuelAmount: formatFixed(v.ma, 2),
      reeferGallons: formatFixed(v.rg, 3),
      defGallons: formatFixed(v.dg, 3),
    }));
}

/** "0.0" when there are no transactions; otherwise verified / total × 100 at 1 dp (HALF_UP). */
export function verifiedPercent(verified: number, total: number): string {
  if (total === 0) return "0.0";
  return formatFixed(new Decimal(verified).times(100).div(total), 1);
}

export function countBy<K extends string>(rows: Array<{ key: K; count: number }>, keys: readonly K[]): Record<K, number> {
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  for (const r of rows) out[r.key] = (out[r.key] ?? 0) + r.count;
  return out;
}
