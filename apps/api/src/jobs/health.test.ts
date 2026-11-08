import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "net";
import { startHealthServer } from "./health";

test("worker health server answers /health and nothing else", async () => {
  const state = { startedAt: new Date("2026-11-08T00:00:00Z"), lastPollAt: null as Date | null };
  const server = startHealthServer(0, state, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", () => r()));
  const { port } = server.address() as AddressInfo;
  try {
    const ok = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as { status: string; role: string; lastPollAt: string | null };
    assert.equal(body.status, "ok");
    assert.equal(body.role, "worker");
    assert.equal(body.lastPollAt, null);
    state.lastPollAt = new Date("2026-11-08T00:00:05Z");
    const again = (await (await fetch(`http://127.0.0.1:${port}/health`)).json()) as { lastPollAt: string };
    assert.equal(again.lastPollAt, "2026-11-08T00:00:05.000Z");
    const nope = await fetch(`http://127.0.0.1:${port}/jobs`);
    assert.equal(nope.status, 404);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
