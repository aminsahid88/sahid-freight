/**
 * Period deliverables beyond CSV (docs/08-deliverables-spec.md):
 *  - PERIOD_PDF: cover, summary, fuel by state, mileage and MPG by vehicle,
 *    non-fuel spend, exceptions, reconciliation notes, IFTA worksheet when the
 *    rate table is loaded, transaction appendix; footer on every page.
 *  - SUPPORT_ZIP: the original documents renamed <date>_<state>_<vendor>_<txid>.<ext>,
 *    index.csv, the transactions CSV, the IFTA worksheet CSV when available,
 *    the period PDF and a manifest with every file's SHA-256.
 * Everything is derived from the same loaders the CSV reports use; numbers are
 * formatted from Decimal strings, never recomputed with floats.
 */
import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { zipSync } from "fflate";
import {
  type Column,
  formatFixed,
  type IftaWorksheetJson,
  PdfDoc,
  sum,
  toCsv,
  toDecimal,
  toIsoDate,
  ZERO,
} from "@tbo/core";
import type { Storage } from "../storage";
import type { TenantClient } from "../tenant/client";
import {
  buildIftaWorksheet,
  IFTA_DISCLAIMER,
  type PeriodRow,
  periodIssueWhere,
  periodTimestampRange,
} from "./ifta";
import { activeMileage } from "./mileage-rules";
import {
  buildIftaWorksheetCsv,
  buildTransactionsCsv,
  type TransactionCsvRow,
} from "./reports";
import { loadTransactionCsvRows } from "./reports.routes";
import { fuelByState } from "./summary";

export interface PeriodReportInput {
  prisma: PrismaClient;
  db: TenantClient;
  companyId: string;
  period: PeriodRow;
  status: "PRELIMINARY" | "REVIEWED";
  snapshotId: string;
  generatedAt: Date;
}

interface Gathered {
  company: {
    legalName: string;
    dba: string | null;
    usdot: string | null;
    mcNumber: string | null;
    iftaBaseJurisdiction: string | null;
  };
  rows: TransactionCsvRow[];
  documents: { total: number; byStatus: Record<string, number> };
  openIssues: Array<{
    code: string;
    severity: string;
    message: string;
    transactionId: string | null;
    document: { id: string; filename: string; page: number | null } | null;
  }>;
  fuel: ReturnType<typeof fuelByState>;
  mileage: Array<{
    unitNumber: string;
    totalMiles: string;
    taxableMiles: string;
    motorFuelGallons: string | null;
    mpg: string | null;
  }>;
  nonFuel: Array<{ category: string; amount: string }>;
  worksheet: IftaWorksheetJson | null;
  quarter: string;
  rateSource: string | null;
}

const money = (v: string | null | undefined) =>
  v === null || v === undefined ? "" : `$${formatFixed(v, 2)}`;
const gal = (v: string | null | undefined) =>
  v === null || v === undefined ? "" : formatFixed(v, 3);
const dateOf = (d: Date | null) => (d ? toIsoDate(d) : "");

