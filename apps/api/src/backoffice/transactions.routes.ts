/**
 * Transactions: what extraction produced, with corrections kept as history.
 *
 * GET   /companies/:companyId/transactions              list (filters: status, periodId, cursor, limit ≤ 200)
 * GET   /companies/:companyId/transactions/:id          detail: lines, issues, document, provenance, fieldEdits (newest first)
 * PATCH /companies/:companyId/transactions/:id/fields   {field, newValue, reason} → FieldEdit row + column update
 *
 * The original extracted value is never overwritten: `provenance` is read-only
 * and every correction lands in FieldEdit (old/new/reason/user) before the
 * column changes.
 */
import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z, type ZodType } from "zod";
import { parseIsoDate, toIsoDate } from "@tbo/core";
import { audit } from "../audit/log";
import { protect } from "../middleware/auth.middleware";
import type { TenantClient } from "../tenant/client";
import { badRequest, notFound, parse, wrap } from "./errors";
import { type CompanyRequest, ctx, requireCompany } from "./middleware";

export const EDITABLE_FIELDS = [
  "date",
  "time",
  "vendor",
  "sellerAddress",
  "state",
  "stateSource",
  "unitNumberRaw",
  "vehicleId",
  "odometer",
  "paymentMethod",
  "cardLast4",
  "receiptTotal",
  "currency",
  "type",
] as const;
export type EditableField = (typeof EDITABLE_FIELDS)[number];

const TX_STATUSES = ["VERIFIED", "NEEDS_ATTENTION", "UNABLE_TO_VERIFY"] as const;
const TX_TYPES = ["FUEL", "EXPENSE", "REFUND", "CREDIT", "OTHER", "UNKNOWN"] as const;

const listQuery = z.object({
  status: z.enum(TX_STATUSES).optional(),
  periodId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().uuid().optional(),
});

const editSchema = z.object({
  field: z.enum(EDITABLE_FIELDS),
  newValue: z.string().trim().max(500),
  reason: z.string().trim().min(3).max(500),
});

/** Per-field value rules. Values are strings on the wire; conversion happens after validation. */
export const FIELD_VALUE_SCHEMAS: Record<EditableField, ZodType<string>> = {
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
    .refine((v) => {
      try {
        parseIsoDate(v);
        return true;
      } catch {
        return false;
      }
    }, "is not a real calendar date"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "must be HH:MM or HH:MM:SS"),
  vendor: z.string().min(1).max(200),
  sellerAddress: z.string().min(1).max(300),
  state: z.string().regex(/^[A-Z]{2}$/, "must be a 2-letter uppercase jurisdiction code"),
  stateSource: z.enum(["printed", "lookup", "user"]),
  unitNumberRaw: z.string().min(1).max(20),
  vehicleId: z.string().uuid(),
  odometer: z.string().regex(/^\d{1,11}(\.\d)?$/, "must be a plain decimal with at most 1 place"),
  paymentMethod: z.string().min(1).max(40),
  cardLast4: z.string().regex(/^\d{4}$/, "must be exactly 4 digits"),
  receiptTotal: z.string().regex(/^-?\d{1,10}(\.\d{1,2})?$/, "must be a plain decimal with at most 2 places"),
  currency: z.string().regex(/^[A-Z]{3}$/, "must be a 3-letter ISO code"),
  type: z.enum(TX_TYPES),
};

const detailInclude = {
  vehicle: { select: { id: true, unitNumber: true } },
  lines: { orderBy: { id: "asc" as const } },
  issues: { orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] },
  region: { select: { id: true, page: true, bbox: true, document: { select: { id: true, filename: true, mimeType: true, status: true } } } },
};

function stringify(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return toIsoDate(value);
  return String(value);
}

