// Shared formatters. Mirrors apps/mobile/src/lib/constants.ts:formatPrice
// so both clients render the same way.

export function formatPrice(amount: number | null | undefined, currency: string = "ETB"): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return `— ${currency}`;
  }
  const n = Number(amount);
  // Thousands separator, no decimals (cargo amounts are typically whole units).
  const formatted = n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return `${formatted} ${currency}`;
}

export function formatDate(value: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", opts ?? { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
