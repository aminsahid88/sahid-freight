import { test } from "node:test";
import assert from "node:assert/strict";
import { accessToken, companyWithOwner, createUser, prisma, uid } from "../test/fixtures";
import { claimNext, runOne } from "../jobs/queue";
import { startTestServer, type TestServer } from "./test-harness";

let s: TestServer;
let adminToken = "";
let adminId = "";
test.before(async () => {
  s = await startTestServer();
  const admin = await createUser("ADMIN");
  adminId = admin.id;
  adminToken = accessToken(admin.id, "ADMIN");
});
test.after(async () => s.close());

async function failedJob(companyId: string, documentId = uid("doc")) {
  return prisma.job.create({
    data: {
      idempotencyKey: `${documentId}:extract-a:test-${uid()}`,
      step: "extract-a",
      companyId,
      payload: { documentId },
      status: "FAILED",
      attempts: 3,
      maxAttempts: 3,
      error: "Error: upstream timed out",
    },
  });
}

test("only platform admins: company owners get 403, anonymous callers 401, on every control-room route", async () => {
  const owner = await companyWithOwner();
  for (const [method, url, body] of [
    ["GET", "/admin/overview"],
    ["GET", "/admin/companies"],
    ["GET", "/admin/jobs"],
    ["GET", "/admin/audit"],
    ["POST", "/admin/jobs/retry-failed", {}],
    ["POST", `/admin/jobs/${uid()}/retry`, {}],
    ["GET", "/admin/users"],
    ["POST", `/admin/users/${owner.user.id}/suspend`, { reason: "should never be allowed" }],
    ["POST", `/admin/users/${owner.user.id}/reactivate`, {}],
    ["POST", `/admin/companies/${owner.company.id}/pause`, { reason: "should never be allowed" }],
    ["POST", `/admin/companies/${owner.company.id}/resume`, {}],
    ["GET", "/admin/processing"],
    ["POST", "/admin/processing/pause", { reason: "should never be allowed" }],
    ["POST", "/admin/processing/resume", {}],
  ] as Array<[string, string, unknown?]>) {
    assert.equal((await s.api(method, url, owner.token, body)).status, 403, `${method} ${url} as owner`);
    assert.equal((await s.api(method, url, null, body)).status, 401, `${method} ${url} anonymous`);
  }
});

test("overview and companies: platform-wide counts include a company the admin is not a member of", async () => {
  const a = await companyWithOwner();
  await prisma.vehicle.create({ data: { companyId: a.company.id, unitNumber: "901" } });
  await failedJob(a.company.id);

  const overview = await s.api("GET", "/admin/overview", adminToken);
  assert.equal(overview.status, 200, overview.text);
  assert.ok((overview.json.companies as number) >= 1);
  assert.ok((overview.json.users as number) >= 1);
  const jobs = overview.json.jobs as Record<string, number>;
  assert.ok(jobs.FAILED >= 1);
  assert.deepEqual(Object.keys(jobs).sort(), ["DONE", "FAILED", "QUEUED", "RUNNING"]);
  const spend = overview.json.spend as { monthUsd: string; budgetUsd: string };
  assert.match(spend.monthUsd, /^\d+\.\d{5}$/);
  assert.match(spend.budgetUsd, /^\d+\.\d{2}$/);

  const companies = await s.api("GET", "/admin/companies", adminToken);
  assert.equal(companies.status, 200, companies.text);
  const row = (companies.json.companies as Array<{ id: string; legalName: string; counts: Record<string, number>; lastDocumentAt: string | null }>).find((c) => c.id === a.company.id);
  assert.ok(row, "company listed");
  assert.equal(row.counts.members, 1);
  assert.equal(row.counts.vehicles, 1);
  assert.equal(row.counts.documents, 0);
  assert.equal(row.counts.failedJobs, 1);
  assert.equal(row.lastDocumentAt, null);
  // No secrets or tenant documents leak through the listing.
  assert.equal("iftaAccountEnc" in row, false);
});

