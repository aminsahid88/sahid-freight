import { test } from "node:test";
import assert from "node:assert/strict";
import { accessToken, companyWithOwner, createUser, prisma } from "../test/fixtures";
import { seedJurisdictions, startTestServer, type TestServer } from "./test-harness";

let s: TestServer;
let adminToken = "";
test.before(async () => {
  s = await startTestServer();
  await seedJurisdictions();
  const admin = await createUser("ADMIN");
  adminToken = accessToken(admin.id, "ADMIN");
});
test.after(async () => s.close());

const SOURCE = "https://www.iftach.org/taxmatrix/fictional-2031Q3";

test("platform admin loads a quarter's table (upsert), lists it; audit entry targets IftaRate:<quarter>", async () => {
  const body = {
    quarter: "2031Q3",
    sourceUrl: SOURCE,
    rows: [
      { jurisdiction: "oh", rate: "0.47" },
      { jurisdiction: "IN", rate: "0.55", surcharge: "0.21" },
      { jurisdiction: "IL", rate: "0.467" },
    ],
  };
  const res = await s.api("POST", "/admin/ifta-rates", adminToken, body);
  assert.equal(res.status, 201, res.text);
  assert.equal(res.json.rows, 3);
  assert.equal(res.json.fuelType, "diesel");

  // Re-loading corrects a rate in place (same unique key), no duplicates.
  const again = await s.api("POST", "/admin/ifta-rates", adminToken, { ...body, rows: [{ jurisdiction: "OH", rate: "0.48" }] });
  assert.equal(again.status, 201, again.text);
  const list = await s.api("GET", "/admin/ifta-rates/2031Q3", adminToken);
  assert.equal(list.status, 200, list.text);
  const rates = list.json.rates as Array<{ jurisdiction: string; rate: string; surcharge: string | null; fuelType: string; sourceUrl: string }>;
  assert.deepEqual(
    rates.map((r) => [r.jurisdiction, r.rate, r.surcharge]),
    [
      ["IL", "0.467", null],
      ["IN", "0.55", "0.21"],
      ["OH", "0.48", null],
    ],
  );
  assert.ok(rates.every((r) => r.fuelType === "diesel" && r.sourceUrl === SOURCE));
  assert.equal(await prisma.iftaRate.count({ where: { quarter: "2031Q3" } }), 3);
  const log = await prisma.auditLog.findFirst({ where: { action: "edit", target: "IftaRate:2031Q3" }, orderBy: { createdAt: "desc" } });
  assert.ok(log);
  assert.equal(log.companyId, null);
  assert.equal((log.meta as { rows: number }).rows, 1);
  assert.deepEqual((await s.api("GET", "/admin/ifta-rates/2031Q4", adminToken)).json.rates, []);
});

test("validation: quarter label, decimal strings, 2-letter known jurisdictions, duplicates, source URL", async () => {
  const good = { quarter: "2031Q3", sourceUrl: SOURCE, rows: [{ jurisdiction: "OH", rate: "0.47" }] };
  const cases: Array<[Record<string, unknown>, RegExp]> = [
    [{ ...good, quarter: "Q4-2031" }, /quarter/],
    [{ ...good, rows: [{ jurisdiction: "OH", rate: "0.47000001" }] }, /rate/],
    [{ ...good, rows: [{ jurisdiction: "OH", rate: "$0.47" }] }, /rate/],
    [{ ...good, rows: [{ jurisdiction: "OHI", rate: "0.47" }] }, /jurisdiction/],
    [{ ...good, rows: [{ jurisdiction: "ZZ", rate: "0.47" }] }, /Unknown jurisdiction/],
    [{ ...good, rows: [{ jurisdiction: "OH", rate: "0.47" }, { jurisdiction: "oh", rate: "0.48" }] }, /more than once/],
    [{ ...good, rows: [] }, /rows/],
    [{ ...good, sourceUrl: "not a url" }, /sourceUrl/],
  ];
  for (const [body, re] of cases) {
    const res = await s.api("POST", "/admin/ifta-rates", adminToken, body);
    assert.equal(res.status, 400, `${JSON.stringify(body)} → ${res.text}`);
    assert.match(String(res.json.message), re);
  }
  assert.equal((await s.api("GET", "/admin/ifta-rates/nope", adminToken)).status, 400);
});

test("only platform admins: company owners and anonymous callers are refused", async () => {
  const owner = await companyWithOwner();
  const body = { quarter: "2031Q3", sourceUrl: SOURCE, rows: [{ jurisdiction: "OH", rate: "9.99" }] };
  assert.equal((await s.api("POST", "/admin/ifta-rates", owner.token, body)).status, 403);
  assert.equal((await s.api("GET", "/admin/ifta-rates/2031Q3", owner.token)).status, 403);
  assert.equal((await s.api("POST", "/admin/ifta-rates", null, body)).status, 401);
  const oh = await prisma.iftaRate.findUnique({ where: { quarter_jurisdiction_fuelType: { quarter: "2031Q3", jurisdiction: "OH", fuelType: "diesel" } } });
  assert.notEqual(oh?.rate.toString(), "9.99");
});
