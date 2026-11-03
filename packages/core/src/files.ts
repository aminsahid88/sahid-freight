/**
 * Upload validation helpers: content hashing, magic-byte MIME sniffing and
 * filename sanitising. The client-declared MIME type is never trusted on its own.
 */
import { createHash } from "node:crypto";

export function sha256Hex(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export type UploadMime =
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "image/heic"
  | "image/tiff"
  | "text/csv"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const ACCEPTED_MIMES: readonly UploadMime[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/tiff",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export const MIME_EXTENSIONS: Record<UploadMime, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "image/tiff": "tif",
  "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

/** Aliases browsers and phones send that map onto our canonical list. */
const MIME_ALIASES: Record<string, UploadMime> = {
  "image/jpg": "image/jpeg",
  "image/heif": "image/heic",
  "image/tif": "image/tiff",
  "application/csv": "text/csv",
  "text/comma-separated-values": "text/csv",
  "application/x-pdf": "application/pdf",
};

export function canonicalMime(declared: string | undefined | null): UploadMime | null {
  if (!declared) return null;
  const base = declared.split(";")[0]!.trim().toLowerCase();
  if ((ACCEPTED_MIMES as readonly string[]).includes(base)) return base as UploadMime;
  return MIME_ALIASES[base] ?? null;
}

function startsWith(buf: Uint8Array, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

function ascii(buf: Uint8Array, start: number, end: number): string {
  return Array.from(buf.subarray(start, end), (b) => String.fromCharCode(b)).join("");
}

/**
 * Sniff a binary type from magic bytes. Returns null for text-like or unknown
 * content; CSV cannot be sniffed and is accepted only when declared and
 * plausibly text (see validateUploadContent).
 */
export function sniffBinaryMime(buf: Uint8Array): Exclude<UploadMime, "text/csv"> | "application/zip" | null {
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(buf, [0x49, 0x49, 0x2a, 0x00]) || startsWith(buf, [0x4d, 0x4d, 0x00, 0x2a])) return "image/tiff";
  if (buf.length >= 12 && ascii(buf, 4, 8) === "ftyp") {
    const brand = ascii(buf, 8, 12);
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1", "heim", "heis"].includes(brand)) return "image/heic";
  }
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) return "application/zip"; // xlsx is a zip container
  return null;
}

/** Cheap text plausibility check for CSV: no NUL bytes in the first 8KB, mostly printable. */
export function looksLikeText(buf: Uint8Array): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 8192));
  if (sample.length === 0) return false;
  let control = 0;
  for (const b of sample) {
    if (b === 0) return false;
    if (b < 0x09 || (b > 0x0d && b < 0x20)) control++;
  }
  return control / sample.length < 0.01;
}

export type UploadValidation =
  | { ok: true; mime: UploadMime; extension: string }
  | { ok: false; reason: "unsupported_type" | "content_mismatch" | "empty" };

/**
 * Validate an upload: the declared type must be on the allowlist and the bytes
 * must agree with it. A mismatch (e.g. an .exe renamed to .pdf) is rejected.
 */
export function validateUploadContent(declaredMime: string | undefined | null, buf: Uint8Array): UploadValidation {
  if (buf.length === 0) return { ok: false, reason: "empty" };
  const sniffed = sniffBinaryMime(buf);
  const declared = canonicalMime(declaredMime);

  // Binary types: trust the bytes; the declaration only has to be absent or consistent.
  if (sniffed && sniffed !== "application/zip") {
    if (declared && declared !== sniffed) return { ok: false, reason: "content_mismatch" };
    return { ok: true, mime: sniffed, extension: MIME_EXTENSIONS[sniffed] };
  }
  if (sniffed === "application/zip") {
    const xlsx: UploadMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (declared === xlsx) return { ok: true, mime: xlsx, extension: "xlsx" };
    return { ok: false, reason: declared ? "content_mismatch" : "unsupported_type" };
  }
  if (declared === "text/csv" && looksLikeText(buf)) {
    return { ok: true, mime: "text/csv", extension: "csv" };
  }
  if (!declared) return { ok: false, reason: "unsupported_type" };
  return { ok: false, reason: "content_mismatch" };
}

/**
 * Make a filename safe for storage keys and ZIP entries: strip directories,
 * collapse anything outside [A-Za-z0-9._-], cap the length, keep the extension.
 */
export function sanitizeFilename(original: string, fallback = "upload"): string {
  const base = original.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  const stem = (dot > 0 ? base.slice(0, dot) : base).replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[._]+|[._]+$/g, "");
  const ext = (dot > 0 ? base.slice(dot + 1) : "").replace(/[^A-Za-z0-9]+/g, "").toLowerCase().slice(0, 8);
  const safeStem = (stem || fallback).slice(0, 80);
  return ext ? `${safeStem}.${ext}` : safeStem;
}
