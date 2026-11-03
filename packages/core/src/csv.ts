/**
 * RFC 4180 CSV writer. CRLF line endings; a field is quoted when it contains a
 * comma, a double quote or a line break (quotes are doubled). `null` and
 * `undefined` become empty fields; numbers are written with `String()`, so
 * pass money/gallons as pre-formatted strings (see `formatFixed`).
 */
export type CsvCell = string | number | null | undefined;

export function csvEscape(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    if (row.length !== headers.length) {
      throw new RangeError(`CSV row has ${row.length} cells but there are ${headers.length} headers`);
    }
    lines.push(row.map(csvEscape).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}
