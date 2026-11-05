// ─────────────────────────────────────────────────────────────────────────────
//  DEMO FREIGHT LLC — fictional 3-truck fleet for demos and tests.
//  Run with: npm run db:seed:backoffice:local  (refuses non-localhost DBs)
//  Everything here is invented. Never replace it with real carrier data.
// ─────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const DB_URL = process.env.DATABASE_URL || "";
if (!/(localhost|127\.0\.0\.1)/.test(DB_URL)) {
  // The seed only upserts the fictional Demo Freight LLC; it never touches other companies.
  // Seeding a remote database is allowed only with an explicit, loud opt-in (used for the live demo).
  if (process.env.SEED_ALLOW_REMOTE !== "yes") {
    console.error("Refusing to seed: DATABASE_URL is not localhost. Use `npm run db:seed:backoffice:local`, or set SEED_ALLOW_REMOTE=yes to seed Demo Freight LLC on a remote database.");
    process.exit(1);
  }
  console.warn(`SEED_ALLOW_REMOTE=yes: seeding Demo Freight LLC on ${DB_URL.replace(/:[^:@]+@/, ":***@")}`);
}

const prisma = new PrismaClient();

const DEMO_SLUG = "demo-freight";
const DEMO_PASSWORD = "DemoFreight123!"; // local demo only

const JURISDICTIONS: Array<[string, string, "US" | "CA", boolean]> = [
  ["AL", "Alabama", "US", true], ["AR", "Arkansas", "US", true], ["AZ", "Arizona", "US", true], ["CA", "California", "US", true],
  ["CO", "Colorado", "US", true], ["CT", "Connecticut", "US", true], ["DE", "Delaware", "US", true], ["FL", "Florida", "US", true],
  ["GA", "Georgia", "US", true], ["IA", "Iowa", "US", true], ["ID", "Idaho", "US", true], ["IL", "Illinois", "US", true],
  ["IN", "Indiana", "US", true], ["KS", "Kansas", "US", true], ["KY", "Kentucky", "US", true], ["LA", "Louisiana", "US", true],
  ["MA", "Massachusetts", "US", true], ["MD", "Maryland", "US", true], ["ME", "Maine", "US", true], ["MI", "Michigan", "US", true],
  ["MN", "Minnesota", "US", true], ["MO", "Missouri", "US", true], ["MS", "Mississippi", "US", true], ["MT", "Montana", "US", true],
  ["NC", "North Carolina", "US", true], ["ND", "North Dakota", "US", true], ["NE", "Nebraska", "US", true], ["NH", "New Hampshire", "US", true],
  ["NJ", "New Jersey", "US", true], ["NM", "New Mexico", "US", true], ["NV", "Nevada", "US", true], ["NY", "New York", "US", true],
  ["OH", "Ohio", "US", true], ["OK", "Oklahoma", "US", true], ["OR", "Oregon", "US", true], ["PA", "Pennsylvania", "US", true],
  ["RI", "Rhode Island", "US", true], ["SC", "South Carolina", "US", true], ["SD", "South Dakota", "US", true], ["TN", "Tennessee", "US", true],
  ["TX", "Texas", "US", true], ["UT", "Utah", "US", true], ["VA", "Virginia", "US", true], ["VT", "Vermont", "US", true],
  ["WA", "Washington", "US", true], ["WI", "Wisconsin", "US", true], ["WV", "West Virginia", "US", true], ["WY", "Wyoming", "US", true],
  ["AB", "Alberta", "CA", true], ["BC", "British Columbia", "CA", true], ["MB", "Manitoba", "CA", true], ["NB", "New Brunswick", "CA", true],
  ["NL", "Newfoundland and Labrador", "CA", true], ["NS", "Nova Scotia", "CA", true], ["ON", "Ontario", "CA", true], ["PE", "Prince Edward Island", "CA", true],
  ["QC", "Quebec", "CA", true], ["SK", "Saskatchewan", "CA", true],
  // Non-member jurisdictions kept for state validation (V005 flags them).
  ["AK", "Alaska", "US", false], ["HI", "Hawaii", "US", false], ["DC", "District of Columbia", "US", false],
];

