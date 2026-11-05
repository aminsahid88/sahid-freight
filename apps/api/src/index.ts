/**
 * API entrypoint — AI Trucking Back-Office Platform (Sahid Freight).
 * The marketplace routes live in apps/api/legacy and are not mounted.
 */
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import notificationRoutes from "./routes/notification.routes";
import prisma from "./utils/prisma";
import { mountBackoffice } from "./backoffice/app";
import { errorHandler } from "./backoffice/errors";
import { allowedOrigins, getEnv } from "./config/env";
import { preflightOrExit } from "./preflight";
import { startWorker } from "./jobs/worker-core";

// Fails at boot with a readable list of problems instead of `undefined` deep in a request.
const env = getEnv();
const origins = allowedOrigins(env);

const app = express();
const httpServer = createServer(app);

// Railway sits behind one proxy hop; needed for correct req.ip and rate-limit keys.
app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Same-origin / curl / server-to-server requests carry no Origin header.
      if (!origin || origins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

// ── Rate limiting ──
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "rate_limited", message: "Too many requests, please try again shortly." },
  }),
);
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited", message: "Too many sign-in attempts, please try again later." },
});
for (const path of ["/auth/login", "/auth/register", "/auth/reset-password", "/auth/request-otp", "/auth/verify-otp"]) {
  app.use(path, authLimiter);
}

// ── Routes ──
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/notifications", notificationRoutes);
const { storage } = mountBackoffice(app, { prisma, env });

app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "Sahid Freight back-office API", version: "2.0.0-phase1" });
});

// Single JSON error handler: multer/validation/tenant errors never leak stack traces.
app.use(errorHandler);

preflightOrExit({ env, prisma, storage }).then(() => {
  httpServer.listen(Number(env.PORT), "0.0.0.0", () => {
    console.log(`API running on port ${env.PORT} (${env.NODE_ENV})`);
  });
  if (env.WORKER_IN_PROCESS) startWorker(prisma, env, storage);
});

export default app;
