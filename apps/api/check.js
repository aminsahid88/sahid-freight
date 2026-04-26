const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: "postgresql://postgres:gUnOqfsOPPebXmFzzHqUGLGEDJHLwTQA@autorack.proxy.rlwy.net:40380/railway" } }
});
prisma.user.findMany({ select: { phone: true, fullName: true, role: true } })
  .then(u => { console.log(JSON.stringify(u, null, 2)); prisma.$disconnect(); });