test("jobs: list filters by status and company; a failed job can be retried once, then it is queued and audited", async () => {
  const a = await companyWithOwner();
  const job = await failedJob(a.company.id, uid("doc"));

  const failed = await s.api("GET", `/admin/jobs?status=FAILED&companyId=${a.company.id}`, adminToken);
  assert.equal(failed.status, 200, failed.text);
  const rows = failed.json.jobs as Array<{ id: string; status: string; documentId: string | null; company: { legalName: string } | null; key: string }>;
  assert.deepEqual(
    rows.map((j) => [j.id, j.status, j.company?.legalName]),
    [[job.id, "FAILED", a.company.legalName]],
  );
  assert.equal(rows[0]!.documentId, (job.payload as { documentId: string }).documentId);
  assert.equal((failed.json.counts as Record<string, number>).FAILED, 1);

  const retry = await s.api("POST", `/admin/jobs/${job.id}/retry`, adminToken, {});
  assert.equal(retry.status, 200, retry.text);
  const after = await prisma.job.findUniqueOrThrow({ where: { id: job.id } });
  assert.equal(after.status, "QUEUED");
  assert.equal(after.attempts, 0);
  assert.equal(after.error, null);
  assert.ok(after.runAfter.getTime() <= Date.now());
  const log = await prisma.auditLog.findFirst({ where: { action: "reprocess", target: `Job:${job.id}` } });
  assert.ok(log, "retry audited");
  assert.equal(log.userId, adminId);
  assert.equal(log.companyId, a.company.id);
  assert.equal((log.meta as { previousError: string }).previousError, "Error: upstream timed out");

  // Only FAILED jobs can be retried; a second retry is refused and the row is untouched.
  const again = await s.api("POST", `/admin/jobs/${job.id}/retry`, adminToken, {});
  assert.equal(again.status, 409, again.text);
  assert.equal((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).attempts, 0);
  assert.equal((await s.api("POST", `/admin/jobs/${uid()}/retry`, adminToken, {})).status, 400, "not a uuid");
  assert.equal((await s.api("POST", `/admin/jobs/00000000-0000-4000-8000-000000000000/retry`, adminToken, {})).status, 404);
  assert.equal((await s.api("GET", `/admin/jobs?status=BROKEN`, adminToken)).status, 400);
});

test("retry-failed requeues every failed job of one company and leaves other companies alone", async () => {
  const a = await companyWithOwner();
  const b = await companyWithOwner();
  await failedJob(a.company.id);
  await failedJob(a.company.id);
  const other = await failedJob(b.company.id);

  const res = await s.api("POST", "/admin/jobs/retry-failed", adminToken, { companyId: a.company.id });
  assert.equal(res.status, 200, res.text);
  assert.equal(res.json.requeued, 2);
  assert.equal(await prisma.job.count({ where: { companyId: a.company.id, status: "FAILED" } }), 0);
  assert.equal(await prisma.job.count({ where: { companyId: a.company.id, status: "QUEUED", attempts: 0 } }), 2);
  assert.equal((await prisma.job.findUniqueOrThrow({ where: { id: other.id } })).status, "FAILED");
  const log = await prisma.auditLog.findFirst({ where: { action: "reprocess", target: "Job:failed", companyId: a.company.id }, orderBy: { createdAt: "desc" } });
  assert.ok(log);
  assert.equal((log.meta as { requeued: number }).requeued, 2);
  // Nothing to do is not an error and writes no audit row.
  const before = await prisma.auditLog.count({ where: { action: "reprocess", target: "Job:failed" } });
  assert.equal((await s.api("POST", "/admin/jobs/retry-failed", adminToken, { companyId: a.company.id })).json.requeued, 0);
  assert.equal(await prisma.auditLog.count({ where: { action: "reprocess", target: "Job:failed" } }), before);
});

test("audit: break-glass entries show up across companies with user and company; filters by company, action and target text; pages by before", async () => {
  const a = await companyWithOwner();
  const reason = `support ticket ${uid()}: owner asked for help`;
  const glass = await s.api("GET", `/companies/${a.company.id}`, adminToken, undefined, { "x-break-glass-reason": reason });
  assert.equal(glass.status, 200, glass.text);

  const all = await s.api("GET", `/admin/audit?companyId=${a.company.id}`, adminToken);
  assert.equal(all.status, 200, all.text);
  const entries = all.json.entries as Array<{ action: string; companyId: string | null; user: { id: string; fullName: string } | null; company: { legalName: string } | null; meta: { reason?: string } | null }>;
  const bg = entries.find((e) => e.action === "break_glass");
  assert.ok(bg, "break-glass row listed");
  assert.equal(bg.user?.id, adminId);
  assert.equal(bg.company?.legalName, a.company.legalName);
  assert.equal(bg.meta?.reason, reason);
  assert.ok(entries.every((e) => e.companyId === a.company.id));

  const byAction = await s.api("GET", `/admin/audit?action=break_glass&q=${encodeURIComponent(`/companies/${a.company.id}`)}`, adminToken);
  assert.equal(byAction.status, 200, byAction.text);
  const acts = byAction.json.entries as Array<{ action: string; companyId: string | null }>;
  assert.ok(acts.length >= 1);
  assert.ok(acts.every((e) => e.action === "break_glass" && e.companyId === a.company.id));

  const page = await s.api("GET", `/admin/audit?limit=1`, adminToken);
  assert.equal((page.json.entries as unknown[]).length, 1);
  assert.ok(page.json.nextBefore, "more pages exist");
  const next = await s.api("GET", `/admin/audit?limit=1&before=${encodeURIComponent(String(page.json.nextBefore))}`, adminToken);
  assert.equal(next.status, 200, next.text);
  assert.notEqual((next.json.entries as Array<{ id: string }>)[0]?.id, (page.json.entries as Array<{ id: string }>)[0]?.id);
  assert.equal((await s.api("GET", `/admin/audit?action=made_up`, adminToken)).status, 400);
});

