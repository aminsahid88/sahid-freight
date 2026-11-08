/**
 * Small PDF writer for the period report: Helvetica / Helvetica-Bold text,
 * rules and filled rectangles, automatic pagination and a footer on every
 * page. No dependency (the npm registry is blocked on the dev machine).
 *
 * Coordinates are PDF points with the origin at the bottom-left of a US
 * Letter page (612 × 792). Callers work top-down through `PdfDoc.cursor`.
 * Text is WinAnsi (latin-1); anything outside is replaced with "?".
 */

export const PAGE_W = 612;
export const PAGE_H = 792;
export const MARGIN = 48;

/** Helvetica advance widths (per 1000 em) for ASCII 32–126, from the AFM. */
const HELVETICA_WIDTHS: number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const HELVETICA_BOLD_WIDTHS: number[] = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

export function textWidth(text: string, size: number, bold = false): number {
  const table = bold ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS;
  let w = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    w += code >= 32 && code <= 126 ? table[code - 32]! : 556;
  }
  return (w / 1000) * size;
}

function toLatin1(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code === 0x2212) out += "-"; // minus sign
    else if (code === 0x2013 || code === 0x2014) out += "-";
    else if (code === 0x2019) out += "'";
    else if (code === 0x00d7) out += "x";
    else if (code === 0x00f7) out += "/";
    else out += code <= 0xff ? ch : "?";
  }
  return out;
}

function esc(text: string): string {
  return toLatin1(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/\r|\n/g, " ");
}

