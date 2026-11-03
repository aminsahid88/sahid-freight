/**
 * Reconciliation of two independent passes. Fields where the passes agree
 * after normalization are corroborated; disagreements on material fields are
 * reported (the V010 rule turns them into issues) and left for review with
 * pass A's value as the provisional final and finalSource "pass_a" only when
 * B is null; when both are non-null and differ, final is null (never pick).
 */
import type { NormalizedLine, NormalizedReceipt } from "./normalize";

export type FinalSource = "pass_a" | "pass_b" | "both" | "human" | "card" | "lookup" | null;

export interface FieldProvenance {
  rawText: string | null;
  passA: string | null;
  passB: string | null;
  final: string | null;
  finalSource: FinalSource;
  agree: boolean;
}

export type Provenance = Record<string, FieldProvenance>;

export const RECONCILE_MATERIAL_FIELDS = ["date", "state", "receiptTotal", "currency", "vendor"] as const;
export const SCALAR_FIELDS = ["date", "time", "vendor", "sellerAddress", "state", "unitNumber", "odometer", "driverName", "purchaserName", "paymentMethod", "cardLast4", "pumpNumber", "receiptTotal", "currency"] as const;
type ScalarField = (typeof SCALAR_FIELDS)[number];

function same(a: string | null, b: string | null, field: string): boolean {
  if (a === null || b === null) return a === b;
  if (["receiptTotal", "odometer", "quantity", "unitPrice", "amount"].includes(field)) return Number(a) === Number(b);
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function merge(field: string, rawText: string | null, a: string | null, b: string | null | undefined): FieldProvenance {
  const bv = b === undefined ? null : b;
  if (b === undefined) return { rawText, passA: a, passB: null, final: a, finalSource: a === null ? null : "pass_a", agree: false };
  if (same(a, bv, field)) return { rawText, passA: a, passB: bv, final: a, finalSource: a === null ? null : "both", agree: true };
  if (a === null) return { rawText, passA: a, passB: bv, final: bv, finalSource: "pass_b", agree: false };
  if (bv === null) return { rawText, passA: a, passB: bv, final: a, finalSource: "pass_a", agree: false };
  return { rawText, passA: a, passB: bv, final: null, finalSource: null, agree: false };
}

export interface Reconciled {
  final: NormalizedReceipt;
  provenance: Provenance;
  disagreements: Array<{ field: string; passA: string | null; passB: string | null; material: boolean }>;
  corroboration: "SINGLE_SOURCE" | "TWO_PASS";
}

const RAW_KEY: Record<ScalarField, string> = { date: "transaction_date", time: "time", vendor: "vendor", sellerAddress: "seller_address", state: "state", unitNumber: "unit_number", odometer: "odometer", driverName: "driver_name", purchaserName: "purchaser_name", paymentMethod: "payment_method", cardLast4: "card_last4", pumpNumber: "pump_number", receiptTotal: "receipt_total", currency: "currency" };

/** Lines are matched by index when both passes return the same count; otherwise pass A's lines stand and the count mismatch is a disagreement. */
export function reconcile(a: NormalizedReceipt, b: NormalizedReceipt | null): Reconciled {
  const provenance: Provenance = {};
  const disagreements: Reconciled["disagreements"] = [];
  const final: NormalizedReceipt = { ...a, lines: [], legibility: { ...a.legibility }, rawText: { ...a.rawText } };

  for (const field of SCALAR_FIELDS) {
    const p = merge(field, a.rawText[RAW_KEY[field]] ?? null, a[field], b ? b[field] : undefined);
    provenance[field] = p;
    (final as unknown as Record<string, unknown>)[field] = p.final;
    if (b && !p.agree && !(a[field] === null && b[field] === null)) {
      disagreements.push({ field, passA: p.passA, passB: p.passB, material: (RECONCILE_MATERIAL_FIELDS as readonly string[]).includes(field) });
    }
  }

  if (!b) {
    final.lines = a.lines;
    return { final, provenance, disagreements, corroboration: "SINGLE_SOURCE" };
  }

  if (a.lines.length !== b.lines.length) {
    disagreements.push({ field: "line_items.count", passA: String(a.lines.length), passB: String(b.lines.length), material: true });
    final.lines = a.lines;
  } else {
    final.lines = a.lines.map((la, i) => {
      const lb = b.lines[i]!;
      const out: NormalizedLine = { ...la };
      for (const k of ["quantity", "unitPrice", "amount"] as const) {
        const p = merge(k, null, la[k], lb[k]);
        provenance[`line_items.${i}.${k}`] = p;
        out[k] = p.final;
        if (!p.agree && !(la[k] === null && lb[k] === null)) disagreements.push({ field: `line_items.${i}.${k}`, passA: la[k], passB: lb[k], material: k !== "unitPrice" });
      }
      if (la.category !== lb.category) disagreements.push({ field: `line_items.${i}.category`, passA: la.category, passB: lb.category, material: true });
      return out;
    });
  }
  return { final, provenance, disagreements, corroboration: "TWO_PASS" };
}