async function upsertUser(phone: string, email: string, fullName: string, role: "TRUCK_OWNER" | "DRIVER", passwordHash: string) {
  return prisma.user.upsert({
    where: { phone },
    update: { fullName, email },
    create: { phone, email, fullName, role, passwordHash, status: "ACTIVE", country: "USA", city: "Minneapolis", isVerified: true },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  // Reference data
  for (const [code, name, country, iftaMember] of JURISDICTIONS) {
    await prisma.jurisdiction.upsert({ where: { code }, update: { name, country, iftaMember }, create: { code, name, country, iftaMember } });
  }

  // Organization + company
  let company = await prisma.company.findUnique({ where: { inboundEmailSlug: DEMO_SLUG } });
  if (!company) {
    const org = await prisma.organization.create({ data: { name: "Demo Freight LLC" } });
    company = await prisma.company.create({
      data: {
        organizationId: org.id,
        legalName: "Demo Freight LLC",
        dba: "Demo Freight",
        usdot: "0000000",
        mcNumber: "MC-0000000",
        iftaBaseJurisdiction: "MN",
        timezone: "America/Chicago",
        inboundEmailSlug: DEMO_SLUG,
        isDemo: true,
      },
    });
  }

  // People
  const owner = await upsertUser("+16125550100", "owner@demofreight.test", "Ayaan Warsame (Demo)", "TRUCK_OWNER", passwordHash);
  const office = await upsertUser("+16125550101", "office@demofreight.test", "Hodan Ali (Demo)", "TRUCK_OWNER", passwordHash);
  const reviewer = await upsertUser("+16125550102", "reviewer@demofreight.test", "Demo Reviewer", "TRUCK_OWNER", passwordHash);
  const driverUsers = [
    await upsertUser("+16125550111", "driver1@demofreight.test", "Abdi Hassan (Demo)", "DRIVER", passwordHash),
    await upsertUser("+16125550112", "driver2@demofreight.test", "Mohamed Yusuf (Demo)", "DRIVER", passwordHash),
    await upsertUser("+16125550113", "driver3@demofreight.test", "Farah Omar (Demo)", "DRIVER", passwordHash),
  ];

  const member = async (userId: string, role: "OWNER" | "STAFF" | "REVIEWER" | "DRIVER") =>
    prisma.membership.upsert({
      where: { userId_companyId_role: { userId, companyId: company!.id, role } },
      update: {},
      create: { userId, companyId: company!.id, role },
    });
  await member(owner.id, "OWNER");
  await member(office.id, "STAFF");
  await member(reviewer.id, "REVIEWER");
  for (const d of driverUsers) await member(d.id, "DRIVER");

  // Trucks (3) — fictional VINs/plates
  const trucks = [
    { unitNumber: "101", vin: "1XKAD49X0DJ000101", plate: "MN-DF101", axles: 5, tank: "300.000", eld: "Motive" },
    { unitNumber: "102", vin: "1XKAD49X0DJ000102", plate: "MN-DF102", axles: 5, tank: "250.000", eld: "Motive" },
    { unitNumber: "103", vin: "3AKJHHDR0ESF00103", plate: "MN-DF103", axles: 5, tank: "300.000", eld: "Samsara" },
  ];
  const vehicles = [];
  for (const t of trucks) {
    vehicles.push(
      await prisma.vehicle.upsert({
        where: { companyId_unitNumber: { companyId: company.id, unitNumber: t.unitNumber } },
        update: { vin: t.vin, plate: t.plate, axles: t.axles, tankCapacityGal: t.tank, eldProvider: t.eld },
        create: {
          companyId: company.id,
          unitNumber: t.unitNumber,
          vin: t.vin,
          plate: t.plate,
          axles: t.axles,
          iftaQualified: true,
          tankCapacityGal: t.tank,
          eldProvider: t.eld,
          activeFrom: new Date("2026-01-01T00:00:00Z"),
        },
      }),
    );
  }

  // Drivers (3), each defaulting to one truck
  for (let i = 0; i < driverUsers.length; i++) {
    const u = driverUsers[i]!;
    const v = vehicles[i]!;
    const existing = await prisma.driver.findFirst({ where: { companyId: company.id, userId: u.id } });
    if (existing) {
      await prisma.driver.update({ where: { id: existing.id }, data: { defaultVehicleId: v.id, phone: u.phone, name: u.fullName } });
    } else {
      await prisma.driver.create({
        data: { companyId: company.id, userId: u.id, name: u.fullName, phone: u.phone, defaultVehicleId: v.id, language: i === 0 ? "SO" : "EN" },
      });
    }
  }

  // Q4 2026 reporting period
  await prisma.reportingPeriod.upsert({
    where: { companyId_type_startDate: { companyId: company.id, type: "QUARTER", startDate: new Date("2026-10-01T00:00:00Z") } },
    update: {},
    create: { companyId: company.id, type: "QUARTER", startDate: new Date("2026-10-01T00:00:00Z"), endDate: new Date("2026-12-31T00:00:00Z") },
  });

  // Global settings (temporary defaults from the brief)
  const settings: Array<[string, unknown]> = [
    ["mpg_band", { min: process.env.MPG_BAND_MIN ?? "4.0", max: process.env.MPG_BAND_MAX ?? "9.0" }],
    ["arithmetic_tolerance", { amountUsd: "0.02", ratio: "0.001" }],
    ["card_match_tolerance", { days: 1, gallonsRatio: "0.005", amountUsd: "0.50" }],
    ["default_tank_capacity_gal", "300.000"],
  ];
  for (const [key, value] of settings) {
    const existing = await prisma.setting.findFirst({ where: { companyId: null, key } });
    if (existing) await prisma.setting.update({ where: { id: existing.id }, data: { value: value as never } });
    else await prisma.setting.create({ data: { companyId: null, key, value: value as never } });
  }

  console.log(`Seeded Demo Freight LLC (${company.id}): 3 trucks, 3 drivers, owner ${owner.email}, Q4 2026 period, ${JURISDICTIONS.length} jurisdictions.`);
  console.log(`Demo logins (local only): owner@demofreight.test / office@... / driverN@... — password ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