function num(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export interface TextOptions {
  size?: number;
  bold?: boolean;
  /** "left" (default), "right" (x is the right edge) or "center" (x is the middle). */
  align?: "left" | "right" | "center";
  /** 0–1 grey, default 0 (black). */
  grey?: number;
  /** Clip to this width by trimming with an ellipsis. */
  maxWidth?: number;
}

export interface Column {
  header: string;
  /** Width in points. */
  width: number;
  align?: "left" | "right";
}

export class PdfDoc {
  private pages: string[][] = [];
  private ops: string[] = [];
  /** Current baseline y for top-down writing. */
  cursor = PAGE_H - MARGIN;
  private footerText: (page: number, total: number) => string;

  constructor(footer: (page: number, total: number) => string = () => "") {
    this.footerText = footer;
    this.newPage();
  }

  get pageNumber(): number {
    return this.pages.length;
  }

  newPage(): void {
    if (this.ops.length) this.pages.push(this.ops);
    this.ops = [];
    this.cursor = PAGE_H - MARGIN;
  }

  /** Start a new page when fewer than `needed` points remain above the footer. */
  ensure(needed: number): void {
    if (this.cursor - needed < MARGIN + 24) this.newPage();
  }

  text(x: number, y: number, text: string, o: TextOptions = {}): void {
    const size = o.size ?? 10;
    let t = text;
    if (o.maxWidth !== undefined && textWidth(t, size, o.bold) > o.maxWidth) {
      while (t.length > 1 && textWidth(`${t}…`, size, o.bold) > o.maxWidth) t = t.slice(0, -1);
      t = `${t}...`;
    }
    const w = textWidth(t, size, o.bold);
    const px = o.align === "right" ? x - w : o.align === "center" ? x - w / 2 : x;
    const grey = o.grey ?? 0;
    this.ops.push(`BT /${o.bold ? "F2" : "F1"} ${num(size)} Tf ${num(grey)} g ${num(px)} ${num(y)} Td (${esc(t)}) Tj ET`);
  }

  /** Write a line at the cursor and advance. */
  line(text: string, o: TextOptions & { indent?: number; leading?: number } = {}): void {
    const size = o.size ?? 10;
    const leading = o.leading ?? size * 1.45;
    this.ensure(leading);
    this.text(MARGIN + (o.indent ?? 0), this.cursor - size, text, o);
    this.cursor -= leading;
  }

  /** Wrap a paragraph to the content width and write it. */
  paragraph(text: string, o: TextOptions & { indent?: number; width?: number } = {}): void {
    const size = o.size ?? 10;
    const width = o.width ?? PAGE_W - MARGIN * 2 - (o.indent ?? 0);
    const words = toLatin1(text).split(/\s+/);
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (textWidth(candidate, size, o.bold) > width && current) {
        this.line(current, o);
        current = word;
      } else current = candidate;
    }
    if (current) this.line(current, o);
  }

  space(points = 8): void {
    this.cursor -= points;
  }

  rule(grey = 0.8): void {
    this.ensure(6);
    this.ops.push(`${num(grey)} G 0.5 w ${MARGIN} ${num(this.cursor)} m ${PAGE_W - MARGIN} ${num(this.cursor)} l S`);
    this.cursor -= 6;
  }

  heading(text: string, size = 16): void {
    this.ensure(size * 2.2);
    this.space(size * 0.6);
    this.line(text, { size, bold: true, leading: size * 1.5 });
  }

  subheading(text: string): void {
    this.space(6);
    this.line(text, { size: 11.5, bold: true, leading: 18 });
  }

  keyValue(rows: Array<[string, string]>, labelWidth = 160): void {
    for (const [k, v] of rows) {
      this.ensure(15);
      this.text(MARGIN, this.cursor - 10, k, { size: 9.5, grey: 0.45 });
      this.text(MARGIN + labelWidth, this.cursor - 10, v, { size: 10, maxWidth: PAGE_W - MARGIN * 2 - labelWidth });
      this.cursor -= 15;
    }
  }

  /** Table with a shaded header row, repeated on page breaks. */
  table(columns: Column[], rows: string[][], o: { size?: number; zebra?: boolean } = {}): void {
    const size = o.size ?? 9;
    const rowH = size * 1.7;
    const drawHeader = () => {
      this.ensure(rowH * 2);
      const y = this.cursor;
      this.ops.push(`0.93 g ${MARGIN} ${num(y - rowH)} ${num(PAGE_W - MARGIN * 2)} ${num(rowH)} re f`);
      let x = MARGIN;
      for (const c of columns) {
        const tx = c.align === "right" ? x + c.width - 6 : x + 6;
        this.text(tx, y - rowH + size * 0.55, c.header, { size: size - 0.5, bold: true, align: c.align === "right" ? "right" : "left", grey: 0.25, maxWidth: c.width - 12 });
        x += c.width;
      }
      this.cursor -= rowH;
    };
    drawHeader();
    rows.forEach((row, i) => {
      if (this.cursor - rowH < MARGIN + 24) {
        this.newPage();
        drawHeader();
      }
      const y = this.cursor;
      if (o.zebra && i % 2 === 1) this.ops.push(`0.975 g ${MARGIN} ${num(y - rowH)} ${num(PAGE_W - MARGIN * 2)} ${num(rowH)} re f`);
      let x = MARGIN;
      columns.forEach((c, j) => {
        const cell = row[j] ?? "";
        const tx = c.align === "right" ? x + c.width - 6 : x + 6;
        this.text(tx, y - rowH + size * 0.55, cell, { size, align: c.align === "right" ? "right" : "left", maxWidth: c.width - 12 });
        x += c.width;
      });
      this.ops.push(`0.85 G 0.4 w ${MARGIN} ${num(y - rowH)} m ${PAGE_W - MARGIN} ${num(y - rowH)} l S`);
      this.cursor -= rowH;
    });
    this.space(4);
  }

  /** Serialise. Footer (page x of y + caller text) is stamped on every page here, when the count is known. */
  toBuffer(): Buffer {
    if (this.ops.length) this.pages.push(this.ops);
    this.ops = [];
    const total = this.pages.length;
    const objects: string[] = [];
    const add = (body: string): number => {
      objects.push(body);
      return objects.length;
    };
    const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const contentNums: number[] = [];
    this.pages.forEach((ops, i) => {
      const footer = this.footerText(i + 1, total);
      const footerOps = [
        `0.85 G 0.5 w ${MARGIN} ${MARGIN - 6} m ${PAGE_W - MARGIN} ${MARGIN - 6} l S`,
        `BT /F1 8 Tf 0.45 g ${MARGIN} ${MARGIN - 18} Td (${esc(footer)}) Tj ET`,
        `BT /F1 8 Tf 0.45 g ${num(PAGE_W - MARGIN - textWidth(`Page ${i + 1} of ${total}`, 8))} ${MARGIN - 18} Td (${esc(`Page ${i + 1} of ${total}`)}) Tj ET`,
      ];
      const stream = [...ops, ...footerOps].join("\n");
      contentNums.push(add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`));
    });
    const pagesNum = objects.length + this.pages.length + 1;
    const pageNums = contentNums.map((c) => add(`<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${c} 0 R >>`));
    const pagesCheck = add(`<< /Type /Pages /Kids [${pageNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageNums.length} >>`);
    if (pagesCheck !== pagesNum) throw new Error("PDF object numbering drifted");
    const catalog = add(`<< /Type /Catalog /Pages ${pagesNum} 0 R >>`);

    let out = "%PDF-1.4\n%âãÏÓ\n";
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      offsets.push(Buffer.byteLength(out, "latin1"));
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = Buffer.byteLength(out, "latin1");
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(out, "latin1");
  }
}
