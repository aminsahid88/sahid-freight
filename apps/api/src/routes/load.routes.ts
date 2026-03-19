import { Router } from "express";
import { createLoad, getLoads, getLoad, getMyLoads, cancelLoad } from "../controllers/load.controller";
import { protect, cargoSenderOnly } from "../middleware/auth.middleware";

const router = Router();

router.get("/", protect, getLoads);
router.get("/my", protect, cargoSenderOnly, getMyLoads);
router.get("/:id", protect, getLoad);
router.post("/", protect, cargoSenderOnly, createLoad);
router.patch("/:id/cancel", protect, cargoSenderOnly, cancelLoad);

export default router;
