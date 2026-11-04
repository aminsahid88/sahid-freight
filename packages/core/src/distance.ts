/**
 * Distance units for ELD mileage imports. IFTA is filed in miles; Canadian
 * ELD reports arrive in kilometres and are converted here, once, with the
 * IFTA conversion factor, to 3 decimal places. Decimal in, decimal out.
 */
import { Decimal, type DecimalInput, miles, toDecimal } from "./decimal";

export const DISTANCE_UNITS = ["mi", "km"] as const;
export type DistanceUnit = (typeof DISTANCE_UNITS)[number];

/** IFTA's published factor (1 km = 0.62137 mi). */
export const KM_TO_MILES = "0.62137";

export function isDistanceUnit(value: string): value is DistanceUnit {
  return (DISTANCE_UNITS as readonly string[]).includes(value);
}

/** Convert a distance to miles at 3 dp; miles pass through (rounded to 3 dp). */
export function toMiles(value: DecimalInput, unit: DistanceUnit): Decimal {
  const d = toDecimal(value);
  return unit === "km" ? miles(d.times(KM_TO_MILES)) : miles(d);
}
