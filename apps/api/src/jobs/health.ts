/**
 * Minimal liveness endpoint for the standalone worker. Railway's healthcheck
 * hits GET /health; everything else is 404. No framework, no routes, no auth.
 */
import { createServer, type Server } from "http";

export interface HealthState {
  startedAt: Date;
  lastPollAt: Date | null;
}

export function startHealthServer(port: number, state: HealthState, host = "0.0.0.0"): Server {
  const server = createServer((req, res) => {
    if (req.method === "GET" && (req.url === "/health" || req.url === "/")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok", role: "worker", startedAt: state.startedAt.toISOString(), lastPollAt: state.lastPollAt?.toISOString() ?? null }));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
  });
  server.listen(port, host);
  return server;
}
