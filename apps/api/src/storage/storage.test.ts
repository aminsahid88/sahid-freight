import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertSafeKey, documentStorageKey, LocalStorage, StorageKeyError, verifyLocalSignature } from "./index";

const dir = mkdtempSync(path.join(os.tmpdir(), "tbo-storage-"));
const storage = new LocalStorage({ dir, secret: "test-secret", baseUrl: "http://localhost:8000" });

test.after(() => rmSync(dir, { recursive: true, force: true }));

test("put/get round-trips bytes and refuses to overwrite an original", async () => {
  const key = documentStorageKey("c1", "d1", "pdf");
  await storage.put(key, Buffer.from("%PDF-1.4 original"), "application/pdf");
  assert.equal((await storage.get(key)).toString(), "%PDF-1.4 original");
  await assert.rejects(storage.put(key, Buffer.from("tampered"), "application/pdf"), /EEXIST/);
  assert.equal((await storage.get(key)).toString(), "%PDF-1.4 original");
});

test("signed URLs verify until they expire and reject tampering", async () => {
  const key = "companies/c1/documents/d2/original.jpg";
  const url = new URL(await storage.getSignedUrl(key, 60));
  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig")!;
  assert.equal(url.pathname, "/files");
  assert.equal(verifyLocalSignature("test-secret", key, exp, sig), true);
  assert.equal(verifyLocalSignature("test-secret", "companies/c2/documents/d2/original.jpg", exp, sig), false, "key swap");
  assert.equal(verifyLocalSignature("test-secret", key, exp + 1, sig), false, "expiry tamper");
  assert.equal(verifyLocalSignature("other-secret", key, exp, sig), false, "wrong secret");
  assert.equal(verifyLocalSignature("test-secret", key, exp, sig, exp + 1), false, "expired");
});

test("keys cannot escape the storage root", async () => {
  for (const bad of ["../x", "a/../../etc/passwd", "/abs", "a//b", "a\u0000b", ""]) {
    assert.throws(() => assertSafeKey(bad), StorageKeyError, bad);
    await assert.rejects(storage.get(bad), StorageKeyError, bad);
  }
  assert.doesNotThrow(() => assertSafeKey("companies/c1/documents/d1/original.pdf"));
});

test("documentStorageKey is deterministic and scoped by company", () => {
  assert.equal(documentStorageKey("c1", "d1", "png"), "companies/c1/documents/d1/original.png");
});
