/**
 * Minimal PDF writer: monospaced text pages, nothing else. Enough to produce
 * deterministic multi-page receipt PDFs for the golden set without a
 * dependency (the npm registry is blocked on the dev machine; see decisions log).
 */

function escapePdfText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export interface PdfPage {
  lines: string[];
}

/** Letter-size pages (612x792pt), Courier 11pt, 14pt leading. Returns the PDF bytes. */
export function buildTextPdf(pages: PdfPage[]): Buffer {
  const objects: string[] = [];
  const add = (body: string): number => {
    objects.push(body);
    return objects.length; // 1-based object number
  };

  const fontNum = add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");
  const pageNums: number[] = [];
  const pagesNumPlaceholder = objects.length + pages.length * 2 + 1; // computed below; we reserve order

  const contentNums: number[] = [];
  for (const page of pages) {
    const ops: string[] = ["BT", "/F1 11 Tf", "14 TL", "60 740 Td"];
    for (const line of page.lines) ops.push(`(${escapePdfText(line)}) Tj T*`);
    ops.push("ET");
    const stream = ops.join("\n");
    contentNums.push(add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`));
  }
  // Pages object number is known now: it is the next object after all page objects.
  const pagesNum = objects.length + pages.length + 1;
  void pagesNumPlaceholder;
  for (let i = 0; i < pages.length; i++) {
    pageNums.push(
      add(
        `<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontNum} 0 R >> >> /Contents ${contentNums[i]} 0 R >>`,
      ),
    );
  }
  const realPagesNum = add(`<< /Type /Pages /Kids [${pageNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${pageNums.length} >>`);
  if (realPagesNum !== pagesNum) throw new Error("pdf writer: object numbering drifted");
  const catalogNum = add(`<< /Type /Catalog /Pages ${pagesNum} 0 R >>`);

  let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogNum} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
