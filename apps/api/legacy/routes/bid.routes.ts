import { Router } from "express";
import { protect, truckOwnerOnly, cargoSenderOnly } from "../middleware/auth.middleware";
import { placeBid, getBidsForLoad, getMyBids, acceptBid, rejectBid } from "../controllers/bid.controller";

const router = Router();

router.post("/", protect, truckOwnerOnly, placeBid);
router.get("/my", protect, truckOwnerOnly, getMyBids);
router.get("/load/:loadId", protect, cargoSenderOnly, getBidsForLoad);
router.patch("/:id/accept", protect, cargoSenderOnly, acceptBid);
router.patch("/:id/reject", protect, cargoSenderOnly, rejectBid);

export default router;
