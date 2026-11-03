/**
 * Object storage behind one small interface. Originals are written once and
 * never modified; reads go through short-lived signed URLs (no public buckets).
 *
 * Drivers:
 *  - s3:    AWS S3 or any S3-compatible endpoint (Cloudflare R2, MinIO).
 *  - local: files under LOCAL_STORAGE_DIR with HMAC-signed URLs served by the
 *           API (`GET /files`). For development and tests only.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl as s3SignedUrl } from "@aws-sdk/s3-request-presigner";
import { type Env, resolveStorageDriver } from "../config/env";

export interface Storage {
  readonly driver: "s3" | "local";
  readonly location: string;
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** A URL that grants read access to `key` for `ttlSeconds`. */
  getSignedUrl(key: string, ttlSeconds: number): Promise<string>;
}

export class StorageKeyError extends Error {
  constructor(key: string) {
    super(`Invalid storage key: ${JSON.stringify(key)}`);
    this.name = "StorageKeyError";
  }
}

/** Keys are relative, slash-separated, and contain no traversal or control characters. */
export function assertSafeKey(key: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._\-/]{0,511}$/.test(key) || key.includes("..") || key.includes("//")) {
    throw new StorageKeyError(key);
  }
}

// ── Local disk ───────────────────────────────────────────────────────────────

export interface LocalStorageOptions {
  dir: string;
  secret: string;
  /** Base URL the signed link points at, e.g. http://localhost:8000 */
  baseUrl: string;
}

export function signLocalUrl(secret: string, key: string, expiresAtSeconds: number): string {
  return createHmac("sha256", secret).update(`${key}\n${expiresAtSeconds}`).digest("hex");
}

export function verifyLocalSignature(
  secret: string,
  key: string,
  expiresAtSeconds: number,
  signature: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!Number.isFinite(expiresAtSeconds) || expiresAtSeconds < nowSeconds) return false;
  const expected = Buffer.from(signLocalUrl(secret, key, expiresAtSeconds));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export class LocalStorage implements Storage {
  readonly driver = "local" as const;
  readonly location: string;
  constructor(private readonly opts: LocalStorageOptions) {
    this.location = path.resolve(opts.dir);
  }

  private resolve(key: string): string {
    assertSafeKey(key);
    const full = path.resolve(this.location, key);
    if (!full.startsWith(this.location + path.sep)) throw new StorageKeyError(key);
    return full;
  }

  async put(key: string, body: Buffer, _contentType: string): Promise<void> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    // 'wx' = create only; originals are immutable.
    await fs.writeFile(full, body, { flag: "wx" });
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }

  async getSignedUrl(key: string, ttlSeconds: number): Promise<string> {
    assertSafeKey(key);
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = signLocalUrl(this.opts.secret, key, exp);
    const url = new URL("/files", this.opts.baseUrl);
    url.searchParams.set("key", key);
    url.searchParams.set("exp", String(exp));
    url.searchParams.set("sig", sig);
    return url.toString();
  }
}

// ── S3 / R2 / MinIO ──────────────────────────────────────────────────────────

export interface S3StorageOptions {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export class S3Storage implements Storage {
  readonly driver = "s3" as const;
  readonly location: string;
  private readonly client: S3Client;
  constructor(private readonly opts: S3StorageOptions) {
    this.location = `${opts.endpoint ?? "s3"}/${opts.bucket} (${opts.region})`;
    this.client = new S3Client({
      region: opts.region,
      ...(opts.endpoint ? { endpoint: opts.endpoint, forcePathStyle: true } : {}),
      ...(opts.accessKeyId && opts.secretAccessKey
        ? { credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey } }
        : {}),
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(new PutObjectCommand({ Bucket: this.opts.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async get(key: string): Promise<Buffer> {
    assertSafeKey(key);
    const out = await this.client.send(new GetObjectCommand({ Bucket: this.opts.bucket, Key: key }));
    const bytes = await out.Body?.transformToByteArray();
    return Buffer.from(bytes ?? new Uint8Array());
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.opts.bucket, Key: key }));
  }

  async getSignedUrl(key: string, ttlSeconds: number): Promise<string> {
    assertSafeKey(key);
    return s3SignedUrl(this.client, new GetObjectCommand({ Bucket: this.opts.bucket, Key: key }), { expiresIn: ttlSeconds });
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createStorage(env: Env): Storage {
  const driver = resolveStorageDriver(env);
  if (driver === "local") {
    return new LocalStorage({
      dir: env.LOCAL_STORAGE_DIR,
      secret: env.JWT_SECRET,
      baseUrl: env.API_URL ?? `http://localhost:${env.PORT}`,
    });
  }
  const bucket = env.BACKOFFICE_S3_BUCKET ?? env.AWS_S3_BUCKET;
  const region = env.BACKOFFICE_S3_REGION ?? env.AWS_REGION ?? "us-east-1";
  if (!bucket) throw new Error("STORAGE_DRIVER=s3 but no BACKOFFICE_S3_BUCKET or AWS_S3_BUCKET is set");
  return new S3Storage({
    bucket,
    region,
    endpoint: env.S3_ENDPOINT,
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  });
}

/** Storage key for an original document. Immutable, one per document id. */
export function documentStorageKey(companyId: string, documentId: string, extension: string): string {
  return `companies/${companyId}/documents/${documentId}/original.${extension}`;
}