export async function gatherPeriod(
  input: PeriodReportInput,
): Promise<Gathered> {
  const { prisma, db, companyId, period } = input;
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: {
      legalName: true,
      dba: true,
      usdot: true,
      mcNumber: true,
      iftaBaseJurisdiction: true,
    },
  });
  const rows = await loadTransactionCsvRows(db, period.id);

  const docGroups = await db.document.groupBy({
    by: ["status"],
    where: { receivedAt: periodTimestampRange(period), deletedAt: null },
    _count: { _all: true },
  });
  const byStatus: Record<string, number> = {};
  for (const g of docGroups) byStatus[g.status] = g._count._all;
  const documents = {
    total: Object.values(byStatus).reduce((a, b) => a + b, 0),
    byStatus,
  };

  const issues = await db.issue.findMany({
    where: { status: "OPEN", ...periodIssueWhere(period) },
    orderBy: [{ severity: "asc" }, { createdAt: "asc" }],
    include: {
      document: { select: { id: true, filename: true } },
      transaction: {
        select: {
          region: {
            select: {
              page: true,
              document: { select: { id: true, filename: true } },
            },
          },
        },
      },
    },
  });
  const openIssues = issues.map((i) => ({
    code: i.code,
    severity: i.severity,
    message: i.message,
    transactionId: i.transactionId,
    document: i.document
      ? { id: i.document.id, filename: i.document.filename, page: null }
      : i.transaction?.region
        ? {
            id: i.transaction.region.document.id,
            filename: i.transaction.region.document.filename,
            page: i.transaction.region.page,
          }
        : null,
  }));

  const txs = await db.transaction.findMany({
    where: { periodId: period.id },
    select: {
      state: true,
      vehicleId: true,
      lines: {
        select: { category: true, quantity: true, amount: true, unit: true },
      },
    },
  });
  const fuel = fuelByState(
    txs.flatMap((t) =>
      t.lines.map((l) => ({
        state: t.state,
        category: l.category,
        quantity: l.quantity,
        amount: l.amount,
      })),
    ),
  );

  // Mileage and MPG per vehicle: active ELD rows and this vehicle's motor-fuel gallons.
  const records = await activeMileage(db, period);
  const vehicleIds = [...new Set(records.map((r) => r.vehicleId))];
  const vehicles = vehicleIds.length
    ? await db.vehicle.findMany({
        where: { id: { in: vehicleIds } },
        select: { id: true, unitNumber: true },
      })
    : [];
  const unitOf = new Map(vehicles.map((v) => [v.id, v.unitNumber]));
  const galByVehicle = new Map<string, ReturnType<typeof toDecimal>>();
  for (const t of txs) {
    if (!t.vehicleId) continue;
    for (const l of t.lines)
      if (l.category === "MOTOR_FUEL" && l.quantity !== null && l.unit !== "L")
        galByVehicle.set(
          t.vehicleId,
          (galByVehicle.get(t.vehicleId) ?? ZERO).plus(l.quantity.toString()),
        );
  }
  const milesByVehicle = new Map<
    string,
    {
      total: ReturnType<typeof toDecimal>;
      taxable: ReturnType<typeof toDecimal>;
    }
  >();
  for (const r of records) {
    const m = milesByVehicle.get(r.vehicleId) ?? { total: ZERO, taxable: ZERO };
    m.total = m.total.plus(r.totalMiles.toString());
    m.taxable = m.taxable.plus(r.taxableMiles.toString());
    milesByVehicle.set(r.vehicleId, m);
  }
  const mileage = [...milesByVehicle.entries()]
    .map(([vehicleId, m]) => {
      const g = galByVehicle.get(vehicleId) ?? null;
      return {
        unitNumber: unitOf.get(vehicleId) ?? vehicleId,
        totalMiles: formatFixed(m.total, 3),
        taxableMiles: formatFixed(m.taxable, 3),
        motorFuelGallons: g ? formatFixed(g, 3) : null,
        mpg: g && g.gt(0) ? formatFixed(m.total.div(g), 2) : null,
      };
    })
    .sort((a, b) => a.unitNumber.localeCompare(b.unitNumber));

  const nonFuelMap = new Map<string, ReturnType<typeof toDecimal>>();
  for (const t of txs)
    for (const l of t.lines)
      if (
        !["MOTOR_FUEL", "REEFER_FUEL", "DEF"].includes(l.category) &&
        l.amount !== null
      )
        nonFuelMap.set(
          l.category,
          (nonFuelMap.get(l.category) ?? ZERO).plus(l.amount.toString()),
        );
  const nonFuel = [...nonFuelMap.entries()]
    .map(([category, amount]) => ({ category, amount: formatFixed(amount, 2) }))
    .sort((a, b) => a.category.localeCompare(b.category));

  const built = await buildIftaWorksheet(db, period);
  return {
    company,
    rows,
    documents,
    openIssues,
    fuel,
    mileage,
    nonFuel,
    worksheet: built.ok ? built.worksheet : null,
    quarter: built.quarter,
    rateSource: built.ok
      ? `${built.rateSource.sourceUrl} (loaded ${toIsoDate(built.rateSource.importedAt)})`
      : null,
  };
}

