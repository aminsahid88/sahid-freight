/**
 * Review service: the reviewer's one-click decisions on a field, claims and
 * reviewer time, owner approval of material corrections, and the status
 * refresh that follows a human decision.
 *
 * Rules kept here:
 *  - The original extracted value is never overwritten: every decision lands
 *    in FieldEdit (old/new/reason/user) before the column changes; provenance
 *    (the two reads) stays as extraction wrote it.
 *  - A REVIEWER's change to a material field (docs/04 V010 list) is applied
 *    at once but opens Approval PENDING + issue R001 (error) until the OWNER
 *    approves; reject reverts through a second FieldEdit.
 *  - Status after a decision: UNABLE_TO_VERIFY when the reviewer marked the
 *    field unreadable; else NEEDS_ATTENTION while any ERROR issue is open,
 *    else VERIFIED (a person confirmed the values).
 */
import type { CompanyRole, PrismaClient } from "@prisma/client";
import { isMaterialField } from "@tbo/core";
import { audit } from "../audit/log";
import type { TenantClient } from "../tenant/client";
import { badRequest, HttpError, notFound } from "./errors";
import { EDITABLE_FIELDS, type EditableField, FIELD_VALUE_SCHEMAS } from "./transactions.routes";
import { parse } from "./errors";
import { z } from "zod";

export const REVIEW_CLAIM_MINUTES = 30;
export const R001 = { code: "R001", version: "R001-v1" } as const;

/** Contract field name (as the extraction contract and V010 use it) → Transaction column. */
export const CONTRACT_TO_COLUMN: Record<string, EditableField> = {
  transaction_date: "date",
  time: "time",
  vendor: "vendor",
  seller_address: "sellerAddress",
  state: "state",
  unit_number: "unitNumberRaw",
  odometer: "odometer",
  payment_method: "paymentMethod",
  card_last4: "cardLast4",
  receipt_total: "receiptTotal",
  currency: "currency",
};
/** Transaction column → provenance key (reconcile keys scalar fields by their camelCase name). */
const COLUMN_TO_PROVENANCE: Record<EditableField, string | null> = {
  date: "date",
  time: "time",
  vendor: "vendor",
  sellerAddress: "sellerAddress",
  state: "state",
  stateSource: null,
  unitNumberRaw: "unitNumber",
  vehicleId: null,
  odometer: "odometer",
  paymentMethod: "paymentMethod",
  cardLast4: "cardLast4",
  receiptTotal: "receiptTotal",
  currency: "currency",
  type: null,
};
const LINE_FIELD = /^line_items\.(\d+)\.(quantity|unit_price|amount)$/;
const LINE_COLUMN = { quantity: "quantity", unit_price: "unitPrice", amount: "amount" } as const;
const LINE_VALUE: Record<keyof typeof LINE_COLUMN, z.ZodType<string>> = {
  quantity: z.string().regex(/^\d{1,9}(\.\d{1,3})?$/, "must be a non-negative decimal with at most 3 places"),
  unit_price: z.string().regex(/^\d{1,6}(\.\d{1,4})?$/, "must be a non-negative decimal with at most 4 places"),
  amount: z.string().regex(/^-?\d{1,10}(\.\d{1,2})?$/, "must be a decimal with at most 2 places"),
};

export const FIELD_ACTIONS = ["accept_a", "accept_b", "enter", "unreadable"] as const;
export type FieldAction = (typeof FIELD_ACTIONS)[number];

export interface FieldTarget {
  /** Contract name as sent by the client. */
  field: string;
  kind: "transaction" | "line";
  column: string;
  lineIndex?: number;
  provenanceKey: string;
}

export function resolveFieldTarget(field: string): FieldTarget {
  const column = CONTRACT_TO_COLUMN[field] ?? ((EDITABLE_FIELDS as readonly string[]).includes(field) ? (field as EditableField) : undefined);
  if (column) {
    const key = COLUMN_TO_PROVENANCE[column];
    if (!key) throw badRequest(`${field} is not a reviewable field`);
    return { field, kind: "transaction", column, provenanceKey: key };
  }
  const m = LINE_FIELD.exec(field);
  if (m) return { field, kind: "line", column: LINE_COLUMN[m[2] as keyof typeof LINE_COLUMN], lineIndex: Number(m[1]), provenanceKey: `line_items.${m[1]}.${LINE_COLUMN[m[2] as keyof typeof LINE_COLUMN]}` };
  throw badRequest(`${field} is not a reviewable field`);
}

