import { Router } from "express";
import { addTruck, getMyTrucks, getAvailableTrucks, updateTruck } from "../controllers/truck.controller";
import { protect, truckOwnerOnly } from "../middleware/auth.middleware";

const router = Router();

router.post("/", protect, truckOwnerOnly, addTruck);
router.get("/my", protect, truckOwnerOnly, getMyTrucks);
router.get("/", protect, getAvailableTrucks);
router.patch("/:id", protect, truckOwnerOnly, updateTruck);

export default router;
