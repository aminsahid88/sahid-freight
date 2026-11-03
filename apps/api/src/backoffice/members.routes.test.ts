import { test } from "node:test";
import assert from "node:assert/strict";
import { accessToken, addMember, companyWithOwner, createUser, prisma } from "../test/fixtures";
import { startTestServer, type TestServer } from "./test-harness";

let s: TestServer;
test.before(async () => {
  s = await startTestServer();
});
test.after(async () => s.close());

test("members: list with user details; owner adds an existing account by email (case-insensitive); duplicates and unknown emails are refused", async () => {
  const a = await companyWithOwner();
  const newbie = await createUser();
  const list0 = await s.api("GET", `/companies/${a.company.id}/members`, a.token);
  assert.equal(list0.status, 200, list0.text);
  const members0 = list0.json.members as Array<{ role: string; user: { id: string; fullName: string; email: string } }>;
  assert.equal(members0.length, 1);
  assert.equal(members0[0]!.role, "OWNER");
  assert.equal(members0[0]!.user.email, a.user.email);

  const missing = await s.api("POST", `/companies/${a.company.id}/members`, a.token, { email: "nobody-here@test.local", role: "STAFF" });
  assert.equal(missing.status, 404);
  assert.equal(missing.json.error, "user_not_found");
  assert.match(String(missing.json.message), /register first/);
  assert.equal((await s.api("POST", `/companies/${a.company.id}/members`, a.token, { email: newbie.email, role: "ADMIN" })).status, 400, "ADMIN is not grantable");
  assert.equal((await s.api("POST", `/companies/${a.company.id}/members`, a.token, { email: "not-an-email", role: "STAFF" })).status, 400);

  const added = await s.api("POST", `/companies/${a.company.id}/members`, a.token, { email: newbie.email!.toUpperCase(), role: "STAFF" });
  assert.equal(added.status, 201, added.text);
  const member = added.json.member as { id: string; role: string; user: { id: string } };
  assert.equal(member.role, "STAFF");
  assert.equal(member.user.id, newbie.id);
  assert.equal((await s.api("POST", `/companies/${a.company.id}/members`, a.token, { email: newbie.email, role: "STAFF" })).status, 400, "already a member");
  const log = await prisma.auditLog.findFirst({ where: { companyId: a.company.id, action: "member_added", target: `Membership:${member.id}` } });
  assert.equal((log!.meta as { memberUserId: string }).memberUserId, newbie.id);

  // The new staff member can now read the company and the member list, but not add people.
  const st = accessToken(newbie.id, newbie.role);
  assert.equal((await s.api("GET", `/companies/${a.company.id}`, st)).status, 200);
  assert.equal(((await s.api("GET", `/companies/${a.company.id}/members`, st)).json.members as unknown[]).length, 2);
  const third = await createUser();
  assert.equal((await s.api("POST", `/companies/${a.company.id}/members`, st, { email: third.email, role: "DRIVER" })).status, 403);
});

test("tenancy: another company's owner cannot list or add members", async () => {
  const a = await companyWithOwner();
  const b = await companyWithOwner();
  const victim = await createUser();
  await addMember(victim.id, a.company.id, "STAFF");
  assert.equal((await s.api("GET", `/companies/${a.company.id}/members`, b.token)).status, 404);
  assert.equal((await s.api("POST", `/companies/${a.company.id}/members`, b.token, { email: b.user.email, role: "OWNER" })).status, 404);
  assert.equal(await prisma.membership.count({ where: { companyId: a.company.id } }), 2);
  assert.equal(await prisma.membership.count({ where: { companyId: a.company.id, userId: b.user.id } }), 0);
});