export function buildPeriodPdf(input: PeriodReportInput, g: Gathered): Buffer {
  const { period, status, snapshotId, generatedAt } = input;
  const label = `${toIsoDate(period.startDate)} to ${toIsoDate(period.endDate)}`;
  const name = g.company.dba ?? g.company.legalName;
  const doc = new PdfDoc(() => `${name} · ${label} · ${status}`);

  // Cover
  doc.space(40);
  doc.line("SAHID FREIGHT · PERIOD REPORT", {
    size: 9,
    grey: 0.45,
    bold: true,
  });
  doc.space(10);
  doc.line(name, { size: 24, bold: true, leading: 32 });
  doc.line(label, { size: 13, grey: 0.35, leading: 22 });
  doc.space(16);
  doc.keyValue([
    ["Legal name", g.company.legalName],
    ["USDOT / MC", `${g.company.usdot ?? "—"} / ${g.company.mcNumber ?? "—"}`],
    ["IFTA base jurisdiction", g.company.iftaBaseJurisdiction ?? "—"],
    ["Status", status],
    [
      "Generated",
      generatedAt.toISOString().replace("T", " ").slice(0, 16) + " UTC",
    ],
    ["Snapshot id", snapshotId],
  ]);
  doc.space(10);
  doc.paragraph(
    status === "PRELIMINARY"
      ? "PRELIMINARY: open error issues remain or the period is not yet approved. Numbers may change until review is complete."
      : "REVIEWED: every error issue was resolved and the owner approved the period.",
    { size: 9.5, grey: 0.35 },
  );
  doc.paragraph(IFTA_DISCLAIMER, { size: 9.5, grey: 0.35 });

  // Summary
  const statusCount = (s: string) =>
    g.rows.filter((r) => r.status === s).length;
  const verified = statusCount("VERIFIED");
  const pct = g.rows.length
    ? formatFixed(toDecimal(verified).div(g.rows.length).times(100), 1)
    : "0.0";
  const sev = (s: string) =>
    g.openIssues.filter((i) => i.severity === s).length;
  doc.heading("Summary");
  doc.keyValue([
    [
      "Documents received",
      `${g.documents.total} (${
        Object.entries(g.documents.byStatus)
          .map(([k, v]) => `${v} ${k.toLowerCase()}`)
          .join(", ") || "none"
      })`,
    ],
    [
      "Transactions",
      `${g.rows.length} (${verified} verified, ${statusCount("NEEDS_ATTENTION")} need attention, ${statusCount("UNABLE_TO_VERIFY")} unable to verify)`,
    ],
    ["Verified", `${pct}%`],
    [
      "Open issues",
      `${sev("ERROR")} errors, ${sev("WARNING")} warnings, ${sev("INFO")} info`,
    ],
  ]);

  // Fuel by state
  doc.heading("Fuel by state");
  doc.paragraph(
    "Motor fuel only counts toward IFTA. Reefer fuel and DEF are shown separately and never enter taxable gallons.",
    { size: 9.5, grey: 0.35 },
  );
  doc.table(
    [
      { header: "State", width: 70 },
      { header: "Motor-fuel gal", width: 110, align: "right" },
      { header: "Motor-fuel $", width: 110, align: "right" },
      { header: "Reefer gal", width: 110, align: "right" },
      { header: "DEF gal", width: 116, align: "right" },
    ],
    g.fuel.length
      ? g.fuel.map((f) => [
          f.state,
          gal(f.motorFuelGallons),
          money(f.motorFuelAmount),
          gal(f.reeferGallons),
          gal(f.defGallons),
        ])
      : [["—", "", "", "", ""]],
    { zebra: true },
  );

  // Mileage and MPG
  doc.heading("Mileage and MPG by vehicle");
  if (g.mileage.length === 0)
    doc.paragraph("No ELD mileage imported for this period.", {
      size: 9.5,
      grey: 0.35,
    });
  else
    doc.table(
      [
        { header: "Unit", width: 90 },
        { header: "Total miles", width: 110, align: "right" },
        { header: "Taxable miles", width: 110, align: "right" },
        { header: "Motor-fuel gal", width: 110, align: "right" },
        { header: "MPG", width: 96, align: "right" },
      ],
      g.mileage.map((m) => [
        m.unitNumber,
        gal(m.totalMiles),
        gal(m.taxableMiles),
        m.motorFuelGallons ?? "",
        m.mpg ?? "",
      ]),
      { zebra: true },
    );

  // Non-fuel
  doc.heading("Non-fuel spend by category");
  if (g.nonFuel.length === 0)
    doc.paragraph("No non-fuel charges in this period.", {
      size: 9.5,
      grey: 0.35,
    });
  else
    doc.table(
      [
        { header: "Category", width: 300 },
        { header: "Amount", width: 216, align: "right" },
      ],
      g.nonFuel.map((n) => [n.category, money(n.amount)]),
      { zebra: true },
    );

  // Exceptions
  doc.heading("Exceptions");
  if (g.openIssues.length === 0)
    doc.paragraph("No open issues.", { size: 9.5, grey: 0.35 });
  else
    doc.table(
      [
        { header: "Sev.", width: 60 },
        { header: "Code", width: 50 },
        { header: "What the check found", width: 256 },
        { header: "Source", width: 150 },
      ],
      g.openIssues.map((i) => [
        i.severity,
        i.code,
        i.message,
        i.document
          ? `${i.document.filename}${i.document.page ? ` p.${i.document.page}` : ""}`
          : "",
      ]),
      { size: 8.5, zebra: true },
    );

  // IFTA worksheet
  doc.heading(`IFTA worksheet · ${g.quarter}`);
  if (!g.worksheet)
    doc.paragraph(
      `The official IFTA rate table for ${g.quarter} is not loaded (I001); the worksheet is withheld rather than estimated.`,
      { size: 9.5, grey: 0.35 },
    );
  else {
    const w = g.worksheet;
    const worksheetColumns: Column[] = [
      { header: "Jur.", width: 36 },
      { header: "Total mi", width: 62, align: "right" },
      { header: "Taxable mi", width: 62, align: "right" },
      { header: "Consumed", width: 64, align: "right" },
      { header: "Tax-paid", width: 64, align: "right" },
      { header: "Net gal", width: 64, align: "right" },
      { header: "Rate", width: 52, align: "right" },
      { header: "Surch.", width: 46, align: "right" },
      { header: "Tax due", width: 66, align: "right" },
    ];
    doc.table(
      worksheetColumns,
      w.rows.map((r) => [
        r.jurisdiction,
        gal(r.totalMiles),
        gal(r.taxableMiles),
        r.gallonsConsumed ?? "",
        gal(r.taxPaidGallons),
        r.netTaxableGallons ?? "",
        r.rate ?? "",
        r.surcharge ?? "",
        r.taxDue === null ? "" : money(r.taxDue),
      ]),
      { size: 8, zebra: true },
    );
    doc.keyValue([
      ["Fleet MPG", w.fleetMpg ?? "—"],
      [
        "Totals",
        `${gal(w.totals.totalMiles)} mi · ${gal(w.totals.totalTaxableMiles)} taxable mi · ${gal(w.totals.totalTaxableGallons)} tax-paid gal${w.totals.totalTaxDue ? ` · tax due ${money(w.totals.totalTaxDue)}` : ""}`,
      ],
      ["Rate table", g.rateSource ?? "—"],
    ]);
    doc.subheading("Reconciliation notes");
    for (const n of w.roundingNotes)
      doc.paragraph(`· ${n}`, { size: 9, grey: 0.3 });
  }

  // Appendix
  doc.heading("Appendix · transactions");
  if (g.rows.length === 0)
    doc.paragraph("No transactions in this period.", { size: 9.5, grey: 0.35 });
  else
    doc.table(
      [
        { header: "Date", width: 62 },
        { header: "Vendor", width: 150 },
        { header: "St", width: 28 },
        { header: "Unit", width: 44 },
        { header: "Gallons", width: 66, align: "right" },
        { header: "Total", width: 70, align: "right" },
        { header: "Status", width: 96 },
      ],
      g.rows.map((r) => {
        const motor = r.lines
          .filter((l) => l.category === "MOTOR_FUEL" && l.quantity !== null)
          .map((l) => l.quantity!.toString());
        return [
          dateOf(r.date),
          r.vendor ?? "",
          r.state ?? "",
          r.vehicleUnit ?? "",
          motor.length ? formatFixed(sum(motor), 3) : "",
          r.receiptTotal === null ? "" : money(r.receiptTotal.toString()),
          r.status.replace(/_/g, " ").toLowerCase(),
        ];
      }),
      { size: 8, zebra: true },
    );

  return doc.toBuffer();
}

