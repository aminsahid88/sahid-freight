import { Router } from "express";
import { createLoad, getLoads, getLoad, getMyLoads, updateLoad, cancelLoad, completeLoad, deleteLoad, getSuggestedTrucks, getPriceSuggestion } from "../controllers/load.controller";
import { protect, cargoSenderOnly, cargoSenderOrBrokerOnly } from "../middleware/auth.middleware";

const router = Router();

router.get("/", protect, getLoads);
router.get("/my", protect, cargoSenderOnly, getMyLoads);
router.get("/price-suggestion", protect, getPriceSuggestion);
router.get("/suggested-trucks", protect, getSuggestedTrucks);
router.get("/:id", protect, getLoad);
router.post("/", protect, cargoSenderOrBrokerOnly, createLoad);
router.patch("/:id/cancel", protect, cargoSenderOnly, cancelLoad);
router.patch("/:id/complete", protect, cargoSenderOnly, completeLoad);
router.patch("/:id", protect, cargoSenderOnly, updateLoad);
router.delete("/:id", protect, cargoSenderOnly, deleteLoad);

export default router;
