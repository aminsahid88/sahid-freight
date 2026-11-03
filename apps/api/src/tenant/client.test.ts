import { test } from "node:test";
import assert from "node:assert/strict";
import { retentionUntil } from "@tbo/core";
import { addMember, companyWithOwner, createCompany, createUser, prisma } from "../test/fixtures";
import { AppendOnlyError, HardDeleteForbiddenError, TenantScopeError, tenantClient } from "./client";

async function seedDoc(companyId: string, uploadedById: string, name: string) {
  return prisma.document.create({
    data: {
      companyId,
      uploadedById,
      channel: "WEB",
      storageKey: `companies/${companyId}/documents/${name}/original.pdf`,
      filename: `${name}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 10,
      sha256: `sha-${name}`,
      retentionUntil: retentionUntil(new Date()),
    },
  });
}

test("cross-company access fails: reads from company A never return company B rows", async () => {
  const a = await companyWithOwner();
  const b = await companyWithOwner();
  const docA = await seedDoc(a.company.id, a.user.id, "a1");
  const docB = await seedDoc(b.company.id, b.user.id, "b1");

  const dbA = tenantClient(prisma, a.company.id);

  const list = await dbA.document.findMany();
  assert.deepEqual(
    list.map((d) => d.id),
    [docA.id],
  );
  assert.equal(await dbA.document.findUnique({ where: { id: docB.id } }), null);
  assert.equal(await dbA.document.findFirst({ where: { id: docB.id } }), null);
  assert.equal(await dbA.document.count({ where: { id: docB.id } }), 0);
  await assert.rejects(dbA.document.findUniqueOrThrow({ where: { id: docB.id } }));

  // Even a where clause that names company B is refused rather than honoured.
  await assert.rejects(dbA.document.findMany({ where: { companyId: b.company.id } }), TenantScopeError);
});

test("cross-company writes fail: updates target only the scoped company and creates land in it", async () => {
  const a = await companyWithOwner();
  const b = await companyWithOwner();
  const docB = await seedDoc(b.company.id, b.user.id, "b2");
  const dbA = tenantClient(prisma, a.company.id);

  await assert.rejects(dbA.document.update({ where: { id: docB.id }, data: { status: "PROCESSED" } }));
  const untouched = await prisma.document.findUnique({ where: { id: docB.id } });
  assert.equal(untouched?.status, "RECEIVED");

  const r = await dbA.document.updateMany({ where: { id: docB.id }, data: { status: "PROCESSED" } });
  assert.equal(r.count, 0);

  const v = await dbA.vehicle.create({ data: { unitNumber: "101" } as never });
  assert.equal(v.companyId, a.company.id);
  await assert.rejects(dbA.vehicle.create({ data: { unitNumber: "102", companyId: b.company.id } }), TenantScopeError);
  await assert.rejects(
    dbA.vehicle.create({ data: { unitNumber: "103", company: { connect: { id: b.company.id } } } }),
    TenantScopeError,
  );
  assert.equal(await prisma.vehicle.count({ where: { companyId: b.company.id } }), 0);
});

test("membership of one company grants nothing in another", async () => {
  const a = await companyWithOwner();
  const b = await createCompany();
  const outsider = await createUser();
  await addMember(outsider.id, a.company.id, "STAFF");
  const dbB = tenantClient(prisma, b.id);
  const found = await dbB.membership.findFirst({ where: { userId: outsider.id } });
  assert.equal(found, null);
});

test("documents are never hard-deleted through the tenant client", async () => {
  const a = await companyWithOwner();
  const doc = await seedDoc(a.company.id, a.user.id, "keep");
  const dbA = tenantClient(prisma, a.company.id);
  await assert.rejects(dbA.document.delete({ where: { id: doc.id } }), HardDeleteForbiddenError);
  await assert.rejects(dbA.document.deleteMany({}), HardDeleteForbiddenError);
  // Soft delete is the supported path.
  await dbA.document.update({ where: { id: doc.id }, data: { deletedAt: new Date() } });
  assert.ok((await prisma.document.findUnique({ where: { id: doc.id } }))?.deletedAt);
});

test("the database itself refuses to delete a document inside its retention window", async () => {
  const a = await companyWithOwner();
  const doc = await seedDoc(a.company.id, a.user.id, "db-guard");
  await assert.rejects(prisma.document.delete({ where: { id: doc.id } }), /under retention/);
  assert.ok(await prisma.document.findUnique({ where: { id: doc.id } }));
});

test("audit log is append-only in the client and in the database", async () => {
  const a = await companyWithOwner();
  const dbA = tenantClient(prisma, a.company.id);
  const row = await dbA.auditLog.create({ data: { action: "upload", userId: a.user.id, target: "doc" } });
  assert.equal(row.companyId, a.company.id);
  await assert.rejects(dbA.auditLog.update({ where: { id: row.id }, data: { action: "edit" } }), AppendOnlyError);
  await assert.rejects(dbA.auditLog.delete({ where: { id: row.id } }), AppendOnlyError);
  await assert.rejects(dbA.auditLog.deleteMany({}), AppendOnlyError);
  // Bypassing the client: the trigger still refuses.
  await assert.rejects(prisma.auditLog.update({ where: { id: row.id }, data: { action: "edit" } }), /append-only/);
  await assert.rejects(prisma.auditLog.delete({ where: { id: row.id } }), /append-only/);
  await assert.rejects(prisma.$executeRawUnsafe(`DELETE FROM "AuditLog" WHERE id = '${row.id}'`), /append-only/);
  const still = await prisma.auditLog.findUnique({ where: { id: row.id } });
  assert.equal(still?.action, "upload");
});

test("tenantClient requires a companyId", () => {
  assert.throws(() => tenantClient(prisma, ""), TenantScopeError);
});
