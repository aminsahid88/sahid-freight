import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { keepAlive } from "./utils/keepalive";
import path from "path";
import { createServer } from "http";
import { Server } from "socket.io";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import loadRoutes from "./routes/load.routes";
import bookingRoutes from "./routes/booking.routes";
import truckRoutes from "./routes/truck.routes";
import trackingRoutes from "./routes/tracking.routes";
import notificationRoutes from "./routes/notification.routes";
import uploadRoutes from "./routes/upload.routes";
import adminRoutes from "./routes/admin.routes";
import driverRoutes from "./routes/driver.routes";
import bidRoutes from "./routes/bid.routes";
import messageRoutes from "./routes/message.routes";
import paymentRoutes from "./routes/payment.routes";
import prisma from "./utils/prisma";
import { setIO } from "./utils/socket";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// ── CORS allowlist (comma-separated ALLOWED_ORIGINS env var) ──
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOriginCheck: cors.CorsOptions["origin"] = (origin, callback) => {
  // Allow same-origin / curl / server-to-server (no Origin header)
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error(`Origin ${origin} not allowed by CORS`));
};

const app = express();
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins.length > 0 ? allowedOrigins : false,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const PORT = process.env.PORT || 8000;
const JWT_SECRET = process.env.JWT_SECRET!;

app.use(helmet());
app.use(cors({ origin: corsOriginCheck, credentials: true }));
// Capture raw body for webhook signature verification (Chapa)
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// ── Rate limiting ──
// Looser global limit
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again shortly." },
});
// Strict limit for credential endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many auth attempts, please try again later." },
});
app.use(globalLimiter);
app.use("/auth/login", authLimiter);
app.use("/auth/register", authLimiter);
app.use("/auth/reset-password", authLimiter);
app.use("/auth/forgot-password", authLimiter);
app.use("/admin/auth/login", authLimiter);

// ── ROUTES ──────────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Public stats (no auth)
app.get("/stats/public", async (_req, res) => {
  try {
    const [totalLoads, totalTrucks] = await Promise.all([
      prisma.load.count(),
      prisma.truck.count(),
    ]);
    res.json({ totalLoads, totalTrucks, countries: 3 });
  } catch {
    res.json({ totalLoads: 0, totalTrucks: 0, countries: 3 });
  }
});
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/loads", loadRoutes);
app.use("/bookings", bookingRoutes);
app.use("/trucks", truckRoutes);
app.use("/tracking", trackingRoutes);
app.use("/notifications", notificationRoutes);
app.use("/uploads", uploadRoutes);
app.use("/admin", adminRoutes);
app.use("/drivers", driverRoutes);
app.use("/bids", bidRoutes);
app.use("/messages", messageRoutes);
app.use("/payments", paymentRoutes);

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Sahid Freight API is running", version: "1.0.0" });
});

setIO(io);

// ── SOCKET.IO AUTH ───────────────────────
// Require a valid JWT at handshake. Clients pass it as:
//   io(url, { auth: { token } })           ← preferred
// or as an Authorization header on the handshake request.
io.use((socket, next) => {
  try {
    const raw =
      (socket.handshake.auth && (socket.handshake.auth as any).token) ||
      (socket.handshake.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!raw) return next(new Error("unauthorized: missing token"));
    const payload = jwt.verify(raw, JWT_SECRET) as { userId: string; role: string };
    (socket as any).user = payload;
    next();
  } catch {
    next(new Error("unauthorized: invalid token"));
  }
});

// Returns true iff the authenticated user may participate in the booking's tracking room.
async function canAccessBooking(userId: string, role: string, bookingId: string): Promise<boolean> {
  if (!bookingId) return false;
  if (role === "ADMIN") return true;
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { senderId: true, ownerId: true, driverId: true },
  });
  if (!b) return false;
  return b.senderId === userId || b.ownerId === userId || b.driverId === userId;
}

// Only the owner or driver of a booking may broadcast updates.
async function canBroadcastForBooking(userId: string, role: string, bookingId: string): Promise<boolean> {
  if (!bookingId) return false;
  if (role === "ADMIN") return true;
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { ownerId: true, driverId: true },
  });
  if (!b) return false;
  return b.ownerId === userId || b.driverId === userId;
}

// ── SOCKET.IO ───────────────────────────
io.on("connection", (socket) => {
  const { userId, role } = (socket as any).user as { userId: string; role: string };
  console.log("Socket connected:", socket.id, "user:", userId);

  // Anyone party to the booking may listen.
  socket.on("join_tracking", async (bookingId: string) => {
    const ok = await canAccessBooking(userId, role, bookingId);
    if (!ok) {
      socket.emit("tracking_error", { message: "Not authorized for this booking" });
      return;
    }
    socket.join(`tracking_${bookingId}`);
    console.log(`Socket ${socket.id} joined tracking_${bookingId}`);
  });

  // Only the owner/driver of the booking may broadcast location.
  socket.on("location_update", async (data: { bookingId: string; lat: number; lng: number; speed?: number }) => {
    const ok = await canBroadcastForBooking(userId, role, data?.bookingId);
    if (!ok) {
      socket.emit("tracking_error", { message: "Not authorized to broadcast for this booking" });
      return;
    }
    io.to(`tracking_${data.bookingId}`).emit("location_updated", {
      lat: data.lat,
      lng: data.lng,
      speed: data.speed || 0,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("stop_tracking", async (bookingId: string) => {
    const ok = await canBroadcastForBooking(userId, role, bookingId);
    if (!ok) return;
    io.to(`tracking_${bookingId}`).emit("tracking_stopped");
  });

  socket.on("journey_started_broadcast", async ({ bookingId }: { bookingId: string }) => {
    const ok = await canBroadcastForBooking(userId, role, bookingId);
    if (!ok) return;
    io.to(`tracking_${bookingId}`).emit("journey_started");
  });

  socket.on("delivered_broadcast", async ({ bookingId }: { bookingId: string }) => {
    const ok = await canBroadcastForBooking(userId, role, bookingId);
    if (!ok) return;
    io.to(`tracking_${bookingId}`).emit("delivered");
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

httpServer.listen(Number(PORT), "0.0.0.0", () => {
  console.log(`✅ Sahid Freight API running on port ${PORT}`);
  keepAlive();
});

export default app;
