/**
 * Companies, memberships, vehicles, drivers, reporting periods, audit log.
 * Phase 0 scope: enough for an owner to create a company, add trucks and
 * drivers, and see what happened.
 */
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { quarterOf } from "@tbo/core";
import { audit, auditPlatform } from "../audit/log";
import { protect } from "../middleware/auth.middleware";
import { badRequest, notFound, parse, wrap } from "./errors";
import { type CompanyRequest, ctx, requireCompany } from "./middleware";

const decimalString = z.string().regex(/^\d+(\.\d{1,3})?$/, "must be a decimal with up to 3 places");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD");

export const createCompanySchema = z.object({
  legalName: z.string().trim().min(2).max(120),
  dba: z.string().trim().max(120).optional(),
  usdot: z.string().trim().regex(/^\d{1,8}$/, "USDOT is up to 8 digits").optional(),
  mcNumber: z.string().trim().max(20).optional(),
  iftaBaseJurisdiction: z.string().trim().length(2).toUpperCase().optional(),
  timezone: z.string().trim().min(3).max(64).default("America/Chicago"),
  language: z.enum(["EN", "SO"]).default("EN"),
});

export const vehicleSchema = z.object({
  unitNumber: z.string().trim().min(1).max(20),
  vin: z.string().trim().length(17).toUpperCase().optional(),
  plate: z.string().trim().max(20).optional(),
  axles: z.number().int().min(2).max(10).optional(),
  iftaQualified: z.boolean().default(true),
  tankCapacityGal: decimalString.optional(),
  eldProvider: z.string().trim().max(40).optional(),
  activeFrom: isoDate.optional(),
  activeTo: isoDate.optional(),
});

