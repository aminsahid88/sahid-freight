import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = "admin@sahidfreight.app";

  const existing = await prisma.user.findFirst({ where: { email, role: "ADMIN" } });
  if (existing) {
    console.log(`Admin user already exists: ${existing.email} (${existing.id})`);
    return;
  }

  const passwordHash = await bcrypt.hash("ChangeMe123!", 12);

  const admin = await prisma.user.create({
    data: {
      fullName: "Sahid Admin",
      email,
      phone: "+251000000000",
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      isVerified: true,
      country: "ETHIOPIA",
      city: "Addis Ababa",
    },
  });

  console.log(`Admin user created: ${admin.email} (${admin.id})`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
