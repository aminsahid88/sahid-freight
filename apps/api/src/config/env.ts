/**
 * Typed environment loading. Every variable the back-office code reads goes
 * through here so a missing or malformed value fails at boot with a readable
 * message instead of a `undefined` deep inside a request.
 *
 * Loading order: variables already in process.env win (dotenv-cli for the
 * *:local scripts, Railway in production); otherwise apps/api/.env is read.
 */
import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const nonEmpty = (name: string) => z.string().trim().min(1, `${name} is required`);
const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v));
const decimalString = (fallback: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/, "must be a plain decimal like 4.0")
    .default(fallback);

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8000),
  DATABASE_URL: nonEmpty("DATABASE_URL").refine((u) => /^postgres(ql)?:\/\//.test(u), "must be a postgresql:// URL"),
  JWT_SECRET: nonEmpty("JWT_SECRET"),
  JWT_REFRESH_SECRET: nonEmpty("JWT_REFRESH_SECRET"),
  ALLOWED_ORIGINS: z.string().default(""),
  /** Public URL of this API (used to build signed URLs for the local storage driver). */
  API_URL: optionalString,

  // ── Object storage ──
  STORAGE_DRIVER: z.enum(["s3", "local"]).optional(),
  BACKOFFICE_S3_BUCKET: optionalString,
  BACKOFFICE_S3_REGION: optionalString,
  S3_ENDPOINT: optionalString, // for Cloudflare R2 / MinIO; leave unset for AWS
  AWS_S3_BUCKET: optionalString,
  AWS_REGION: optionalString,
  AWS_ACCESS_KEY_ID: optionalString,
  AWS_SECRET_ACCESS_KEY: optionalString,
  LOCAL_STORAGE_DIR: z.string().default(".storage"),
  /** "true" states that LOCAL_STORAGE_DIR is a mounted persistent volume (Railway volume); only then may the local driver run in production. */
  STORAGE_LOCAL_PERSISTENT: z
    .string()
    .default("false")
    .transform((v) => v.trim().toLowerCase() === "true"),
  SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  // ── Email ──
  RESEND_API_KEY: optionalString,

  // ── AI extraction (Phase 1); verified model IDs, see docs/12-decisions-log.md ──
  ANTHROPIC_API_KEY: optionalString,
  EXTRACTION_MODEL_A: z.string().default("claude-opus-5-5"),
  EXTRACTION_MODEL_B: z.string().default("claude-sonnet-5-5"),
  EXTRACTION_PROMPT_VERSION_A: z.string().default("a-v1"),
  EXTRACTION_PROMPT_VERSION_B: z.string().default("b-v1"),
  /** Reasoning effort for extraction calls; literal transcription needs little. */
  EXTRACTION_EFFORT: z.enum(["low", "medium", "high"]).default("low"),
  /** Skip pass B entirely (cost control); the transaction is then SINGLE_SOURCE. */
  EXTRACTION_SKIP_PASS_B: z
    .string()
    .default("false")
    .transform((v) => v.trim().toLowerCase() === "true"),
  AI_MONTHLY_BUDGET_USD: z.coerce.number().nonnegative().default(50),

  // ── Business rules ──
  RETENTION_YEARS: z.coerce.number().int().min(4, "IFTA requires at least 4 years").default(4),
  MPG_BAND_MIN: decimalString("4.0"),
  MPG_BAND_MAX: decimalString("9.0"),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().max(100).default(25),
  MAX_FILES_PER_BATCH: z.coerce.number().int().positive().max(100).default(20),
  WORKER_POLL_MS: z.coerce.number().int().min(100).default(2000),
  /** "true" runs the job-queue loop inside the API process (one Railway service). Default off: run `node dist/worker.js` separately. */
  WORKER_IN_PROCESS: z
    .string()
    .default("false")
    .transform((v) => v.trim().toLowerCase() === "true"),

  // ── Legacy marketplace (archived behind a flag; see docs/12-decisions-log.md) ──
  /** "true" keeps the Sahid Freight loads/bookings/payments routes mounted. Defaults on until Amin approves switching it off. */
  LEGACY_MARKETPLACE: z
    .string()
    .default("true")
    .transform((v) => v.trim().toLowerCase() !== "false"),
});

export type Env = z.infer<typeof envSchema>;

export class EnvError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Environment is not usable:\n  - ${problems.join("\n  - ")}`);
    this.name = "EnvError";
  }
}

/** Parse an environment map. Throws EnvError listing every problem at once. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new EnvError(problems);
  }
  return parsed.data;
}

let cached: Env | undefined;

/** Memoised accessor used by application code. */
export function getEnv(): Env {
  if (!cached) cached = loadEnv();
  return cached;
}

/** Test hook: replace the cached env (pass undefined to reset). */
export function setEnvForTests(env: Env | undefined): void {
  cached = env;
}

export function allowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Which storage driver applies: explicit, else S3 when a bucket is configured, else local disk. */
export function resolveStorageDriver(env: Env): "s3" | "local" {
  if (env.STORAGE_DRIVER) return env.STORAGE_DRIVER;
  return env.BACKOFFICE_S3_BUCKET || env.AWS_S3_BUCKET ? "s3" : "local";
}
