import { Router } from "express";
import {
  getStats, getAllUsers, getUser,
  approveVerification, rejectVerification,
  suspendUser, getAllLoads, getLoad as adminGetLoad, cancelLoad as adminCancelLoad,
  getAllBookings, getBooking as adminGetBooking,
  verifyTruck, getAllTrucks, getTruck as adminGetTruck,
  banUser, unbanUser,
  getAllDocuments, getDocument, approveDocument, rejectDocument,
} from "../controllers/admin.controller";
import { adminLogin } from "../controllers/auth.controller";
import { protect, adminOnly } from "../middleware/auth.middleware";

const router = Router();

// Admin auth (no protect — this IS the login)
router.post("/auth/login", adminLogin);

// Dashboard
router.get("/stats", protect, adminOnly, getStats);

// Users
router.get("/users", protect, adminOnly, getAllUsers);
router.get("/users/:id", protect, adminOnly, getUser);
router.patch("/users/:id/approve", protect, adminOnly, approveVerification);
router.patch("/users/:id/reject", protect, adminOnly, rejectVerification);
router.patch("/users/:id/suspend", protect, adminOnly, suspendUser);
router.post("/users/:id/ban", protect, adminOnly, banUser);
router.post("/users/:id/unban", protect, adminOnly, unbanUser);

// Loads
router.get("/loads", protect, adminOnly, getAllLoads);
router.get("/loads/:id", protect, adminOnly, adminGetLoad);
router.post("/loads/:id/cancel", protect, adminOnly, adminCancelLoad);

// Bookings
router.get("/bookings", protect, adminOnly, getAllBookings);
router.get("/bookings/:id", protect, adminOnly, adminGetBooking);

// Trucks
router.get("/trucks", protect, adminOnly, getAllTrucks);
router.get("/trucks/:id", protect, adminOnly, adminGetTruck);
router.patch("/trucks/:id/verify", protect, adminOnly, verifyTruck);

// Documents
router.get("/documents", protect, adminOnly, getAllDocuments);
router.get("/documents/:id", protect, adminOnly, getDocument);
router.post("/documents/:id/approve", protect, adminOnly, approveDocument);
router.post("/documents/:id/reject", protect, adminOnly, rejectDocument);

export default router;
