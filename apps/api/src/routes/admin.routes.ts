import { Router } from "express";
import {
  getStats, getAllUsers, getUser,
  approveVerification, rejectVerification,
  suspendUser, getAllLoads, getAllBookings,
  verifyTruck, getAllTrucks
} from "../controllers/admin.controller";
import { protect, adminOnly } from "../middleware/auth.middleware";

const router = Router();

router.get("/stats", protect, adminOnly, getStats);
router.get("/users", protect, adminOnly, getAllUsers);
router.get("/users/:id", protect, adminOnly, getUser);
router.patch("/users/:id/approve", protect, adminOnly, approveVerification);
router.patch("/users/:id/reject", protect, adminOnly, rejectVerification);
router.patch("/users/:id/suspend", protect, adminOnly, suspendUser);
router.get("/loads", protect, adminOnly, getAllLoads);
router.get("/bookings", protect, adminOnly, getAllBookings);
router.get("/trucks", protect, adminOnly, getAllTrucks);
router.patch("/trucks/:id/verify", protect, adminOnly, verifyTruck);

export default router;
