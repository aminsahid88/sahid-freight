import { test } from "node:test";
import assert from "node:assert/strict";
import { canonicalMime, sanitizeFilename, sha256Hex, sniffBinaryMime, validateUploadContent } from "./files";

const PDF = Buffer.from("%PDF-1.4\n%fake\n");
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const TIFF_LE = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0, 0, 0]);
const HEIC = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypheic"), Buffer.alloc(8)]);
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
const CSV = Buffer.from("date,vendor,gallons\n2026-10-02,Love's,120.5\n");
const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);

test("sha256Hex matches a known vector", () => {
  assert.equal(sha256Hex(Buffer.from("abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(sha256Hex(Buffer.alloc(0)), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});

test("sniffBinaryMime recognises the accepted binary formats", () => {
  assert.equal(sniffBinaryMime(PDF), "application/pdf");
  assert.equal(sniffBinaryMime(JPEG), "image/jpeg");
  assert.equal(sniffBinaryMime(PNG), "image/png");
  assert.equal(sniffBinaryMime(TIFF_LE), "image/tiff");
  assert.equal(sniffBinaryMime(HEIC), "image/heic");
  assert.equal(sniffBinaryMime(ZIP), "application/zip");
  assert.equal(sniffBinaryMime(CSV), null);
  assert.equal(sniffBinaryMime(EXE), null);
});

test("canonicalMime normalises aliases and parameters", () => {
  assert.equal(canonicalMime("image/jpg"), "image/jpeg");
  assert.equal(canonicalMime("Image/JPEG; charset=binary"), "image/jpeg");
  assert.equal(canonicalMime("application/csv"), "text/csv");
  assert.equal(canonicalMime("application/octet-stream"), null);
  assert.equal(canonicalMime(undefined), null);
});

test("validateUploadContent accepts consistent uploads", () => {
  assert.deepEqual(validateUploadContent("application/pdf", PDF), { ok: true, mime: "application/pdf", extension: "pdf" });
  assert.deepEqual(validateUploadContent("image/jpg", JPEG), { ok: true, mime: "image/jpeg", extension: "jpg" });
  assert.deepEqual(validateUploadContent(undefined, PNG), { ok: true, mime: "image/png", extension: "png" });
  assert.deepEqual(validateUploadContent("text/csv", CSV), { ok: true, mime: "text/csv", extension: "csv" });
  const xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  assert.deepEqual(validateUploadContent(xlsx, ZIP), { ok: true, mime: xlsx, extension: "xlsx" });
});

test("validateUploadContent rejects renamed, mismatched and unknown files", () => {
  assert.deepEqual(validateUploadContent("application/pdf", EXE), { ok: false, reason: "content_mismatch" });
  assert.deepEqual(validateUploadContent("image/png", JPEG), { ok: false, reason: "content_mismatch" });
  assert.deepEqual(validateUploadContent("application/pdf", Buffer.alloc(0)), { ok: false, reason: "empty" });
  assert.deepEqual(validateUploadContent(undefined, EXE), { ok: false, reason: "unsupported_type" });
  assert.deepEqual(validateUploadContent("application/x-msdownload", EXE), { ok: false, reason: "unsupported_type" });
  // A plain zip without an xlsx declaration is not accepted.
  assert.deepEqual(validateUploadContent(undefined, ZIP), { ok: false, reason: "unsupported_type" });
  // A CSV declaration with binary content is rejected.
  assert.deepEqual(validateUploadContent("text/csv", Buffer.from([0, 1, 2, 3])), { ok: false, reason: "content_mismatch" });
});

test("sanitizeFilename strips paths and unsafe characters but keeps the extension", () => {
  assert.equal(sanitizeFilename("../../etc/passwd"), "passwd");
  assert.equal(sanitizeFilename("C:\\Users\\me\\Receipt (Oct 2).JPG"), "Receipt_Oct_2.jpg");
  assert.equal(sanitizeFilename("fuel receipt.pdf"), "fuel_receipt.pdf");
  assert.equal(sanitizeFilename("....pdf"), "upload.pdf");
  assert.equal(sanitizeFilename(""), "upload");
  assert.equal(sanitizeFilename("x".repeat(200) + ".png").length, 84);
});
