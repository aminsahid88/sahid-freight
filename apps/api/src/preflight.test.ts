import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadEnv } from "./config/env";
import { formatPreflight, runPreflight } from "./preflight";
import { LocalStorage } from "./storage";

const dir = mkdtempSync(path.join(os.tmpdir(), "tbo-preflight-"));
test.after(() => rmSync(dir, { recursive: true, force: true }));

const okDb = { $queryRaw: async () => [{ "?column?": 1 }] } as never;
const badDb = {
  $queryRaw: async () => {
    throw new Error("connect ECONNREFUSED 127.0.0.1:5432\nmore");
  },
} as never;
const storage = new LocalStorage({ dir, secret: "s", baseUrl: "http://localhost:8000" });

const base = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  JWT_SECRET: "a".repeat(48),
  JWT_REFRESH_SECRET: "b".repeat(48),
  ALLOWED_ORIGINS: "http://localhost:3000",
  RESEND_API_KEY: "re_123",
};

function byName(results: { name: string; status: string; detail: string }[], name: string) {
  const r = results.find((x) => x.name === name);
  assert.ok(r, `missing check ${name}`);
  return r;
}

test("a healthy dev environment passes with warnings only for optional services", async () => {
  const { results, ok } = await runPreflight({ env: loadEnv(base), prisma: okDb, storage });
  assert.equal(ok, true);
  assert.equal(byName(results, "database").status, "ok");
  assert.equal(byName(results, "storage").status, "warn"); // local driver
  assert.equal(byName(results, "email (Resend)").status, "ok");
  assert.equal(byName(results, "ai (Anthropic)").status, "warn");
  assert.match(byName(results, "ai (Anthropic)").detail, /claude-opus-5-5, claude-sonnet-5-5/);
});

test("database failure is reported with the first line of the error", async () => {
  const { results, ok } = await runPreflight({ env: loadEnv(base), prisma: badDb, storage });
  assert.equal(ok, false);
  assert.equal(byName(results, "database").status, "fail");
  assert.match(byName(results, "database").detail, /ECONNREFUSED/);
  assert.doesNotMatch(byName(results, "database").detail, /more/);
});

test("production is strict: short secrets, empty CORS, missing email and local storage all fail", async () => {
  const env = loadEnv({ ...base, NODE_ENV: "production", JWT_SECRET: "short", ALLOWED_ORIGINS: "", RESEND_API_KEY: "" });
  const { results, ok } = await runPreflight({ env, prisma: okDb, storage });
  assert.equal(ok, false);
  assert.equal(byName(results, "JWT_SECRET").status, "fail");
  assert.equal(byName(results, "ALLOWED_ORIGINS").status, "fail");
  assert.equal(byName(results, "email (Resend)").status, "fail");
  assert.equal(byName(results, "storage").status, "fail");
});

test("model ids are verified against the provider when a key is present", async () => {
  const env = loadEnv({ ...base, ANTHROPIC_API_KEY: "sk-ant-test" });
  const seen: string[] = [];
  const good = await runPreflight({
    env,
    prisma: okDb,
    storage,
    verifyModels: async (_key, ids) => {
      seen.push(...ids);
      return { missing: [] };
    },
  });
  assert.deepEqual(seen, ["claude-opus-5-5", "claude-sonnet-5-5"]);
  assert.equal(byName(good.results, "ai (Anthropic)").status, "ok");

  const bad = await runPreflight({
    env: loadEnv({ ...base, ANTHROPIC_API_KEY: "sk-ant-test", EXTRACTION_MODEL_B: "claude-made-up-9" }),
    prisma: okDb,
    storage,
    verifyModels: async () => ({ missing: ["claude-made-up-9"] }),
  });
  assert.equal(bad.ok, false);
  assert.match(byName(bad.results, "ai (Anthropic)").detail, /claude-made-up-9/);
});

test("identical extraction models are rejected", async () => {
  const env = loadEnv({ ...base, ANTHROPIC_API_KEY: "sk-ant-test", EXTRACTION_MODEL_B: "claude-opus-5-5" });
  const { results } = await runPreflight({ env, prisma: okDb, storage, verifyModels: async () => ({ missing: [] }) });
  assert.equal(byName(results, "ai (Anthropic)").status, "fail");
});

test("formatPreflight renders an aligned table", async () => {
  const { results } = await runPreflight({ env: loadEnv(base), prisma: okDb, storage });
  const text = formatPreflight(results);
  assert.match(text, /OK {4}database/);
  assert.match(text, /WARN {2}storage/);
});

test("isMountedDir: true only for a path under a listed mount point", async () => {
  const { isMountedDir } = await import("./preflight");
  const { writeFileSync, mkdtempSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const f = join(mkdtempSync(join(tmpdir(), "mounts-")), "mounts");
  writeFileSync(f, "overlay / overlay rw 0 0\n/dev/sdb /data ext4 rw 0 0\n");
  assert.equal(isMountedDir("/data/documents", f), true);
  assert.equal(isMountedDir("/data", f), true);
  assert.equal(isMountedDir("/app/.storage", f), false);
  assert.equal(isMountedDir("/data/documents", "/nonexistent/mounts"), false);
});