async function loadDetail(db: TenantClient, id: string) {
  const row = await db.transaction.findUnique({ where: { id }, include: detailInclude });
  if (!row) return null;
  const fieldEdits = await db.fieldEdit.findMany({
    where: { entity: "Transaction", entityId: id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { user: { select: { id: true, fullName: true } } },
  });
  const { region, ...rest } = row;
  return {
    ...rest,
    document: region ? { id: region.document.id, filename: region.document.filename, mimeType: region.document.mimeType, status: region.document.status, page: region.page, bbox: region.bbox } : null,
    fieldEdits,
  };
}

export function transactionsRouter(prisma: PrismaClient): Router {
  const r = Router({ mergeParams: true });
  r.use(protect);

  r.get(
    "/",
    requireCompany(prisma),
    wrap(async (req: CompanyRequest, res) => {
      const { db } = ctx(req);
      const q = parse(listQuery, req.query, "query");
      const rows = await db.transaction.findMany({
        where: { ...(q.status ? { status: q.status } : {}), ...(q.periodId ? { periodId: q.periodId } : {}) },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        take: q.limit + 1,
        ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
        include: {
          vehicle: { select: { id: true, unitNumber: true } },
          lines: { orderBy: { id: "asc" } },
          region: { select: { page: true, document: { select: { id: true, filename: true } } } },
          _count: { select: { issues: { where: { status: "OPEN" } } } },
        },
      });
      const hasMore = rows.length > q.limit;
      const transactions = rows.slice(0, q.limit).map(({ region, _count, ...t }) => ({
        ...t,
        openIssueCount: _count.issues,
        document: region ? { id: region.document.id, filename: region.document.filename, page: region.page } : null,
      }));
      res.json({ transactions, nextCursor: hasMore ? transactions[transactions.length - 1]!.id : null });
    }),
  );

  r.get(
    "/:transactionId",
    requireCompany(prisma),
    wrap(async (req: CompanyRequest, res) => {
      const { db } = ctx(req);
      const transaction = await loadDetail(db, req.params.transactionId as string);
      if (!transaction) throw notFound("Transaction");
      res.json({ transaction });
    }),
  );

  r.patch(
    "/:transactionId/fields",
    requireCompany(prisma, "OWNER", "STAFF", "REVIEWER", "PARTNER", "ADMIN"),
    wrap(async (req: CompanyRequest, res) => {
      const { db, userId } = ctx(req);
      const body = parse(editSchema, req.body, "field edit");
      const current = await db.transaction.findUnique({ where: { id: req.params.transactionId as string } });
      if (!current) throw notFound("Transaction");

      const newValue = parse(FIELD_VALUE_SCHEMAS[body.field], body.newValue, `value for ${body.field}`);
      if (body.field === "state") {
        const j = await prisma.jurisdiction.findUnique({ where: { code: newValue } });
        if (!j) throw badRequest(`${newValue} is not a known jurisdiction`);
      }
      if (body.field === "vehicleId") {
        const v = await db.vehicle.findUnique({ where: { id: newValue } });
        if (!v) throw badRequest("vehicleId is not a vehicle of this company");
      }

      const oldValue = stringify((current as Record<string, unknown>)[body.field]);
      if (oldValue === newValue) throw badRequest(`${body.field} already has that value`);

      const data: Record<string, unknown> = { [body.field]: body.field === "date" ? parseIsoDate(newValue) : newValue };
      if (body.field === "state") data.stateSource = "user";

      const fieldEdit = await db.$transaction(async (tx) => {
        const edit = await tx.fieldEdit.create({
          data: { entity: "Transaction", entityId: current.id, field: body.field, oldValue, newValue, reason: body.reason, userId } as never,
        });
        await tx.transaction.update({ where: { id: current.id }, data: data as never });
        return edit;
      });
      await audit(db, {
        action: "edit",
        userId,
        target: `Transaction:${current.id}`,
        meta: { field: body.field, fieldEditId: fieldEdit.id, oldValue, newValue },
        ip: req.ip,
      });
      const transaction = await loadDetail(db, current.id);
      res.json({ transaction, fieldEdit });
    }),
  );

  return r;
}
