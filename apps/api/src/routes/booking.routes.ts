import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { createBooking, getBookingsForLoad, acceptBooking, rejectBooking, getMyBookings, getBookingById, startJourney, markDelivered, assignDriver, getMyBookingsAsDriver, getMyBookingsAsBroker, rateBooking, updateBookingLocation, getMySenderBookings, submitProofOfDelivery } from "../controllers/booking.controller";
import { protect, cargoSenderOnly, truckOwnerOnly, truckOwnerOrBrokerOnly, brokerOnly } from "../middleware/auth.middleware";

const router = Router();

// Separate multer instance for proof-of-delivery photo uploads.
// Independent from the /upload single-file uploader.
const podUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed for proof of delivery."));
  },
});
const podPhotosMiddleware = (req: Request, res: Response, next: NextFunction) => {
  podUpload.array("photos", 4)(req as any, res as any, next);
};

router.post("/", protect, truckOwnerOrBrokerOnly, createBooking);
router.get("/my", protect, truckOwnerOnly, getMyBookings);
router.get("/driver/my", protect, getMyBookingsAsDriver);
router.get("/sender/my", protect, cargoSenderOnly, getMySenderBookings);
router.get("/broker/my", protect, brokerOnly, getMyBookingsAsBroker);
router.get("/load/:loadId", protect, cargoSenderOnly, getBookingsForLoad);
router.get("/:id", protect, getBookingById);
router.patch("/:id/accept", protect, cargoSenderOnly, acceptBooking);
router.patch("/:id/reject", protect, cargoSenderOnly, rejectBooking);
router.patch("/:id/start", protect, startJourney);
router.patch("/:id/deliver", protect, markDelivered);
router.patch("/:id/assign-driver", protect, truckOwnerOnly, assignDriver);
router.patch("/:id/rate", protect, rateBooking);
router.patch("/:id/location", protect, updateBookingLocation);
router.post("/:id/proof-of-delivery", protect, podPhotosMiddleware, submitProofOfDelivery);

export default router;
