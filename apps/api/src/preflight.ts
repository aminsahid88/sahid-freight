/**
 * Startup preflight: verify every credential the service needs and fail with a
 * readable table instead of a stack trace minutes later. In production any
 * `fail` aborts boot; in development failures are printed and boot continues
 * so a laptop without S3 or an AI key can still run the inbox.
 */
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { allowedOrigins, type Env, resolveStorageDriver } from "./config/env";
import type { Storage } from "./storage";

export type CheckStatus = "ok" | "warn" | "fail";
export interface CheckResult {
  name: string;
  status: CheckStatus;
  detail: string;
}

export interface PreflightDeps {
  env: Env;
  prisma: Pick<PrismaClient, "$queryRaw">;
  storage: Storage;
  /** Verifies model IDs against the provider. Returns the IDs that do not exist. */
  verifyModels?: (apiKey: string, ids: string[]) => Promise<{ missing: string[] }>;
}

/**
 * Default model verifier: GET /v1/models/{id}. Phase 1 replaces this with the
 * Anthropic SDK (`client.models.retrieve`) once the package can be installed.
 */
export async function verifyAnthropicModels(apiKey: string, ids: string[]): Promise<{ missing: string[] }> {
  const missing: string[] = [];
  for (const id of ids) {
    const res = await fetch(`https://api.anthropic.com/v1/models/${encodeURIComponent(id)}`, {
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    });
    if (res.status === 404) missing.push(id);
    else if (!res.ok) throw new Error(`Anthropic API answered ${res.status} for ${id}`);
  }
  return { missing };
}

export async function runPreflight(deps: PreflightDeps): Promise<{ results: CheckResult[]; ok: boolean }> {
  const { env, prisma, storage } = deps;
  const prod = env.NODE_ENV === "production";
  const results: CheckResult[] = [];
  const push = (name: string, status: CheckStatus, detail: string) => results.push({ name, status, detail });

  // Database
  try {
    await prisma.$queryRaw`SELECT 1`;
    push("database", "ok", "connected");
  } catch (err) {
    push("database", "fail", `cannot connect: ${(err as Error).message.split("\n")[0]}`);
  }

  // Secrets
  for (const name of ["JWT_SECRET", "JWT_REFRESH_SECRET"] as const) {
    const v = env[name];
    if (v.length < 32) push(name, prod ? "fail" : "warn", `only ${v.length} chars; use at least 32 random characters`);
    else push(name, "ok", `${v.length} chars`);
  }
  if (env.JWT_SECRET === env.JWT_REFRESH_SECRET) push("jwt secrets", prod ? "fail" : "warn", "access and refresh secrets are identical");

  // CORS
  const origins = allowedOrigins(env);
  if (origins.length === 0) push("ALLOWED_ORIGINS", prod ? "fail" : "warn", "empty: every browser origin will be rejected");
  else push("ALLOWED_ORIGINS", "ok", origins.join(", "));

  // Storage
  const driver = resolveStorageDriver(env);
  if (driver === "local" && prod) {
    push("storage", "fail", "local disk driver in production; set BACKOFFICE_S3_BUCKET");
  } else {
    const key = `preflight/${randomUUID()}.txt`;
    try {
      await storage.put(key, Buffer.from("preflight"), "text/plain");
      const back = await storage.get(key);
      await storage.delete(key);
      if (back.toString() !== "preflight") throw new Error("read back different bytes");
      push("storage", driver === "local" ? "warn" : "ok", `${driver}: ${storage.location} (write/read/delete ok)`);
    } catch (err) {
      push("storage", "fail", `${driver}: ${storage.location}: ${(err as Error).message.split("\n")[0]}`);
    }
  }

  // Email
  if (!env.RESEND_API_KEY) push("email (Resend)", prod ? "fail" : "warn", "RESEND_API_KEY unset: OTP and notification emails disabled");
  else if (!env.RESEND_API_KEY.startsWith("re_")) push("email (Resend)", "fail", "RESEND_API_KEY does not look like a Resend key");
  else push("email (Resend)", "ok", "key present");

  // AI extraction (Phase 1 feature; verified only when a key exists)
  const ids = [env.EXTRACTION_MODEL_A, env.EXTRACTION_MODEL_B];
  if (!env.ANTHROPIC_API_KEY) {
    push("ai (Anthropic)", "warn", `ANTHROPIC_API_KEY unset: extraction disabled. Configured models: ${ids.join(", ")}`);
  } else if (env.EXTRACTION_MODEL_A === env.EXTRACTION_MODEL_B) {
    push("ai (Anthropic)", "fail", "EXTRACTION_MODEL_A and EXTRACTION_MODEL_B must differ (independent second pass)");
  } else {
    try {
      const { missing } = await (deps.verifyModels ?? verifyAnthropicModels)(env.ANTHROPIC_API_KEY, ids);
      if (missing.length) push("ai (Anthropic)", "fail", `unknown model id(s): ${missing.join(", ")} — check the current model list, never guess`);
      else push("ai (Anthropic)", "ok", `models verified: ${ids.join(", ")}`);
    } catch (err) {
      push("ai (Anthropic)", prod ? "fail" : "warn", `could not verify models: ${(err as Error).message}`);
    }
  }

  return { results, ok: !results.some((r) => r.status === "fail") };
}

export function formatPreflight(results: CheckResult[]): string {
  const width = Math.max(...results.map((r) => r.name.length));
  const mark: Record<CheckStatus, string> = { ok: "OK  ", warn: "WARN", fail: "FAIL" };
  return results.map((r) => `  ${mark[r.status]}  ${r.name.padEnd(width)}  ${r.detail}`).join("\n");
}

/** Boot helper: print the table; in production exit on failure. */
export async function preflightOrExit(deps: PreflightDeps): Promise<void> {
  const { results, ok } = await runPreflight(deps);
  console.log(`Preflight (${deps.env.NODE_ENV}):\n${formatPreflight(results)}`);
  if (!ok && deps.env.NODE_ENV === "production") {
    console.error("Preflight failed; refusing to start. Fix the FAIL rows above.");
    process.exit(1);
  }
}
