/**
 * Shared HTTP harness and seeding helpers for back-office route tests.
 * Not a test file itself (no `.test.ts` suffix). Each test file starts its own
 * server on a random port and tears it down in `after`.
 */
import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";
import type { IssueStatus, LineCategory, PeriodStatus, Prisma, Severity, TxStatus } from "@prisma/client";
import { getEnv } from "../config/env";
import { LocalStorage } from "../storage";
import { prisma, uid } from "../test/fixtures";
import { createBackofficeApp } from "./app";

export interface ApiResult {
  status: number;
  json: Record<string, unknown>;
  text: string;
}

export interface TestServer {
  base: string;
  storage: LocalStorage;
  api(method: string, url: string, token: string | null, body?: unknown, headers?: Record<string, string>): Promise<ApiResult>;
  close(): Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  const dir = mkdtempSync(path.join(os.tmpdir(), "tbo-routes-"));
  const env = getEnv();
  const storage = new LocalStorage({ dir, secret: env.JWT_SECRET, baseUrl: "http://localhost:0" });
  const { app } = createBackofficeApp({ prisma, env, storage });
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no address");
  const base = `http://127.0.0.1:${addr.port}`;

  async function api(method: string, url: string, token: string | null, body?: unknown, headers: Record<string, string> = {}): Promise<ApiResult> {
    const res = await fetch(base + url, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body instanceof FormData ? {} : body ? { "content-type": "application/json" } : {}),
        ...headers,
      },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = {};
    }
    return { status: res.status, json, text };
  }

  return {
    base,
    storage,
    api,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export function csvFile(name: string, content: string, field = "file"): FormData {
  const fd = new FormData();
  fd.append(field, new Blob([content], { type: "text/csv" }), name);
  return fd;
}

// ── Seeding ──────────────────────────────────────────────────────────────────

const JURISDICTIONS: Array<[string, string, string]> = [
  ["OH", "Ohio", "US"],
  ["IN", "Indiana", "US"],
  ["IL", "Illinois", "US"],
  ["MN", "Minnesota", "US"],
  ["TX", "Texas", "US"],
  ["KY", "Kentucky", "US"],
  ["TN", "Tennessee", "US"],
  ["ON", "Ontario", "CA"],
];

/** Reference data is global (not tenant-scoped); idempotent across test files. */
export async function seedJurisdictions(): Promise<void> {
  for (const [code, name, country] of JURISDICTIONS) {
    await prisma.jurisdiction.upsert({ where: { code }, update: {}, create: { code, name, country, iftaMember: true } });
  }
}

export const d = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

export async function seedPeriod(companyId: string, opts: { start?: string; end?: string; status?: PeriodStatus } = {}) {
  return prisma.reportingPeriod.create({
    data: { companyId, type: "QUARTER", startDate: d(opts.start ?? "2026-10-01"), endDate: d(opts.end ?? "2026-12-31"), status: opts.status ?? "OPEN" },
  });
}

export async function seedVehicle(companyId: string, unitNumber: string) {
  return prisma.vehicle.create({ data: { companyId, unitNumber } });
}

export async function seedDocument(companyId: string, opts: { filename?: string; receivedAt?: string; status?: "RECEIVED" | "PROCESSED" | "FAILED" } = {}) {
  const id = uid("doc");
  return prisma.document.create({
    data: {
      companyId,
      channel: "WEB",
      storageKey: `companies/${companyId}/documents/${id}/original.png`,
      filename: opts.filename ?? `${id}.png`,
      mimeType: "image/png",
      sizeBytes: 10,
      sha256: uid("sha"),
      status: opts.status ?? "PROCESSED",
      receivedAt: opts.receivedAt ? new Date(opts.receivedAt) : new Date("2026-10-20T12:00:00Z"),
      retentionUntil: d("2031-01-31"),
    },
  });
}

export interface SeedLine {
  category: LineCategory;
  quantity?: string | null;
  unitPrice?: string | null;
  amount?: string | null;
  fuelType?: string | null;
  descriptionRaw?: string;
}

export interface SeedTransactionOpts {
  periodId?: string | null;
  vehicleId?: string | null;
  driverId?: string | null;
  date?: string | null;
  time?: string | null;
  vendor?: string | null;
  sellerAddress?: string | null;
  state?: string | null;
  stateSource?: string | null;
  unitNumberRaw?: string | null;
  receiptTotal?: string | null;
  paymentMethod?: string | null;
  cardLast4?: string | null;
  status?: TxStatus;
  type?: "FUEL" | "EXPENSE" | "OTHER" | "UNKNOWN";
  lines?: SeedLine[];
  /** When true (default) a Document + DocumentRegion is created and linked through regionId. */
  withDocument?: boolean;
  documentId?: string;
  provenance?: Prisma.InputJsonValue;
}

/** A transaction row as extraction would produce it, with lines and (by default) a source document/region. */
export async function seedTransaction(companyId: string, opts: SeedTransactionOpts = {}) {
  let regionId: string | null = null;
  let documentId: string | null = opts.documentId ?? null;
  if (opts.withDocument !== false) {
    if (!documentId) documentId = (await seedDocument(companyId, { receivedAt: opts.date ? `${opts.date}T12:00:00Z` : undefined })).id;
    const region = await prisma.documentRegion.create({ data: { documentId, page: 1, bbox: { x: 0, y: 0, w: 1, h: 1 } } });
    regionId = region.id;
  }
  const tx = await prisma.transaction.create({
    data: {
      companyId,
      periodId: opts.periodId ?? null,
      regionId,
      vehicleId: opts.vehicleId ?? null,
      driverId: opts.driverId ?? null,
      type: opts.type ?? "FUEL",
      date: opts.date === null ? null : d(opts.date ?? "2026-10-15"),
      time: opts.time ?? "08:15",
      vendor: opts.vendor === undefined ? "Fictional Fuel Stop" : opts.vendor,
      sellerAddress: opts.sellerAddress === undefined ? "1 Demo Rd, Columbus, OH 43004" : opts.sellerAddress,
      state: opts.state === undefined ? "OH" : opts.state,
      stateSource: opts.stateSource === undefined ? "printed" : opts.stateSource,
      unitNumberRaw: opts.unitNumberRaw ?? null,
      receiptTotal: opts.receiptTotal === undefined ? "412.50" : opts.receiptTotal,
      paymentMethod: opts.paymentMethod ?? "card",
      cardLast4: opts.cardLast4 ?? "4242",
      status: opts.status ?? "NEEDS_ATTENTION",
      provenance: opts.provenance ?? { date: { passA: "2026-10-15", passB: "2026-10-15", final: "2026-10-15", finalSource: "agree" } },
      lines: {
        create: (opts.lines ?? [{ category: "MOTOR_FUEL", quantity: "100.000", unitPrice: "4.1250", amount: "412.50", fuelType: "diesel" }]).map((l) => ({
          descriptionRaw: l.descriptionRaw ?? l.category,
          category: l.category,
          fuelType: l.fuelType ?? (l.category === "MOTOR_FUEL" ? "diesel" : null),
          quantity: l.quantity ?? null,
          unit: l.quantity ? "gal" : null,
          unitPrice: l.unitPrice ?? null,
          amount: l.amount ?? null,
        })),
      },
    },
    include: { lines: true },
  });
  return { tx, documentId, regionId };
}

export async function seedIssue(
  companyId: string,
  opts: { transactionId?: string | null; documentId?: string | null; code?: string; severity?: Severity; status?: IssueStatus; message?: string } = {},
) {
  return prisma.issue.create({
    data: {
      companyId,
      transactionId: opts.transactionId ?? null,
      documentId: opts.documentId ?? null,
      code: opts.code ?? "F002",
      ruleVersion: "test-v1",
      severity: opts.severity ?? "ERROR",
      status: opts.status ?? "OPEN",
      message: opts.message ?? "Line items do not add up to the receipt total",
      fields: ["receiptTotal"],
      evidence: { sum: "400.00", total: "412.50" },
    },
  });
}

export async function seedMileage(companyId: string, importId: string | null, vehicleId: string, rows: Array<{ jurisdiction: string; total: string; taxable?: string }>, period = { start: "2026-10-01", end: "2026-12-31" }) {
  const imp = importId ? { id: importId } : await prisma.mileageImport.create({ data: { companyId, provider: "test" } });
  for (const r of rows) {
    await prisma.mileageRecord.create({
      data: { importId: imp.id, companyId, vehicleId, jurisdiction: r.jurisdiction, periodStart: d(period.start), periodEnd: d(period.end), totalMiles: r.total, taxableMiles: r.taxable ?? r.total },
    });
  }
  return imp;
}

export async function seedRates(quarter: string, rows: Array<{ jurisdiction: string; rate: string; surcharge?: string }>, fuelType = "diesel") {
  for (const r of rows) {
    await prisma.iftaRate.upsert({
      where: { quarter_jurisdiction_fuelType: { quarter, jurisdiction: r.jurisdiction, fuelType } },
      update: { rate: r.rate, surcharge: r.surcharge ?? null, sourceUrl: "https://example.test/rates" },
      create: { quarter, jurisdiction: r.jurisdiction, fuelType, rate: r.rate, surcharge: r.surcharge ?? null, sourceUrl: "https://example.test/rates" },
    });
  }
}
