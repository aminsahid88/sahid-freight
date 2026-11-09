import { test } from "node:test";
import assert from "node:assert/strict";
import { accessToken, companyWithOwner, createUser, prisma, uid } from "../test/fixtures";
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
