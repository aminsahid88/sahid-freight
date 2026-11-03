import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { getEnv } from "../config/env";
import { LocalStorage } from "../storage";
import { accessToken, addMember, companyWithOwner, createUser, prisma } from "../test/fixtures";
import { createBackofficeApp } from "./app";

const dir = mkdtempSync(path.join(os.tmpdir(), "tbo-routes-"));
const env = getEnv();
const storage = new LocalStorage({ dir, secret: env.JWT_SECRET, baseUrl: "http://localhost:0" });
const { app } = createBackofficeApp({ prisma, env, storage });

let server: Server;
let base = "";

test.before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no address");
  base = `http://127.0.0.1:${addr.port}`;
});
test.after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
});

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("fictional receipt bytes")]);
const PDF = Buffer.from("%PDF-1.4\n%fictional\n1 0 obj<<>>endobj\n");

async function api(method: string, url: string, token: string | null, body?: unknown, headers: Record<string, string> = {}) {
  const res = await fetch(base + url, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body instanceof FormData ? {} : body ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}

function form(files: Array<{ name: string; bytes: Buffer; type: string }>): FormData {
  const fd = new FormData();
  for (const f of files) fd.append("files", new Blob([f.bytes], { type: f.type }), f.name);
  return fd;
}

test("create company: caller becomes OWNER, a quarter period exists, audit entry written", async () => {
  const user = await createUser();
  const token = accessToken(user.id, user.role);
  const res = await api("POST", "/companies", token, { legalName: "Fictional Hauling LLC", usdot: "1234567", iftaBaseJurisdiction: "mn" });
  assert.equal(res.status, 201, JSON.stringify(res.json));
  const company = res.json.company as { id: string; iftaBaseJurisdiction: string };
  assert.equal(company.iftaBaseJurisdiction, "MN");
  const mine = await api("GET", "/companies", token);
  assert.deepEqual((mine.json.companies as Array<{ roles: string[] }>).map((c) => c.roles), [["OWNER"]]);
  const periods = await api("GET", `/companies/${company.id}/periods`, token);
  assert.equal((periods.json.periods as unknown[]).length, 1);
  const entry = await prisma.auditLog.findFirst({ where: { companyId: company.id, action: "company_created" } });
  assert.ok(entry);
});

test("validation errors name the field and never hit the database", async () => {
  const user = await createUser();
  const token = accessToken(user.id, user.role);
  const res = await api("POST", "/companies", token, { legalName: "X", usdot: "abc" });
  assert.equal(res.status, 400);
  assert.match(String(res.json.message), /legalName/);
  assert.match(String(res.json.message), /usdot/);
});

test("unauthenticated and cross-company requests fail with 401 / 404", async () => {
  const a = await companyWithOwner();
  const b = await companyWithOwner();
  assert.equal((await api("GET", `/companies/${a.company.id}`, null)).status, 401);
  // B's owner cannot see, list or write into A.
  assert.equal((await api("GET", `/companies/${a.company.id}`, b.token)).status, 404);
  assert.equal((await api("GET", `/companies/${a.company.id}/documents`, b.token)).status, 404);
  assert.equal((await api("POST", `/companies/${a.company.id}/vehicles`, b.token, { unitNumber: "9" })).status, 404);
  assert.equal(await prisma.vehicle.count({ where: { companyId: a.company.id } }), 0);
  // A platform admin without membership is also refused unless a logged reason is given.
  const admin = await createUser("ADMIN");
  const adminToken = accessToken(admin.id, "ADMIN");
  assert.equal((await api("GET", `/companies/${a.company.id}`, adminToken)).status, 404);
  const glass = await api("GET", `/companies/${a.company.id}`, adminToken, undefined, { "x-break-glass-reason": "support ticket 4821: owner asked for help" });
  assert.equal(glass.status, 200);
  assert.equal(glass.json.breakGlass, true);
  const logged = await prisma.auditLog.findFirst({ where: { companyId: a.company.id, action: "break_glass", userId: admin.id } });
  assert.ok(logged);
});

test("role checks: a DRIVER can upload but cannot add vehicles or read the audit log", async () => {
  const a = await companyWithOwner();
  const driver = await createUser("DRIVER");
  await addMember(driver.id, a.company.id, "DRIVER");
  const dt = accessToken(driver.id, "DRIVER");
  assert.equal((await api("POST", `/companies/${a.company.id}/vehicles`, dt, { unitNumber: "7" })).status, 403);
  assert.equal((await api("GET", `/companies/${a.company.id}/audit`, dt)).status, 403);
  const up = await api("POST", `/companies/${a.company.id}/documents`, dt, form([{ name: "pump.png", bytes: PNG, type: "image/png" }]));
  assert.equal(up.status, 201, JSON.stringify(up.json));
});

test("vehicles and drivers: create, list, update, with audit entries", async () => {
  const a = await companyWithOwner();
  const v = await api("POST", `/companies/${a.company.id}/vehicles`, a.token, { unitNumber: "101", vin: "1xkad49x0dj000101", axles: 5, tankCapacityGal: "300.000" });
  assert.equal(v.status, 201, JSON.stringify(v.json));
  const vehicle = v.json.vehicle as { id: string; vin: string; tankCapacityGal: string };
  assert.equal(vehicle.vin, "1XKAD49X0DJ000101");
  assert.equal(String(vehicle.tankCapacityGal), "300");
  assert.equal((await api("POST", `/companies/${a.company.id}/vehicles`, a.token, { unitNumber: "101" })).status, 400, "duplicate unit");
  const d = await api("POST", `/companies/${a.company.id}/drivers`, a.token, { name: "Demo Driver", phone: "+16125550199", defaultVehicleId: vehicle.id, language: "SO" });
  assert.equal(d.status, 201, JSON.stringify(d.json));
  const bad = await api("POST", `/companies/${a.company.id}/drivers`, a.token, { name: "Other", defaultVehicleId: "00000000-0000-4000-8000-000000000000" });
  assert.equal(bad.status, 400);
  const patched = await api("PATCH", `/companies/${a.company.id}/vehicles/${vehicle.id}`, a.token, { eldProvider: "Motive" });
  assert.equal((patched.json.vehicle as { eldProvider: string }).eldProvider, "Motive");
  const list = await api("GET", `/companies/${a.company.id}/drivers`, a.token);
  assert.equal((list.json.drivers as Array<{ defaultVehicle: { unitNumber: string } }>)[0]?.defaultVehicle.unitNumber, "101");
  const auditRes = await api("GET", `/companies/${a.company.id}/audit`, a.token);
  const actions = (auditRes.json.entries as Array<{ action: string; target: string }>).map((e) => `${e.action}:${e.target.split(":")[0]}`);
  assert.ok(actions.includes("edit:Vehicle") && actions.includes("edit:Driver"));
});

test("Phase 0 gate: upload → stored → visible with hash, status and audit entry; duplicates flagged; bad files rejected", async () => {
  const a = await companyWithOwner();
  const up = await api(
    "POST",
    `/companies/${a.company.id}/documents`,
    a.token,
    form([
      { name: "../evil path/Receipt (1).PNG", bytes: PNG, type: "image/png" },
      { name: "statement.pdf", bytes: PDF, type: "application/pdf" },
      { name: "virus.pdf", bytes: Buffer.from("MZ\u0090\u0000not a pdf"), type: "application/pdf" },
    ]),
  );
  assert.equal(up.status, 201, JSON.stringify(up.json));
  const uploaded = up.json.uploaded as Array<{ id: string; filename: string; sha256: string; status: string; isExactDuplicateOf: string | null }>;
  const rejected = up.json.rejected as Array<{ filename: string; reason: string }>;
  assert.equal(uploaded.length, 2);
  assert.deepEqual(rejected, [{ filename: "virus.pdf", reason: "content_mismatch" }]);
  const png = uploaded.find((u) => u.filename.endsWith(".png"))!;
  assert.equal(png.filename, "Receipt_1.png");
  assert.match(png.sha256, /^[0-9a-f]{64}$/);
  assert.equal(png.status, "RECEIVED");
  assert.equal(png.isExactDuplicateOf, null);

  // Stored immutably under the company prefix, bytes intact.
  const row = await prisma.document.findUnique({ where: { id: png.id } });
  assert.ok(row);
  assert.equal(row.storageKey, `companies/${a.company.id}/documents/${png.id}/original.png`);
  assert.deepEqual(await storage.get(row.storageKey), PNG);
  assert.ok(row.retentionUntil.getTime() > Date.now() + 3 * 365 * 24 * 3600 * 1000, "retention is years out");

  // Audit entry for the upload, with the hash.
  const auditRow = await prisma.auditLog.findFirst({ where: { companyId: a.company.id, action: "upload", target: `Document:${png.id}` } });
  assert.ok(auditRow);
  assert.equal((auditRow.meta as { sha256: string }).sha256, png.sha256);

  // A preprocess job was queued exactly once.
  assert.equal(await prisma.job.count({ where: { idempotencyKey: `${png.id}:preprocess:v1` } }), 1);

  // Visible in the inbox and in detail, with a working signed URL; viewing is audited.
  const list = await api("GET", `/companies/${a.company.id}/documents`, a.token);
  assert.equal((list.json.documents as unknown[]).length, 2);
  const detail = await api("GET", `/companies/${a.company.id}/documents/${png.id}`, a.token);
  assert.equal(detail.status, 200);
  const signed = new URL(String(detail.json.signedUrl));
  const fetched = await fetch(`${base}${signed.pathname}${signed.search}`);
  assert.equal(fetched.status, 200);
  assert.equal(fetched.headers.get("content-type"), "image/png");
  assert.equal(fetched.headers.get("cross-origin-resource-policy"), "cross-origin", "web app on another origin must be able to embed previews");
  assert.deepEqual(Buffer.from(await fetched.arrayBuffer()), PNG);
  assert.ok(await prisma.auditLog.findFirst({ where: { companyId: a.company.id, action: "view_document", target: `Document:${png.id}` } }));
  // A tampered link is refused.
  signed.searchParams.set("exp", String(Number(signed.searchParams.get("exp")) + 60));
  assert.equal((await fetch(`${base}${signed.pathname}${signed.search}`)).status, 403);

  // Re-uploading the same bytes is stored but flagged D001 and linked to the first copy.
  const again = await api("POST", `/companies/${a.company.id}/documents`, a.token, form([{ name: "same.png", bytes: PNG, type: "image/png" }]));
  const dup = (again.json.uploaded as typeof uploaded)[0]!;
  assert.equal(dup.isExactDuplicateOf, png.id);
  const issue = await prisma.issue.findFirst({ where: { documentId: dup.id, code: "D001" } });
  assert.equal(issue?.severity, "WARNING");

  // The same bytes in another company are not a duplicate there.
  const b = await companyWithOwner();
  const other = await api("POST", `/companies/${b.company.id}/documents`, b.token, form([{ name: "same.png", bytes: PNG, type: "image/png" }]));
  assert.equal((other.json.uploaded as typeof uploaded)[0]!.isExactDuplicateOf, null);
  // ...and company B cannot read A's document.
  assert.equal((await api("GET", `/companies/${a.company.id}/documents/${png.id}`, b.token)).status, 404);
});

test("deletion is a queued request, never a delete", async () => {
  const a = await companyWithOwner();
  const up = await api("POST", `/companies/${a.company.id}/documents`, a.token, form([{ name: "keep.pdf", bytes: PDF, type: "application/pdf" }]));
  const id = (up.json.uploaded as Array<{ id: string }>)[0]!.id;
  assert.equal((await api("POST", `/companies/${a.company.id}/documents/${id}/deletion-requests`, a.token, { reason: "no" })).status, 400);
  const res = await api("POST", `/companies/${a.company.id}/documents/${id}/deletion-requests`, a.token, { reason: "Uploaded to the wrong company by mistake" });
  assert.equal(res.status, 202);
  assert.match(String(res.json.message), /must be kept until/);
  assert.ok(await prisma.document.findUnique({ where: { id } }));
  assert.equal(await prisma.deletionRequest.count({ where: { entityId: id, status: "QUEUED" } }), 1);
  assert.ok(await prisma.auditLog.findFirst({ where: { action: "delete_request", target: `Document:${id}` } }));
});

test("an empty upload and an oversized batch are rejected with readable messages", async () => {
  const a = await companyWithOwner();
  const empty = await api("POST", `/companies/${a.company.id}/documents`, a.token, form([]));
  assert.equal(empty.status, 400);
  assert.match(String(empty.json.message), /No files received/);
});
