/**
 * CLEAN SLATE — production DB cleanup script.
 *
 * PHASE 1 (default, read-only):
 *   Prints the DATABASE_URL host so you can confirm the target,
 *   lists every user, and counts every content table. NO writes.
 *
 * PHASE 2 (only when invoked with `--delete`):
 *   Deletes all content + all non-ADMIN users in one transaction,
 *   FK-safe order, with guards. Refuses to run if there is no admin,
 *   or if the deletion would remove any user whose role is ADMIN.
 *
 * Usage:
 *   dotenv -e apps/api/.env -- npx ts-node apps/api/scripts/clean-slate.ts
 *   dotenv -e apps/api/.env -- npx ts-node apps/api/scripts/clean-slate.ts --delete
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Show the host + DB name from DATABASE_URL. Never prints the password. */
function describeDbTarget(): { host: string; database: string; user: string } {
  const raw = process.env.DATABASE_URL || '';
  if (!raw) return { host: '(DATABASE_URL not set)', database: '?', user: '?' };
  try {
    // URL parses postgres:// correctly. Ignore password.
    const u = new URL(raw);
    return {
      host: `${u.hostname}:${u.port || '(default)'}`,
      database: u.pathname.replace(/^\//, '') || '?',
      user: u.username || '?',
    };
  } catch {
    return { host: '(unparseable)', database: '?', user: '?' };
  }
}

async function phase1_inspect() {
  const t = describeDbTarget();
  console.log('══════════════════════════════════════════════════════════');
  console.log(' PHASE 1 — INSPECT (read-only)');
  console.log('══════════════════════════════════════════════════════════');
  console.log(` DB host:     ${t.host}`);
  console.log(` DB name:     ${t.database}`);
  console.log(` DB user:     ${t.user}`);
  console.log('══════════════════════════════════════════════════════════');
  console.log('');

  // ── Users ──────────────────────────────────────────────────
  const users = await prisma.user.findMany({
    select: { id: true, fullName: true, email: true, phone: true, role: true, createdAt: true },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  });

  const admins = users.filter(u => u.role === 'ADMIN');
  const nonAdmins = users.filter(u => u.role !== 'ADMIN');

  console.log(`USERS — total ${users.length}  ·  admin ${admins.length}  ·  non-admin ${nonAdmins.length}`);
  console.log('─'.repeat(60));

  for (const u of users) {
    const flag = u.role === 'ADMIN' ? '★ ADMIN' : '        ';
    const email = u.email ?? '—';
    console.log(`${flag}  ${u.role.padEnd(13)}  ${u.fullName?.padEnd(24) || '—'.padEnd(24)}  ${email.padEnd(32)}  ${u.phone}`);
    console.log(`          id: ${u.id}`);
  }
  console.log('');

  // ── Row counts per table (children → parents). Any table that
  //    doesn't exist / isn't in the schema returns 0.
  const counts = await Promise.all([
    prisma.truckLocation.count(),
    prisma.proofOfDeliveryPhoto.count(),
    prisma.proofOfDelivery.count(),
    prisma.payment.count(),
    prisma.message.count(),
    prisma.notification.count(),
    prisma.bid.count(),
    prisma.booking.count(),
    prisma.load.count(),
    prisma.driverInvite.count(),
    prisma.truck.count(),
    prisma.senderProfile.count(),
    prisma.truckOwnerProfile.count(),
    prisma.verificationDocument.count(),
    prisma.refreshToken.count(),
    prisma.otp.count(),
  ]);

  const rows = [
    ['TruckLocation',         counts[0]],
    ['ProofOfDeliveryPhoto',  counts[1]],
    ['ProofOfDelivery',       counts[2]],
    ['Payment',               counts[3]],
    ['Message',               counts[4]],
    ['Notification',          counts[5]],
    ['Bid',                   counts[6]],
    ['Booking',               counts[7]],
    ['Load',                  counts[8]],
    ['DriverInvite',          counts[9]],
    ['Truck',                 counts[10]],
    ['SenderProfile',         counts[11]],
    ['TruckOwnerProfile',     counts[12]],
    ['VerificationDocument',  counts[13]],
    ['RefreshToken',          counts[14]],
    ['Otp',                   counts[15]],
  ] as const;

  console.log('ROW COUNTS — content tables (in FK-safe delete order)');
  console.log('─'.repeat(60));
  for (const [name, count] of rows) {
    console.log(`  ${String(name).padEnd(26)} ${String(count).padStart(6)}`);
  }
  console.log('');
  console.log('NO WRITES PERFORMED. Rerun with --delete to actually clean the slate.');
}

async function phase2_delete() {
  const t = describeDbTarget();
  console.log('══════════════════════════════════════════════════════════');
  console.log(' PHASE 2 — DELETE');
  console.log('══════════════════════════════════════════════════════════');
  console.log(` DB host:     ${t.host}`);
  console.log(` DB name:     ${t.database}`);
  console.log(` DB user:     ${t.user}`);
  console.log('══════════════════════════════════════════════════════════');

  // ── Guards ─────────────────────────────────────────────────
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, fullName: true, email: true, phone: true },
  });

  if (admins.length < 1) {
    console.error('ABORT: no ADMIN user exists in this database. Refusing to delete everything and lock the app out.');
    process.exit(2);
  }

  const adminIds = new Set(admins.map(a => a.id));

  // Sanity: verify the "users to delete" set contains no admin.
  const targets = await prisma.user.findMany({
    where: { role: { not: 'ADMIN' } },
    select: { id: true, role: true },
  });
  const targetIds = new Set(targets.map(u => u.id));
  const overlap = [...adminIds].filter(id => targetIds.has(id));
  if (overlap.length > 0) {
    console.error(`ABORT: guard tripped — the delete set includes admin id(s): ${overlap.join(', ')}`);
    process.exit(2);
  }

  console.log(`Preserving ${admins.length} admin user(s):`);
  for (const a of admins) console.log(`  ★ ${a.fullName ?? '—'}  ${a.email ?? '—'}  ${a.phone}`);
  console.log(`Will delete ${targets.length} non-admin user(s) and all their data.`);
  console.log('');

  const summary: Record<string, number> = {};

  await prisma.$transaction(async (tx) => {
    // Children → parents. Deletes cascade in FK-safe order so no
    // constraint violation. Users last.
    summary.TruckLocation        = (await tx.truckLocation.deleteMany({})).count;
    summary.ProofOfDeliveryPhoto = (await tx.proofOfDeliveryPhoto.deleteMany({})).count;
    summary.ProofOfDelivery      = (await tx.proofOfDelivery.deleteMany({})).count;
    summary.Payment              = (await tx.payment.deleteMany({})).count;
    summary.Message              = (await tx.message.deleteMany({})).count;
    summary.Notification         = (await tx.notification.deleteMany({})).count;
    summary.Bid                  = (await tx.bid.deleteMany({})).count;
    summary.Booking              = (await tx.booking.deleteMany({})).count;
    summary.Load                 = (await tx.load.deleteMany({})).count;
    summary.DriverInvite         = (await tx.driverInvite.deleteMany({})).count;
    summary.Truck                = (await tx.truck.deleteMany({})).count;
    summary.SenderProfile        = (await tx.senderProfile.deleteMany({})).count;
    summary.TruckOwnerProfile    = (await tx.truckOwnerProfile.deleteMany({})).count;
    summary.VerificationDocument = (await tx.verificationDocument.deleteMany({})).count;

    // Auth junk for non-admin users. Admin's tokens/OTPs stay.
    summary.RefreshToken         = (await tx.refreshToken.deleteMany({ where: { userId: { in: [...targetIds] } } })).count;
    // Otp is keyed by identifier (phone/email), not userId — safe to nuke all
    // stale OTPs; live admin OTPs (if any right now) are one-shot anyway.
    summary.Otp                  = (await tx.otp.deleteMany({})).count;

    // Users last — guaranteed to exclude any admin by the where clause.
    summary.User                 = (await tx.user.deleteMany({ where: { role: { not: 'ADMIN' } } })).count;
  }, { timeout: 30_000 });

  console.log('DELETED — per table:');
  console.log('─'.repeat(60));
  for (const [name, count] of Object.entries(summary)) {
    console.log(`  ${name.padEnd(26)} ${String(count).padStart(6)}`);
  }
  console.log('');

  // ── Post-check ─────────────────────────────────────────────
  const remainingUsers = await prisma.user.findMany({
    select: { id: true, fullName: true, email: true, phone: true, role: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`REMAINING USERS — ${remainingUsers.length}`);
  console.log('─'.repeat(60));
  for (const u of remainingUsers) {
    const flag = u.role === 'ADMIN' ? '★ ADMIN' : '  OTHER';
    console.log(`${flag}  ${u.role.padEnd(13)}  ${u.fullName ?? '—'}  ${u.email ?? '—'}  ${u.phone}`);
  }
  if (remainingUsers.some(u => u.role !== 'ADMIN')) {
    console.error('WARNING: non-admin user still present — investigate.');
    process.exit(3);
  }
  console.log('');
  console.log('Clean slate complete.');
}

async function main() {
  const doDelete = process.argv.includes('--delete');
  try {
    if (doDelete) {
      await phase2_delete();
    } else {
      await phase1_inspect();
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
