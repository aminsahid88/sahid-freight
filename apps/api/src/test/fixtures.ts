/**
 * Shared helpers for database-backed tests. Tests run against the disposable
 * `loadlink_test` database (apps/api/.env.test); every fixture gets a random
 * suffix so files can run in any order without truncating tables.
 */
import { randomUUID } from "node:crypto";
import { PrismaClient, type CompanyRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import { getEnv } from "../config/env";

export const prisma = new PrismaClient();

export function uid(prefix = "t"): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export async function createUser(role: "TRUCK_OWNER" | "DRIVER" | "ADMIN" = "TRUCK_OWNER") {
  const id = uid("u");
  return prisma.user.create({
    data: {
      fullName: `Test ${id}`,
      email: `${id}@test.local`,
      phone: `+1555${Math.floor(Math.random() * 1e7)
        .toString()
        .padStart(7, "0")}`,
      passwordHash: null,
      role,
      status: "ACTIVE",
      country: "USA",
    },
  });
}

export async function createCompany(opts: { name?: string } = {}) {
  const name = opts.name ?? `Test Carrier ${uid("c")}`;
  const org = await prisma.organization.create({ data: { name } });
  return prisma.company.create({
    data: {
      organizationId: org.id,
      legalName: name,
      inboundEmailSlug: uid("slug"),
      isDemo: true,
      timezone: "America/Chicago",
    },
  });
}

export async function addMember(userId: string, companyId: string, role: CompanyRole = "OWNER") {
  return prisma.membership.create({ data: { userId, companyId, role } });
}

/** A company with one OWNER user, ready to call the API. */
export async function companyWithOwner(role: CompanyRole = "OWNER") {
  const user = await createUser();
  const company = await createCompany();
  await addMember(user.id, company.id, role);
  return { user, company, token: accessToken(user.id, user.role) };
}

export function accessToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, getEnv().JWT_SECRET, { expiresIn: "1h" });
}
