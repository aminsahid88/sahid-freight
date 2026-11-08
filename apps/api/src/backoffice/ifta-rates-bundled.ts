/**
 * Rate tables shipped with the release (apps/api/rates/<quarter>-<fuelType>.csv).
 *
 * On boot every file is read and, when the database has no table for that
 * quarter and fuel type, inserted. A table a platform admin loaded by hand is
 * never touched. A table this loader inserted earlier is replaced only when the
 * file's `# version=` changed (the matrix is re-read when it becomes final).
 *
 * File format: `# key=value` metadata lines (`source` required, `version`
 * required), other `#` lines are comments, one header line, then
 * `jurisdiction,rate[,surcharge]` rows. Rates are plain decimals; nothing is
 * computed or estimated here. The source URL stored on each row carries a
 * `#bundle=<version>` fragment so the origin of every row is visible.
 */
import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import type { PrismaClient } from "@prisma/client";
import { auditPlatform } from "../audit/log";

const FILE = /^(\d{4}Q[1-4])-([a-z]+)\.csv$/;
const RATE = /^\d{1,5}(\.\d{1,5})?$/;
const BUNDLE_MARK = "#bundle=";

export interface BundledTable {
  quarter: string;
  fuelType: string;
  sourceUrl: string;
  version: string;
  rows: Array<{ jurisdiction: string; rate: string; surcharge: string | null }>;
}

export function parseRateFile(name: string, text: string): BundledTable {
  const m = FILE.exec(name);
  if (!m) throw new Error(`rate file ${name}: name must look like 2026Q4-diesel.csv`);
  const meta: Record<string, string> = {};
  const rows: BundledTable["rows"] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      const kv = /^#\s*([a-z]+)=(.+)$/.exec(line);
      if (kv) meta[kv[1]!] = kv[2]!.trim().split(/\s+/)[0]!;
      continue;
    }
    if (/^(jurisdiction|state|jur)/i.test(line)) continue;
    const cells = line.split(/[,\t;]+/).map((c) => c.trim());
    const jurisdiction = (cells[0] ?? "").toUpperCase();
    const rate = cells[1] ?? "";
    const surcharge = cells[2] ? cells[2] : null;
    if (!/^[A-Z]{2}$/.test(jurisdiction)) throw new Error(`rate file ${name}: bad jurisdiction "${cells[0]}"`);
    if (!RATE.test(rate)) throw new Error(`rate file ${name}: bad rate "${rate}" for ${jurisdiction}`);
    if (surcharge !== null && !RATE.test(surcharge)) throw new Error(`rate file ${name}: bad surcharge "${surcharge}" for ${jurisdiction}`);
    if (seen.has(jurisdiction)) throw new Error(`rate file ${name}: ${jurisdiction} appears twice`);
    seen.add(jurisdiction);
    rows.push({ jurisdiction, rate, surcharge });
  }
  if (!meta.source || !/^https?:\/\//.test(meta.source)) throw new Error(`rate file ${name}: "# source=<url>" is required`);
  if (!meta.version) throw new Error(`rate file ${name}: "# version=<date>" is required`);
  if (rows.length === 0) throw new Error(`rate file ${name}: no rows`);
  return { quarter: m[1]!, fuelType: m[2]!, sourceUrl: meta.source, version: meta.version, rows };
}

export type BundledOutcome = "inserted" | "updated" | "unchanged" | "admin_table_kept" | "error";

export interface BundledResult {
  file: string;
  quarter: string;
  fuelType: string;
  outcome: BundledOutcome;
  rows: number;
  detail?: string;
}

/** Load one parsed table. Pure decision logic over what is already in the database. */
export async function applyBundledTable(prisma: PrismaClient, table: BundledTable, file: string): Promise<BundledResult> {
  const base = { file, quarter: table.quarter, fuelType: table.fuelType };
  const existing = await prisma.iftaRate.findMany({ where: { quarter: table.quarter, fuelType: table.fuelType }, select: { sourceUrl: true } });
  if (existing.length > 0) {
    const bundled = existing.every((r) => r.sourceUrl.includes(BUNDLE_MARK));
    if (!bundled) return { ...base, outcome: "admin_table_kept", rows: existing.length };
    const versions = new Set(existing.map((r) => r.sourceUrl.slice(r.sourceUrl.indexOf(BUNDLE_MARK) + BUNDLE_MARK.length)));
    if (versions.size === 1 && versions.has(table.version)) return { ...base, outcome: "unchanged", rows: existing.length };
  }
  const known = new Set((await prisma.jurisdiction.findMany({ select: { code: true } })).map((j) => j.code));
  const unknown = table.rows.map((r) => r.jurisdiction).filter((j) => !known.has(j));
  if (unknown.length) return { ...base, outcome: "error", rows: 0, detail: `unknown jurisdiction(s): ${unknown.join(", ")}` };

  const sourceUrl = `${table.sourceUrl}${BUNDLE_MARK}${table.version}`;
  const importedAt = new Date();
  await prisma.$transaction([
    // Replace the previous bundled version in full so a jurisdiction dropped from the file disappears too.
    prisma.iftaRate.deleteMany({ where: { quarter: table.quarter, fuelType: table.fuelType, sourceUrl: { contains: BUNDLE_MARK } } }),
    prisma.iftaRate.createMany({
      data: table.rows.map((r) => ({ quarter: table.quarter, jurisdiction: r.jurisdiction, fuelType: table.fuelType, rate: r.rate, surcharge: r.surcharge, sourceUrl, importedAt })),
    }),
  ]);
  await auditPlatform(prisma, {
    userId: null,
    action: "edit",
    target: `IftaRate:${table.quarter}`,
    meta: { quarter: table.quarter, fuelType: table.fuelType, rows: table.rows.length, sourceUrl, bundled: true, version: table.version, file },
  });
  return { ...base, outcome: existing.length ? "updated" : "inserted", rows: table.rows.length };
}

/** Read every rate file in `dir` and apply it. Never throws: a bad file is reported and skipped. */
export async function loadBundledRates(prisma: PrismaClient, dir: string): Promise<BundledResult[]> {
  let names: string[] = [];
  try {
    names = readdirSync(dir).filter((n) => FILE.test(n)).sort();
  } catch {
    return [];
  }
  const out: BundledResult[] = [];
  for (const name of names) {
    try {
      const table = parseRateFile(name, readFileSync(join(dir, name), "utf8"));
      out.push(await applyBundledTable(prisma, table, name));
    } catch (e) {
      const m = FILE.exec(name);
      out.push({ file: name, quarter: m?.[1] ?? "", fuelType: m?.[2] ?? "", outcome: "error", rows: 0, detail: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}

export function describeBundled(results: BundledResult[]): string {
  if (results.length === 0) return "Rate tables: none bundled";
  return `Rate tables: ${results.map((r) => `${r.quarter}/${r.fuelType} ${r.outcome}${r.rows ? ` (${r.rows})` : ""}${r.detail ? ` - ${r.detail}` : ""}`).join("; ")}`;
}
