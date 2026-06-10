// ─────────────────────────────────────────────────────────────────────────────
//  LOCAL FIXTURE SEED  —  do NOT run against production
// ─────────────────────────────────────────────────────────────────────────────
//  Creates one sender, one truck owner, one driver, one verified truck, one
//  load, and one booking in IN_TRANSIT state so the driver-location →
//  viewer-tracking path can be exercised end to end.
//
//  Run with:   npm run db:seed:local
//  Which expands to: dotenv -e .env.local -- npx ts-node prisma/seed.local.ts
//
//  The script refuses to run unless DATABASE_URL points at localhost, as a
//  safety belt against pointing it at prod.
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const DB_URL = process.env.DATABASE_URL || "";
if (!/(localhost|127\.0\.0\.1)/.test(DB_URL)) {
  console.error(
    "Refusing to seed: DATABASE_URL does not look like a localhost URL.\n" +
      "  Got: " + DB_URL.replace(/:[^:@]+@/, ":***@") + "\n" +
      "  Run via `npm run db:seed:local`, not the regular seed."
  );
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Local123!", 12);

  // ── Users ──────────────────────────────────────────────────────────────
  const sender = await prisma.user.upsert({
    where: { phone: "+251911000001" },
    update: {},
    create: {
      fullName: "Local Sender",
      email: "sender@local.test",
      phone: "+251911000001",
      passwordHash,
      role: "CARGO_SENDER",
      status: "ACTIVE",
      country: "ETHIOPIA",
      city: "Addis Ababa",
      isVerified: true,
    },
  });

  const owner = await prisma.user.upsert({
    where: { phone: "+251911000002" },
    update: {},
    create: {
      fullName: "Local Truck Owner",
      email: "owner@local.test",
      phone: "+251911000002",
      passwordHash,
      role: "TRUCK_OWNER",
      status: "ACTIVE",
      country: "ETHIOPIA",
      city: "Addis Ababa",
      isVerified: true,
    },
  });

  const driver = await prisma.user.upsert({
    where: { phone: "+251911000003" },
    update: { invitedById: owner.id },
    create: {
      fullName: "Local Driver",
      email: "driver@local.test",
      phone: "+251911000003",
      passwordHash,
      role: "DRIVER",
      status: "ACTIVE",
      country: "ETHIOPIA",
      city: "Addis Ababa",
      isVerified: true,
      licenseNumber: "DRV-LOCAL-001",
      invitedById: owner.id,
    },
  });

  // ── Truck ──────────────────────────────────────────────────────────────
  const truck = await prisma.truck.upsert({
    where: { plateNumber: "AA-LOCAL-001" },
    update: {
      driverId: driver.id,
      isVerified: true,
      isAvailable: false,
    },
    create: {
      ownerId: owner.id,
      driverId: driver.id,
      plateNumber: "AA-LOCAL-001",
      truckType: "FLATBED",
      capacityTons: 20,
      lengthMeters: 12,
      currentCity: "Addis Ababa",
      currentCountry: "ETHIOPIA",
      isVerified: true,
      isAvailable: false,
    },
  });

  // ── Load ───────────────────────────────────────────────────────────────
  // Find an existing local-test load by senderId + title, or create one.
  let load = await prisma.load.findFirst({
    where: { senderId: sender.id, title: "LOCAL-FIXTURE Addis → Djibouti" },
  });
  if (!load) {
    load = await prisma.load.create({
      data: {
        senderId: sender.id,
        title: "LOCAL-FIXTURE Addis → Djibouti",
        description: "Local-dev fixture load for tracking smoke tests.",
        weightTons: 18,
        truckTypeNeeded: "FLATBED",
        pickupCity: "Addis Ababa",
        pickupCountry: "ETHIOPIA",
        pickupLat: 9.0320,
        pickupLng: 38.7469,
        deliveryCity: "Djibouti",
        deliveryCountry: "DJIBOUTI",
        deliveryLat: 11.5721,
        deliveryLng: 43.1456,
        offeredPrice: 2500,
        currency: "USD",
        status: "IN_TRANSIT",
        scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  }

  // ── Booking (IN_TRANSIT) ───────────────────────────────────────────────
  let booking = await prisma.booking.findFirst({
    where: { loadId: load.id, truckId: truck.id },
  });
  if (!booking) {
    booking = await prisma.booking.create({
      data: {
        loadId: load.id,
        truckId: truck.id,
        senderId: sender.id,
        ownerId: owner.id,
        driverId: driver.id,
        status: "IN_TRANSIT",
        agreedPrice: 2400,
        currency: "USD",
        pickedUpAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
    });
  } else {
    booking = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "IN_TRANSIT", driverId: driver.id },
    });
  }

  console.log("\nLocal fixtures ready:");
  console.log("  sender   ", sender.phone, "  id:", sender.id);
  console.log("  owner    ", owner.phone, "  id:", owner.id);
  console.log("  driver   ", driver.phone, "  id:", driver.id);
  console.log("  truck    ", truck.plateNumber, "  id:", truck.id);
  console.log("  load     ", load.title, "  id:", load.id, "  status:", load.status);
  console.log("  booking  ", booking.id, "  status:", booking.status);
  console.log("\nLogin password for all three users: Local123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