async function queuedJob(companyId: string | null, step: string) {
  // runAfter in the past so the job is runnable at once.
  return prisma.job.create({ data: { idempotencyKey: `${uid("doc")}:${step}:t`, step, companyId, payload: { documentId: uid("doc") }, runAfter: new Date(Date.now() - 10 * 60_000) } });
}

test("suspend: the person is cut off on their very next request, it is audited, and reactivating restores access", async () => {
  const a = await companyWithOwner();
  assert.equal((await s.api("GET", `/companies/${a.company.id}`, a.token)).status, 200);

  assert.equal((await s.api("POST", `/admin/users/${a.user.id}/suspend`, adminToken, { reason: "short" })).status, 400, "reason too short");
  const sus = await s.api("POST", `/admin/users/${a.user.id}/suspend`, adminToken, { reason: "chargeback dispute, hold the account" });
  assert.equal(sus.status, 200, sus.text);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: a.user.id } })).status, "SUSPENDED");

  // Same, still-valid token: refused everywhere in the back office.
  const blocked = await s.api("GET", `/companies/${a.company.id}`, a.token);
  assert.equal(blocked.status, 401);
  assert.equal(blocked.json.error ?? blocked.json.code, "account_suspended", blocked.text);
  assert.equal((await s.api("GET", "/companies", a.token)).status, 401);
  assert.equal((await s.api("GET", "/review/queue", a.token)).status, 401);
  assert.equal((await s.api("POST", `/admin/users/${a.user.id}/suspend`, adminToken, { reason: "chargeback dispute, again" })).status, 409);

  const log = await prisma.auditLog.findFirst({ where: { action: "user_suspended", target: `User:${a.user.id}` } });
  assert.ok(log);
  assert.equal(log.userId, adminId);
  assert.equal((log.meta as { reason: string; previousStatus: string }).previousStatus, "ACTIVE");

  const list = await s.api("GET", `/admin/users?q=${encodeURIComponent(a.user.fullName)}`, adminToken);
  assert.equal(list.status, 200, list.text);
  const row = (list.json.users as Array<{ id: string; status: string; memberships: Array<{ role: string; company: { id: string } }> }>).find((u) => u.id === a.user.id);
  assert.equal(row?.status, "SUSPENDED");
  assert.deepEqual(row?.memberships.map((m) => [m.role, m.company.id]), [["OWNER", a.company.id]]);

  const re = await s.api("POST", `/admin/users/${a.user.id}/reactivate`, adminToken, { reason: "dispute settled" });
  assert.equal(re.status, 200, re.text);
  assert.equal((await s.api("GET", `/companies/${a.company.id}`, a.token)).status, 200);
  assert.ok(await prisma.auditLog.findFirst({ where: { action: "user_reactivated", target: `User:${a.user.id}` } }));
  assert.equal((await s.api("POST", `/admin/users/${a.user.id}/reactivate`, adminToken, {})).status, 409);

  // An admin cannot lock themselves out.
  assert.equal((await s.api("POST", `/admin/users/${adminId}/suspend`, adminToken, { reason: "testing self suspension" })).status, 400);
  assert.equal((await s.api("POST", `/admin/users/00000000-0000-4000-8000-000000000000/suspend`, adminToken, { reason: "nobody by that id here" })).status, 404);
});