export const driverSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/, "phone must be E.164, e.g. +16125550100").optional(),
  defaultVehicleId: z.string().uuid().optional(),
  language: z.enum(["EN", "SO"]).default("EN"),
  active: z.boolean().default(true),
});

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "carrier"}-${randomBytes(2).toString("hex")}`;
}

function dateOrUndefined(v: string | undefined): Date | undefined {
  return v ? new Date(`${v}T00:00:00Z`) : undefined;
}

export function companiesRouter(prisma: PrismaClient): Router {
  const r = Router();
  r.use(protect);

  // ── Companies ──
  r.post(
    "/",
    wrap(async (req: CompanyRequest, res) => {
      const body = parse(createCompanySchema, req.body, "company");
      const userId = req.user!.userId;
      const q = quarterOf(new Date());
      const company = await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({ data: { name: body.legalName } });
        const c = await tx.company.create({
          data: {
            organizationId: org.id,
            legalName: body.legalName,
            dba: body.dba,
            usdot: body.usdot,
            mcNumber: body.mcNumber,
            iftaBaseJurisdiction: body.iftaBaseJurisdiction,
            timezone: body.timezone,
            language: body.language,
            inboundEmailSlug: slugify(body.legalName),
          },
        });
        await tx.membership.create({ data: { userId, companyId: c.id, role: "OWNER" } });
        await tx.reportingPeriod.create({ data: { companyId: c.id, type: "QUARTER", startDate: q.start, endDate: q.end } });
        return c;
      });
      await auditPlatform(prisma, { companyId: company.id, userId, action: "company_created", target: company.id, ip: req.ip });
      res.status(201).json({ company, role: "OWNER" });
    }),
  );

  r.get(
    "/",
    wrap(async (req: CompanyRequest, res) => {
      const memberships = await prisma.membership.findMany({
        where: { userId: req.user!.userId },
        include: { company: { select: { id: true, legalName: true, dba: true, usdot: true, language: true, timezone: true, isDemo: true, pausedAt: true, pausedReason: true } } },
        orderBy: { createdAt: "asc" },
      });
      const byCompany = new Map<string, { company: (typeof memberships)[number]["company"]; roles: string[] }>();
      for (const m of memberships) {
        const entry = byCompany.get(m.companyId) ?? { company: m.company, roles: [] };
        entry.roles.push(m.role);
        byCompany.set(m.companyId, entry);
      }
      res.json({ companies: [...byCompany.values()] });
    }),
  );

  r.get(
    "/:companyId",
    requireCompany(prisma),
    wrap(async (req: CompanyRequest, res) => {
      const { company } = ctx(req);
      const row = await prisma.company.findUnique({
        where: { id: company.id },
        select: {
          id: true,
          legalName: true,
          dba: true,
          usdot: true,
          mcNumber: true,
          iftaBaseJurisdiction: true,
          language: true,
          timezone: true,
          inboundEmailSlug: true,
          isDemo: true,
          createdAt: true,
          _count: { select: { vehicles: true, drivers: true, documents: true } },
        },
      });
      if (!row) throw notFound("Company");
      res.json({ company: row, role: company.role, breakGlass: company.breakGlass });
    }),
  );

  // ── Vehicles ──
  r.get(
    "/:companyId/vehicles",
    requireCompany(prisma),
    wrap(async (req: CompanyRequest, res) => {
      const { db } = ctx(req);
      const vehicles = await db.vehicle.findMany({ orderBy: { unitNumber: "asc" } });
      res.json({ vehicles });
    }),
  );
  r.post(
    "/:companyId/vehicles",
    requireCompany(prisma, "OWNER", "STAFF", "PARTNER", "ADMIN"),
    wrap(async (req: CompanyRequest, res) => {
      const { db, userId } = ctx(req);
      const body = parse(vehicleSchema, req.body, "vehicle");
      const existing = await db.vehicle.findFirst({ where: { unitNumber: body.unitNumber } });
      if (existing) throw badRequest(`Unit ${body.unitNumber} already exists`);
      const vehicle = await db.vehicle.create({
        data: { ...body, activeFrom: dateOrUndefined(body.activeFrom), activeTo: dateOrUndefined(body.activeTo) } as never,
      });
      await audit(db, { action: "edit", userId, target: `Vehicle:${vehicle.id}`, meta: { op: "create", unitNumber: vehicle.unitNumber }, ip: req.ip });
      res.status(201).json({ vehicle });
    }),
  );
  r.patch(
    "/:companyId/vehicles/:vehicleId",
    requireCompany(prisma, "OWNER", "STAFF", "PARTNER", "ADMIN"),
    wrap(async (req: CompanyRequest, res) => {
      const { db, userId } = ctx(req);
      const body = parse(vehicleSchema.partial(), req.body, "vehicle");
      const current = await db.vehicle.findUnique({ where: { id: req.params.vehicleId as string } });
      if (!current) throw notFound("Vehicle");
      const vehicle = await db.vehicle.update({
        where: { id: current.id },
        data: { ...body, activeFrom: dateOrUndefined(body.activeFrom), activeTo: dateOrUndefined(body.activeTo) } as never,
      });
      await audit(db, { action: "edit", userId, target: `Vehicle:${vehicle.id}`, meta: { op: "update", fields: Object.keys(body) }, ip: req.ip });
      res.json({ vehicle });
    }),
  );

  // ── Drivers ──
  r.get(
    "/:companyId/drivers",
    requireCompany(prisma),
    wrap(async (req: CompanyRequest, res) => {
      const { db } = ctx(req);
      const drivers = await db.driver.findMany({ orderBy: { name: "asc" }, include: { defaultVehicle: { select: { id: true, unitNumber: true } } } });
      res.json({ drivers });
    }),
  );
  r.post(
    "/:companyId/drivers",
    requireCompany(prisma, "OWNER", "STAFF", "PARTNER", "ADMIN"),
    wrap(async (req: CompanyRequest, res) => {
      const { db, userId } = ctx(req);
      const body = parse(driverSchema, req.body, "driver");
      if (body.defaultVehicleId) {
        const v = await db.vehicle.findUnique({ where: { id: body.defaultVehicleId } });
        if (!v) throw badRequest("defaultVehicleId is not a vehicle of this company");
      }
      const driver = await db.driver.create({ data: body as never });
      await audit(db, { action: "edit", userId, target: `Driver:${driver.id}`, meta: { op: "create" }, ip: req.ip });
      res.status(201).json({ driver });
    }),
  );
  r.patch(
    "/:companyId/drivers/:driverId",
    requireCompany(prisma, "OWNER", "STAFF", "PARTNER", "ADMIN"),
    wrap(async (req: CompanyRequest, res) => {
      const { db, userId } = ctx(req);
      const body = parse(driverSchema.partial(), req.body, "driver");
      const current = await db.driver.findUnique({ where: { id: req.params.driverId as string } });
      if (!current) throw notFound("Driver");
      if (body.defaultVehicleId) {
        const v = await db.vehicle.findUnique({ where: { id: body.defaultVehicleId } });
        if (!v) throw badRequest("defaultVehicleId is not a vehicle of this company");
      }
      const driver = await db.driver.update({ where: { id: current.id }, data: body as never });
      await audit(db, { action: "edit", userId, target: `Driver:${driver.id}`, meta: { op: "update", fields: Object.keys(body) }, ip: req.ip });
      res.json({ driver });
    }),
  );

  // ── Periods ──
  r.get(
    "/:companyId/periods",
    requireCompany(prisma),
    wrap(async (req: CompanyRequest, res) => {
      const { db } = ctx(req);
      const periods = await db.reportingPeriod.findMany({ orderBy: { startDate: "desc" } });
      res.json({ periods });
    }),
  );

  // ── Audit log (owners and admins) ──
  r.get(
    "/:companyId/audit",
    requireCompany(prisma, "OWNER", "ADMIN"),
    wrap(async (req: CompanyRequest, res) => {
      const { db } = ctx(req);
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const entries = await db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { user: { select: { id: true, fullName: true } } },
      });
      res.json({ entries });
    }),
  );

  return r;
}
