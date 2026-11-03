/**
 * Tenant-scoped Prisma client.
 *
 * `tenantClient(prisma, companyId)` returns a client whose every query on a
 * tenant-owned model is forced to `companyId`. Reads outside the company come
 * back empty, writes land in the company, and an explicit conflicting
 * companyId throws. It also enforces two invariants from CLAUDE.md:
 *   - AuditLog is append-only (no update/delete),
 *   - Document rows are never hard-deleted (soft delete via `deletedAt`;
 *     a DeletionRequest is the only path, and the DB trigger backs this up).
 *
 * Nested writes through non-tenant parents are not intercepted; route code
 * must write tenant rows directly through this client.
 */
import { Prisma, PrismaClient } from "@prisma/client";

export const TENANT_MODELS: ReadonlySet<string> = new Set([
  "Membership",
  "Vehicle",
  "Driver",
  "ReportingPeriod",
  "Batch",
  "Document",
  "Transaction",
  "FuelCardImport",
  "FuelCardTransaction",
  "MileageImport",
  "MileageRecord",
  "Issue",
  "FieldEdit",
  "Approval",
  "DeletionRequest",
  "Report",
  "AuditLog",
  "Job",
  "Setting",
]);

export class TenantScopeError extends Error {
  constructor(model: string, operation: string, detail: string) {
    super(`Tenant scope violation on ${model}.${operation}: ${detail}`);
    this.name = "TenantScopeError";
  }
}

export class AppendOnlyError extends Error {
  constructor(model: string, operation: string) {
    super(`${model} is append-only; ${operation} is not allowed`);
    this.name = "AppendOnlyError";
  }
}

export class HardDeleteForbiddenError extends Error {
  constructor(model: string) {
    super(`${model} rows cannot be hard-deleted; set deletedAt or file a DeletionRequest`);
    this.name = "HardDeleteForbiddenError";
  }
}

type AnyRecord = Record<string, unknown>;

function scopeWhere(where: unknown, companyId: string, model: string, operation: string): AnyRecord {
  const w: AnyRecord = where && typeof where === "object" ? { ...(where as AnyRecord) } : {};
  if ("companyId" in w && w.companyId !== undefined && w.companyId !== companyId) {
    throw new TenantScopeError(model, operation, `where.companyId=${JSON.stringify(w.companyId)} differs from the scoped company`);
  }
  w.companyId = companyId;
  return w;
}

function scopeData(data: unknown, companyId: string, model: string, operation: string): AnyRecord {
  const d: AnyRecord = data && typeof data === "object" ? { ...(data as AnyRecord) } : {};
  if ("companyId" in d && d.companyId !== undefined && d.companyId !== companyId) {
    throw new TenantScopeError(model, operation, `data.companyId=${JSON.stringify(d.companyId)} differs from the scoped company`);
  }
  if ("company" in d) {
    const connectId = (d.company as AnyRecord | undefined)?.connect && ((d.company as AnyRecord).connect as AnyRecord).id;
    if (connectId !== undefined && connectId !== companyId) {
      throw new TenantScopeError(model, operation, "data.company.connect points at another company");
    }
    delete d.company;
  }
  d.companyId = companyId;
  return d;
}

const READ_OPS = new Set(["findMany", "findFirst", "findFirstOrThrow", "findUnique", "findUniqueOrThrow", "count", "aggregate", "groupBy"]);

export function tenantClient(prisma: PrismaClient, companyId: string) {
  if (!companyId || typeof companyId !== "string") throw new TenantScopeError("*", "*", "companyId is required");
  return prisma.$extends({
    name: `tenant:${companyId}`,
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args);
          if (model === "AuditLog" && !READ_OPS.has(operation) && !["create", "createMany"].includes(operation)) {
            throw new AppendOnlyError(model, operation);
          }
          if (model === "Document" && (operation === "delete" || operation === "deleteMany")) {
            throw new HardDeleteForbiddenError(model);
          }
          const a = (args ?? {}) as AnyRecord;
          switch (operation) {
            case "findMany":
            case "findFirst":
            case "findFirstOrThrow":
            case "findUnique":
            case "findUniqueOrThrow":
            case "count":
            case "aggregate":
            case "groupBy":
            case "update":
            case "updateMany":
            case "delete":
            case "deleteMany":
              a.where = scopeWhere(a.where, companyId, model, operation);
              break;
            case "create":
              a.data = scopeData(a.data, companyId, model, operation);
              break;
            case "createMany":
              a.data = (Array.isArray(a.data) ? a.data : [a.data]).map((d) => scopeData(d, companyId, model, operation));
              break;
            case "upsert":
              a.where = scopeWhere(a.where, companyId, model, operation);
              a.create = scopeData(a.create, companyId, model, operation);
              if (a.update && typeof a.update === "object" && "companyId" in (a.update as AnyRecord)) {
                delete (a.update as AnyRecord).companyId;
              }
              break;
            default:
              break;
          }
          return query(a as never);
        },
      },
    },
  });
}

export type TenantClient = ReturnType<typeof tenantClient>;
export { Prisma };
