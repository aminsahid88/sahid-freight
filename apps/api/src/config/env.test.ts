import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedOrigins, EnvError, loadEnv, resolveStorageDriver } from "./env";

const base = {
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  JWT_SECRET: "x".repeat(40),
  JWT_REFRESH_SECRET: "y".repeat(40),
};

test("loadEnv applies defaults", () => {
  const env = loadEnv(base);
  assert.equal(env.NODE_ENV, "development");
  assert.equal(env.PORT, 8000);
  assert.equal(env.RETENTION_YEARS, 4);
  assert.equal(env.MPG_BAND_MIN, "4.0");
  assert.equal(env.EXTRACTION_MODEL_A, "claude-opus-5-5");
  assert.equal(env.EXTRACTION_MODEL_B, "claude-sonnet-5-5");
  assert.equal(env.MAX_UPLOAD_MB, 25);
});

test("loadEnv reports every problem at once with the variable name", () => {
  assert.throws(
    () => loadEnv({ DATABASE_URL: "mysql://x", JWT_SECRET: "", PORT: "abc" }),
    (err: unknown) => {
      assert.ok(err instanceof EnvError);
      const text = err.problems.join("\n");
      assert.match(text, /DATABASE_URL: must be a postgresql:\/\/ URL/);
      assert.match(text, /JWT_SECRET: JWT_SECRET is required/);
      assert.match(text, /JWT_REFRESH_SECRET/);
      assert.match(text, /PORT/);
      return true;
    },
  );
});

test("retention cannot be set below the legal 4 years", () => {
  assert.throws(() => loadEnv({ ...base, RETENTION_YEARS: "2" }), /IFTA requires at least 4 years/);
});

test("MPG band must be plain decimals", () => {
  assert.throws(() => loadEnv({ ...base, MPG_BAND_MAX: "nine" }), /plain decimal/);
});

test("empty optional strings become undefined", () => {
  const env = loadEnv({ ...base, RESEND_API_KEY: "", ANTHROPIC_API_KEY: "   " });
  assert.equal(env.RESEND_API_KEY, undefined);
  assert.equal(env.ANTHROPIC_API_KEY, undefined);
});

test("allowedOrigins trims and drops blanks", () => {
  const env = loadEnv({ ...base, ALLOWED_ORIGINS: " http://a.test , ,http://b.test" });
  assert.deepEqual(allowedOrigins(env), ["http://a.test", "http://b.test"]);
});

test("resolveStorageDriver prefers explicit, then S3 config, then local", () => {
  assert.equal(resolveStorageDriver(loadEnv(base)), "local");
  assert.equal(resolveStorageDriver(loadEnv({ ...base, AWS_S3_BUCKET: "b" })), "s3");
  assert.equal(resolveStorageDriver(loadEnv({ ...base, BACKOFFICE_S3_BUCKET: "b" })), "s3");
  assert.equal(resolveStorageDriver(loadEnv({ ...base, AWS_S3_BUCKET: "b", STORAGE_DRIVER: "local" })), "local");
});