function stringify(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

type ProvenanceFields = Record<string, { passA: string | null; passB: string | null }>;

function provenanceOf(tx: { provenance: unknown }, key: string): { passA: string | null; passB: string | null } | null {
  const fields = ((tx.provenance as { fields?: ProvenanceFields } | null)?.fields ?? {}) as ProvenanceFields;
  return fields[key] ?? null;
}

export interface FieldActionInput {
  field: string;
  action: FieldAction;
  value?: string | null;
  reason?: string | null;
}

export interface FieldActionResult {
  fieldEditId: string;
  oldValue: string | null;
  newValue: string | null;
  approvalId: string | null;
  status: string;
}

/**
 * Apply one decision. `role` decides whether a material change needs the
 * owner's approval (REVIEWER) or is final (OWNER, ADMIN, STAFF, PARTNER).
 */
export async function applyFieldAction(args: { prisma: PrismaClient; db: TenantClient; companyId: string; userId: string; role: CompanyRole; transactionId: string; input: FieldActionInput; ip?: string | null }): Promise<FieldActionResult> {
  const { prisma, db, companyId, userId, role, transactionId, input, ip } = args;
  const tx = await db.transaction.findUnique({ where: { id: transactionId }, include: { lines: { orderBy: { id: "asc" } } } });
  if (!tx) throw notFound("Transaction");
  const target = resolveFieldTarget(input.field);

  // Decide the new value.
  let newValue: string | null;
  let reason: string;
  if (input.action === "accept_a" || input.action === "accept_b") {
    const p = provenanceOf(tx, target.provenanceKey);
    const v = input.action === "accept_a" ? p?.passA : p?.passB;
    if (v === null || v === undefined) throw badRequest(`${input.action === "accept_a" ? "Read 1" : "Read 2"} has no value for ${input.field}`);
    newValue = String(v);
    reason = input.reason?.trim() || `Reviewer accepted ${input.action === "accept_a" ? "read 1 (pass A)" : "read 2 (pass B)"} for ${input.field}`;
  } else if (input.action === "enter") {
    if (input.value === null || input.value === undefined || input.value.trim() === "") throw badRequest("`value` is required for action enter");
    newValue = input.value.trim();
    if (!input.reason || input.reason.trim().length < 3) throw badRequest("`reason` (at least 3 characters) is required when entering a value");
    reason = input.reason.trim();
  } else {
    newValue = null;
    reason = input.reason?.trim() || `Reviewer marked ${input.field} unreadable on the source document`;
  }

  // Validate and convert.
  let oldValue: string | null;
  let data: Record<string, unknown>;
  let lineId: string | null = null;
  if (target.kind === "transaction") {
    const column = target.column as EditableField;
    if (newValue !== null) {
      newValue = parse(FIELD_VALUE_SCHEMAS[column], newValue, `value for ${input.field}`);
      if (column === "state" && !(await prisma.jurisdiction.findUnique({ where: { code: newValue } }))) throw badRequest(`${newValue} is not a known jurisdiction`);
    }
    oldValue = stringify((tx as Record<string, unknown>)[column]);
    data = { [column]: newValue === null ? null : column === "date" ? new Date(`${newValue}T00:00:00Z`) : newValue };
    if (column === "state") data.stateSource = newValue === null ? null : "user";
  } else {
    const line = tx.lines[target.lineIndex!];
    if (!line) throw badRequest(`Line item ${target.lineIndex} does not exist on this transaction`);
    const key = (Object.keys(LINE_COLUMN) as Array<keyof typeof LINE_COLUMN>).find((k) => LINE_COLUMN[k] === target.column)!;
    if (newValue !== null) newValue = parse(LINE_VALUE[key], newValue, `value for ${input.field}`);
    oldValue = stringify((line as Record<string, unknown>)[target.column]);
    data = { [target.column]: newValue };
    lineId = line.id;
  }
  if (oldValue === newValue) throw badRequest(`${input.field} already has that value`);

  const material = isMaterialField(input.field);
  const needsApproval = material && role === "REVIEWER";
  const entity = target.kind === "transaction" ? "Transaction" : "TransactionLine";
  const entityId = target.kind === "transaction" ? tx.id : lineId!;

  const fieldEdit = await db.fieldEdit.create({
    data: { entity, entityId, field: target.kind === "transaction" ? target.column : target.column, oldValue, newValue, reason, userId, evidence: { action: input.action, contractField: input.field, material, needsApproval } } as never,
  });
  if (target.kind === "transaction") await db.transaction.update({ where: { id: tx.id }, data: data as never });
  else await db.transactionLine.update({ where: { id: lineId! }, data: data as never });

  // A human decided this field: the "reads differ" issue for it is settled.
  await db.issue.updateMany({
    where: { transactionId: tx.id, status: "OPEN", code: "V010", fields: { has: input.field } },
    data: { status: "RESOLVED", resolvedBy: userId, resolvedAt: new Date(), resolutionNote: reason },
  });

  let approvalId: string | null = null;
  if (needsApproval) {
    const approval = await db.approval.create({
      data: { target: "correction", targetId: fieldEdit.id, userId, status: "PENDING", payload: { transactionId: tx.id, field: input.field, column: target.column, entity, entityId, oldValue, newValue, fieldEditId: fieldEdit.id } } as never,
    });
    approvalId = approval.id;
    await upsertR001(db, companyId, tx.id);
    await audit(db, { action: "approval_requested", userId, target: `Approval:${approval.id}`, meta: { transactionId: tx.id, field: input.field, fieldEditId: fieldEdit.id }, ip });
  }
  await audit(db, { action: "edit", userId, target: `Transaction:${tx.id}`, meta: { field: input.field, action: input.action, fieldEditId: fieldEdit.id, oldValue, newValue, needsApproval }, ip });

  const status = await refreshStatus(db, tx.id, userId, input.action === "unreadable" ? "UNABLE_TO_VERIFY" : undefined);
  return { fieldEditId: fieldEdit.id, oldValue, newValue, approvalId, status };
}

/** One R001 per transaction while any correction awaits approval. */
async function upsertR001(db: TenantClient, companyId: string, transactionId: string): Promise<void> {
  const pending = await db.approval.findMany({ where: { status: "PENDING", target: "correction", payload: { path: ["transactionId"], equals: transactionId } }, select: { id: true, payload: true } });
  const evidence = { approvalIds: pending.map((p) => p.id), fields: pending.map((p) => (p.payload as { field?: string }).field ?? null) };
  const existing = await db.issue.findFirst({ where: { transactionId, code: R001.code, status: "OPEN" } });
  if (pending.length === 0) {
    if (existing) await db.issue.update({ where: { id: existing.id }, data: { status: "RESOLVED", resolvedAt: new Date(), resolutionNote: "Every correction was decided by the owner" } });
    return;
  }
  const message = `${pending.length} correction(s) by a reviewer await the owner's approval`;
  if (existing) await db.issue.update({ where: { id: existing.id }, data: { message, evidence, fields: evidence.fields.filter((f): f is string => !!f) } });
  else await db.issue.create({ data: { companyId, transactionId, code: R001.code, ruleVersion: R001.version, severity: "ERROR", message, fields: evidence.fields.filter((f): f is string => !!f), evidence } as never });
}

/** Recompute a transaction's status from its open ERROR issues (or force UNABLE_TO_VERIFY). */
export async function refreshStatus(db: TenantClient, transactionId: string, userId: string, force?: "UNABLE_TO_VERIFY"): Promise<string> {
  const current = await db.transaction.findUnique({ where: { id: transactionId }, select: { status: true } });
  if (!current) throw notFound("Transaction");
  let next: "VERIFIED" | "NEEDS_ATTENTION" | "UNABLE_TO_VERIFY";
  if (force) next = force;
  else {
    const openErrors = await db.issue.count({ where: { transactionId, status: "OPEN", severity: "ERROR" } });
    next = openErrors > 0 ? "NEEDS_ATTENTION" : "VERIFIED";
  }
  if (next !== current.status) {
    await db.transaction.update({ where: { id: transactionId }, data: { status: next, ...(next === "VERIFIED" ? { verifiedAt: new Date(), verifiedBy: userId } : {}) } });
  }
  return next;
}

// ── Approvals ────────────────────────────────────────────────────────────────

export async function decideApproval(args: { db: TenantClient; companyId: string; userId: string; approvalId: string; decision: "APPROVED" | "REJECTED"; note: string | null; ip?: string | null }) {
  const { db, companyId, userId, approvalId, decision, note, ip } = args;
  const approval = await db.approval.findUnique({ where: { id: approvalId } });
  if (!approval) throw notFound("Approval");
  if (approval.status !== "PENDING") throw badRequest(`Approval is already ${approval.status}`);
  const payload = (approval.payload ?? {}) as { transactionId?: string; column?: string; entity?: string; entityId?: string; oldValue?: string | null; newValue?: string | null; field?: string };
  if (decision === "REJECTED" && payload.entity && payload.entityId && payload.column) {
    // Revert through a second FieldEdit; the reviewer's edit stays in the history.
    const revertReason = `Rejected by the owner${note ? `: ${note}` : ""}`;
    const value = payload.oldValue ?? null;
    await db.fieldEdit.create({ data: { entity: payload.entity, entityId: payload.entityId, field: payload.column, oldValue: payload.newValue ?? null, newValue: value, reason: revertReason, userId, evidence: { action: "reject", approvalId } } as never });
    const data: Record<string, unknown> = { [payload.column]: value === null ? null : payload.column === "date" ? new Date(`${value}T00:00:00Z`) : value };
    if (payload.entity === "Transaction") await db.transaction.update({ where: { id: payload.entityId }, data: data as never });
    else await db.transactionLine.update({ where: { id: payload.entityId }, data: data as never });
  }
  const updated = await db.approval.update({ where: { id: approval.id }, data: { status: decision, decidedBy: userId, decidedAt: new Date(), note } });
  await audit(db, { action: "approval_decided", userId, target: `Approval:${approval.id}`, meta: { decision, note, transactionId: payload.transactionId ?? null, field: payload.field ?? null }, ip });
  let status: string | null = null;
  if (payload.transactionId) {
    await upsertR001(db, companyId, payload.transactionId);
    status = await refreshStatus(db, payload.transactionId, userId);
  }
  return { approval: updated, status };
}

// ── Claims and reviewer time ─────────────────────────────────────────────────

export function claimExpired(claimedAt: Date | null, now = new Date()): boolean {
  return !claimedAt || now.getTime() - claimedAt.getTime() > REVIEW_CLAIM_MINUTES * 60_000;
}

export async function claimTransaction(args: { prisma: PrismaClient; db: TenantClient; companyId: string; userId: string; transactionId: string; ip?: string | null }) {
  const { prisma, db, companyId, userId, transactionId, ip } = args;
  const tx = await db.transaction.findUnique({ where: { id: transactionId }, select: { id: true, reviewClaimedBy: true, reviewClaimedAt: true } });
  if (!tx) throw notFound("Transaction");
  const now = new Date();
  if (tx.reviewClaimedBy && tx.reviewClaimedBy !== userId && !claimExpired(tx.reviewClaimedAt, now)) {
    const holder = await prisma.user.findUnique({ where: { id: tx.reviewClaimedBy }, select: { id: true, fullName: true } });
    throw new HttpError(409, `Claimed by ${holder?.fullName ?? "another reviewer"} ${Math.round((now.getTime() - tx.reviewClaimedAt!.getTime()) / 60_000)} min ago`, "review_claimed", { claimedBy: holder, claimedAt: tx.reviewClaimedAt });
  }
  await db.transaction.update({ where: { id: tx.id }, data: { reviewClaimedBy: userId, reviewClaimedAt: now } });
  const open = await db.reviewSession.findFirst({ where: { transactionId: tx.id, userId, endedAt: null } });
  const session = open ?? (await db.reviewSession.create({ data: { companyId, transactionId: tx.id, userId } as never }));
  await audit(db, { action: "review_claim", userId, target: `Transaction:${tx.id}`, meta: { sessionId: session.id }, ip });
  return { claimedBy: userId, claimedAt: now, sessionId: session.id, startedAt: session.startedAt };
}

export async function releaseTransaction(args: { db: TenantClient; userId: string; transactionId: string; ip?: string | null }) {
  const { db, userId, transactionId, ip } = args;
  const tx = await db.transaction.findUnique({ where: { id: transactionId }, select: { id: true, reviewClaimedBy: true } });
  if (!tx) throw notFound("Transaction");
  const now = new Date();
  const open = await db.reviewSession.findMany({ where: { transactionId: tx.id, userId, endedAt: null } });
  let seconds = 0;
  for (const s of open) {
    const secs = Math.max(0, Math.round((now.getTime() - s.startedAt.getTime()) / 1000));
    seconds += secs;
    await db.reviewSession.update({ where: { id: s.id }, data: { endedAt: now, seconds: secs } });
  }
  if (tx.reviewClaimedBy === userId) await db.transaction.update({ where: { id: tx.id }, data: { reviewClaimedBy: null, reviewClaimedAt: null } });
  await audit(db, { action: "review_release", userId, target: `Transaction:${tx.id}`, meta: { seconds }, ip });
  return { seconds };
}

/** Total reviewer seconds on a transaction (closed sessions plus the running ones). */
export async function reviewSeconds(db: TenantClient, transactionId: string, now = new Date()): Promise<number> {
  const sessions = await db.reviewSession.findMany({ where: { transactionId }, select: { startedAt: true, endedAt: true, seconds: true } });
  return sessions.reduce((acc, s) => acc + (s.seconds ?? Math.max(0, Math.round((now.getTime() - s.startedAt.getTime()) / 1000))), 0);
}
