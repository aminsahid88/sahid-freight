/**
 * Reporting periods, IFTA due dates and record retention.
 *
 * All functions work on calendar dates in UTC. Callers convert from the
 * company's timezone before calling (a receipt's printed date is already a
 * calendar date, so no conversion is needed for the main use case).
 */

export type Quarter = 1 | 2 | 3 | 4;

export interface QuarterPeriod {
  year: number;
  quarter: Quarter;
  /** e.g. "2026Q4" — matches the IftaRate.quarter key. */
  label: string;
  /** First day of the quarter (UTC midnight). */
  start: Date;
  /** Last day of the quarter (UTC midnight). */
  end: Date;
}

export class InvalidDateError extends Error {
  constructor(value: unknown) {
    super(`Invalid date: ${JSON.stringify(value)}`);
    this.name = "InvalidDateError";
  }
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse "YYYY-MM-DD" into a UTC-midnight Date, rejecting impossible dates like 2026-02-30. */
export function parseIsoDate(value: string): Date {
  const m = ISO_DATE.exec(value);
  if (!m) throw new InvalidDateError(value);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) {
    throw new InvalidDateError(value);
  }
  return date;
}

export function toIsoDate(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new InvalidDateError(date);
  return date.toISOString().slice(0, 10);
}

function asDate(value: Date | string): Date {
  if (typeof value === "string") return parseIsoDate(value);
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new InvalidDateError(value);
  return value;
}

export function quarterOf(value: Date | string): QuarterPeriod {
  const date = asDate(value);
  const year = date.getUTCFullYear();
  const quarter = (Math.floor(date.getUTCMonth() / 3) + 1) as Quarter;
  const startMonth = (quarter - 1) * 3;
  return {
    year,
    quarter,
    label: `${year}Q${quarter}`,
    start: new Date(Date.UTC(year, startMonth, 1)),
    end: new Date(Date.UTC(year, startMonth + 3, 0)),
  };
}

/**
 * IFTA quarterly returns are due on the last day of the month following the
 * quarter: Apr 30, Jul 31, Oct 31, Jan 31 (next year).
 */
export function iftaDueDate(year: number, quarter: Quarter): Date {
  // Month index of the month after the quarter end; day 0 of the following month = last day.
  const monthAfterQuarter = quarter * 3; // Q1 -> 3 (April), Q4 -> 12 (January next year)
  return new Date(Date.UTC(year, monthAfterQuarter + 1, 0));
}

/**
 * Records must be kept 4 years from the later of the return due date or the
 * filing date. At upload time the filing date is unknown, so we anchor on the
 * due date of the quarter containing `receivedAt`. Recompute from the filing
 * date once the return is filed.
 */
export function retentionUntil(receivedAt: Date | string, retentionYears = 4): Date {
  const q = quarterOf(receivedAt);
  const due = iftaDueDate(q.year, q.quarter);
  return new Date(Date.UTC(due.getUTCFullYear() + retentionYears, due.getUTCMonth(), due.getUTCDate()));
}

export function isWithinRetention(retentionUntilDate: Date, now: Date = new Date()): boolean {
  return now.getTime() < retentionUntilDate.getTime();
}

/** Whether a calendar date falls inside a period (inclusive). */
export function isInPeriod(value: Date | string, start: Date | string, end: Date | string): boolean {
  const t = asDate(value).getTime();
  return t >= asDate(start).getTime() && t <= asDate(end).getTime();
}

/** Add `n` U.S. business days (Mon–Fri; holidays not modelled) to a date, UTC. The review SLA is 1 business day. */
export function addBusinessDays(from: Date | string, n: number): Date {
  const d = new Date(typeof from === "string" ? parseIsoDate(from) : from.getTime());
  let left = n;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) left -= 1;
  }
  return d;
}
