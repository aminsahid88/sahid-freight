import { test } from "node:test";
import assert from "node:assert/strict";
import { backoffMs, counts, createItem, markDone, markRejected, markRetry, markUploading, MAX_ATTEMPTS, prune, retryNow, runnable } from "./queue-logic";

const base = (id: string, createdAt: string) => createItem({ id, companyId: "c", localUri: `file:///q/${id}.jpg`, name: `${id}.jpg`, mimeType: "image/jpeg", bytes: 1000, vehicleId: null, createdAt });

test("new items are pending and run oldest first", () => {
  const items = [base("b", "2026-11-04T10:00:01Z"), base("a", "2026-11-04T10:00:00Z")];
  assert.deepEqual(runnable(items).map((i) => i.id), ["a", "b"]);
  assert.deepEqual(counts(items), { pending: 2, uploading: 0, done: 0, rejected: 0 });
});

test("a network failure keeps the item pending with growing backoff; a server rejection is terminal", () => {
  const now = new Date("2026-11-04T10:00:00Z");
  let items = markUploading([base("a", "2026-11-04T09:00:00Z")], "a");
  assert.equal(items[0]!.attempts, 1);
  items = markRetry(items, "a", "offline", now);
  assert.equal(items[0]!.status, "pending");
  assert.equal(items[0]!.nextAttemptAt, new Date(now.getTime() + 5_000).toISOString());
  assert.deepEqual(runnable(items, now), [], "not before the backoff");
  assert.equal(runnable(items, new Date(now.getTime() + 6_000)).length, 1);
  items = markUploading(items, "a");
  items = markRetry(items, "a", "offline", now);
  assert.equal(items[0]!.nextAttemptAt, new Date(now.getTime() + 10_000).toISOString());
  assert.equal(backoffMs(20), 10 * 60_000, "capped at ten minutes");

  const rejected = markRejected(items, "a", "content_mismatch");
  assert.equal(rejected[0]!.status, "rejected");
  assert.equal(runnable(rejected, new Date("2030-01-01")).length, 0);
  const retried = retryNow(rejected, "a");
  assert.equal(retried[0]!.status, "pending");
  assert.equal(retried[0]!.attempts, 2, "manual retry keeps the count");
});

test("attempts are capped", () => {
  let items = [{ ...base("a", "2026-11-04T09:00:00Z"), attempts: MAX_ATTEMPTS }];
  items = markRetry(items, "a", "offline");
  assert.equal(items[0]!.status, "rejected");
});

test("done items record the server id and are pruned after a week", () => {
  const items = markDone([base("a", "2026-10-01T00:00:00Z"), base("b", "2026-11-03T00:00:00Z")], "a", "doc-1");
  assert.equal(items[0]!.documentId, "doc-1");
  const { keep, dropped } = prune(markDone(items, "b", "doc-2"), new Date("2026-11-04T00:00:00Z"));
  assert.deepEqual(dropped.map((i) => i.id), ["a"]);
  assert.deepEqual(keep.map((i) => i.id), ["b"]);
});