test("pause a company: members can read but not write, its jobs wait, a break-glass admin can still act; resume undoes it", async () => {
  const a = await companyWithOwner();
  const step = `pause-test-${uid()}`;
  const job = await queuedJob(a.company.id, step);

  const p = await s.api("POST", `/admin/companies/${a.company.id}/pause`, adminToken, { reason: "unpaid invoice, paused for billing" });
  assert.equal(p.status, 200, p.text);
  assert.equal((await s.api("POST", `/admin/companies/${a.company.id}/pause`, adminToken, { reason: "unpaid invoice, paused again" })).status, 409);

  assert.equal((await s.api("GET", `/companies/${a.company.id}`, a.token)).status, 200, "reads still work");
  const mine = await s.api("GET", "/companies", a.token);
  const entry = (mine.json.companies as Array<{ company: { id: string; pausedAt: string | null; pausedReason: string | null } }>).find((c) => c.company.id === a.company.id);
  assert.ok(entry?.company.pausedAt, "the member sees the pause");
  assert.equal(entry?.company.pausedReason, "unpaid invoice, paused for billing");

  const write = await s.api("POST", `/companies/${a.company.id}/vehicles`, a.token, { unitNumber: "777" });
  assert.equal(write.status, 423, write.text);
  assert.match(String(write.json.message), /paused/);
  assert.equal(await prisma.vehicle.count({ where: { companyId: a.company.id, unitNumber: "777" } }), 0);

  // The worker skips the paused company's job; nothing is dropped.
  assert.equal(await claimNext(prisma, [step]), null);
  assert.equal((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).status, "QUEUED");

  // Support can still work inside it with a logged reason.
  const glass = await s.api("POST", `/companies/${a.company.id}/vehicles`, adminToken, { unitNumber: "778" }, { "x-break-glass-reason": "support fixing a truck during the pause" });
  assert.equal(glass.status, 201, glass.text);

  const companies = await s.api("GET", "/admin/companies", adminToken);
  assert.ok((companies.json.companies as Array<{ id: string; pausedAt: string | null }>).find((c) => c.id === a.company.id)?.pausedAt);
  assert.ok(await prisma.auditLog.findFirst({ where: { action: "company_paused", companyId: a.company.id } }));

  const r = await s.api("POST", `/admin/companies/${a.company.id}/resume`, adminToken, { reason: "invoice paid" });
  assert.equal(r.status, 200, r.text);
  assert.equal((await s.api("POST", `/companies/${a.company.id}/vehicles`, a.token, { unitNumber: "779" })).status, 201);
  const claimed = await claimNext(prisma, [step]);
  assert.equal(claimed?.id, job.id, "the waiting job runs after resume");
  await prisma.job.update({ where: { id: job.id }, data: { status: "DONE" } });
  const resumed = await prisma.auditLog.findFirst({ where: { action: "company_resumed", companyId: a.company.id } });
  assert.equal((resumed?.meta as { pausedReason: string }).pausedReason, "unpaid invoice, paused for billing");
  assert.equal((await s.api("POST", `/admin/companies/${a.company.id}/resume`, adminToken, {})).status, 409);
});

test("pause all processing: the worker claims nothing until resumed, the overview shows it, both steps are audited", async () => {
  const step = `proc-test-${uid()}`;
  const job = await queuedJob(null, step);
  let ran = 0;
  const processors = { [step]: async () => void ran++ };
  try {
    assert.equal((await s.api("POST", "/admin/processing/pause", adminToken, { reason: "x" })).status, 400);
    const p = await s.api("POST", "/admin/processing/pause", adminToken, { reason: "provider outage, stop spending" });
    assert.equal(p.status, 200, p.text);
    assert.equal((await s.api("POST", "/admin/processing/pause", adminToken, { reason: "provider outage, again" })).status, 409);

    const r1 = await runOne(prisma, processors);
    assert.deepEqual(r1, { ran: false, paused: true });
    assert.equal(ran, 0);
    assert.equal((await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).status, "QUEUED");

    const state = await s.api("GET", "/admin/processing", adminToken);
    assert.equal((state.json.processing as { paused: boolean; reason: string }).paused, true);
    const ov = await s.api("GET", "/admin/overview", adminToken);
    assert.equal((ov.json.processing as { paused: boolean }).paused, true);
    assert.equal(typeof ov.json.suspendedUsers, "number");
    assert.equal(typeof ov.json.pausedCompanies, "number");
  } finally {
    const res = await s.api("POST", "/admin/processing/resume", adminToken, { reason: "provider back" });
    assert.ok(res.status === 200 || res.status === 409, res.text);
  }
  assert.equal(((await s.api("GET", "/admin/processing", adminToken)).json.processing as { paused: boolean }).paused, false);
  // Resumed: a run picks the job up (claimNext limited to this step's processors).
  const r2 = await runOne(prisma, processors);
  assert.equal(r2.ran, true);
  assert.equal(ran, 1);
  assert.ok(await prisma.auditLog.findFirst({ where: { action: "processing_paused", userId: adminId } }));
  const resumed = await prisma.auditLog.findFirst({ where: { action: "processing_resumed", userId: adminId }, orderBy: { createdAt: "desc" } });
  assert.equal((resumed?.meta as { pausedReason: string }).pausedReason, "provider outage, stop spending");
});