function safeName(s: string | null | undefined, fallback: string): string {
  const t = (s ?? "")
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return t || fallback;
}

export interface ZipInput extends PeriodReportInput {
  storage: Storage;
  periodPdf: Buffer;
  status: "PRELIMINARY" | "REVIEWED";
}

/** Original documents renamed per the spec, plus index.csv, CSV reports, the PDF and a manifest. */
export async function buildSupportZip(
  input: ZipInput,
  g: Gathered,
): Promise<Buffer> {
  const { db, storage, period, status, snapshotId, periodPdf } = input;
  const files: Record<string, Uint8Array> = {};
  const indexHeaders = [
    "file",
    "transaction_id",
    "date",
    "state",
    "vendor",
    "receipt_total",
    "source_document_id",
    "source_filename",
    "sha256",
  ];
  const index: string[][] = [];
  const manifest: Array<{ file: string; sha256: string; bytes: number }> = [];
  const add = (name: string, bytes: Buffer) => {
    files[name] = new Uint8Array(bytes);
    manifest.push({
      file: name,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length,
    });
  };

  const docIds = [
    ...new Set(
      g.rows.map((r) => r.sourceDocumentId).filter((x): x is string => !!x),
    ),
  ];
  const docs = docIds.length
    ? await db.document.findMany({
        where: { id: { in: docIds }, deletedAt: null },
        select: { id: true, storageKey: true, filename: true, mimeType: true },
      })
    : [];
  const docById = new Map(docs.map((d) => [d.id, d]));
  const used = new Set<string>();
  for (const r of g.rows) {
    const d = r.sourceDocumentId ? docById.get(r.sourceDocumentId) : undefined;
    if (!d) continue;
    const ext = (
      d.filename.match(/\.([A-Za-z0-9]{1,5})$/)?.[1] ??
      (d.mimeType === "application/pdf" ? "pdf" : "bin")
    ).toLowerCase();
    let name = `documents/${dateOf(r.date) || "undated"}_${r.state ?? "XX"}_${safeName(r.vendor, "vendor")}_${r.id.slice(0, 8)}.${ext}`;
    if (used.has(name))
      name = name.replace(/\.(\w+)$/, `_${r.id.slice(8, 12)}.$1`);
    used.add(name);
    let bytes: Buffer;
    try {
      bytes = await storage.get(d.storageKey);
    } catch {
      continue; // listed in the index without a file only when the original is unreadable
    }
    add(name, bytes);
    index.push([
      name,
      r.id,
      dateOf(r.date),
      r.state ?? "",
      r.vendor ?? "",
      r.receiptTotal === null ? "" : formatFixed(r.receiptTotal.toString(), 2),
      d.id,
      d.filename,
      manifest[manifest.length - 1]!.sha256,
    ]);
  }
  add("index.csv", Buffer.from(toCsv(indexHeaders, index), "utf8"));
  add("transactions.csv", Buffer.from(buildTransactionsCsv(g.rows), "utf8"));
  if (g.worksheet)
    add(
      "ifta-worksheet.csv",
      Buffer.from(
        buildIftaWorksheetCsv(g.worksheet, status, g.quarter),
        "utf8",
      ),
    );
  add("period-report.pdf", periodPdf);
  const readme = [
    `Sahid Freight · supporting package`,
    `Company: ${g.company.legalName}`,
    `Period: ${toIsoDate(period.startDate)} to ${toIsoDate(period.endDate)} · ${status}`,
    `Snapshot id: ${snapshotId}`,
    ``,
    `documents/  originals, renamed <date>_<state>_<vendor>_<transaction>.<ext>; bytes unchanged (see manifest.json for SHA-256)`,
    `index.csv   maps each file to its transaction`,
    `transactions.csv, ifta-worksheet.csv, period-report.pdf  the period deliverables`,
    ``,
    IFTA_DISCLAIMER,
  ].join("\n");
  add("README.txt", Buffer.from(readme, "utf8"));
  files["manifest.json"] = new Uint8Array(
    Buffer.from(
      JSON.stringify(
        {
          snapshotId,
          status,
          generatedAt: input.generatedAt.toISOString(),
          files: manifest,
        },
        null,
        2,
      ),
      "utf8",
    ),
  );
  return Buffer.from(zipSync(files, { level: 6 }));
}
