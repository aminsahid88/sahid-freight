import { Router } from "express";
import { addTruck, getMyTrucks, getAvailableTrucks, updateTruck, deleteTruck } from "../controllers/truck.controller";
import { protect, fleetManagerOnly } from "../middleware/auth.middleware";

const router = Router();

router.post("/", protect, fleetManagerOnly, addTruck);
router.get("/my", protect, fleetManagerOnly, getMyTrucks);
router.get("/", protect, getAvailableTrucks);
router.patch("/:id", protect, fleetManagerOnly, updateTruck);
router.delete("/:id", protect, fleetManagerOnly, deleteTruck);

export default router;
