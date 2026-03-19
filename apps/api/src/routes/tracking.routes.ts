import { Router } from "express";
import { sendLocation, getLatestLocation, getLocationHistory } from "../controllers/tracking.controller";
import { protect, truckOwnerOnly } from "../middleware/auth.middleware";

const router = Router();

router.post("/:truckId", protect, truckOwnerOnly, sendLocation);
router.get("/:truckId/latest", protect, getLatestLocation);
router.get("/:truckId/history", protect, getLocationHistory);

export default router;
