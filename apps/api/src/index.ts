import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
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

const app = express();
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 8000;

app.use(helmet());
app.use(cors());
app.use(express.json());

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

// ── SOCKET.IO ───────────────────────────
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // Truck owner joins a room for their booking
  socket.on("join_tracking", (bookingId: string) => {
    socket.join(`tracking_${bookingId}`);
    console.log(`Socket ${socket.id} joined tracking_${bookingId}`);
  });

  // Truck owner sends location update
  socket.on("location_update", (data: { bookingId: string; lat: number; lng: number; speed?: number }) => {
    // Broadcast to everyone watching this booking
    io.to(`tracking_${data.bookingId}`).emit("location_updated", {
      lat: data.lat,
      lng: data.lng,
      speed: data.speed || 0,
      timestamp: new Date().toISOString(),
    });
    console.log(`Location update for booking ${data.bookingId}: ${data.lat}, ${data.lng}`);
  });

  // Truck owner stops sharing
  socket.on("stop_tracking", (bookingId: string) => {
    io.to(`tracking_${bookingId}`).emit("tracking_stopped");
  });

  socket.on("journey_started_broadcast", ({ bookingId }: { bookingId: string }) => {
    io.to(`tracking_${bookingId}`).emit("journey_started");
  });

  socket.on("delivered_broadcast", ({ bookingId }: { bookingId: string }) => {
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
