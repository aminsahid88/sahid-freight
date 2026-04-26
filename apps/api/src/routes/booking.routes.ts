import { Router } from "express";
import { createBooking, getBookingsForLoad, acceptBooking, rejectBooking, getMyBookings, getBookingById, startJourney, markDelivered, assignDriver, getMyBookingsAsDriver, rateBooking, updateBookingLocation, getMySenderBookings } from "../controllers/booking.controller";
import { protect, cargoSenderOnly, truckOwnerOnly } from "../middleware/auth.middleware";

const router = Router();

router.post("/", protect, truckOwnerOnly, createBooking);
router.get("/my", protect, truckOwnerOnly, getMyBookings);
router.get("/driver/my", protect, getMyBookingsAsDriver);
router.get("/sender/my", protect, cargoSenderOnly, getMySenderBookings);
router.get("/load/:loadId", protect, cargoSenderOnly, getBookingsForLoad);
router.get("/:id", protect, getBookingById);
router.patch("/:id/accept", protect, cargoSenderOnly, acceptBooking);
router.patch("/:id/reject", protect, cargoSenderOnly, rejectBooking);
router.patch("/:id/start", protect, startJourney);
router.patch("/:id/deliver", protect, markDelivered);
router.patch("/:id/assign-driver", protect, truckOwnerOnly, assignDriver);
router.patch("/:id/rate", protect, rateBooking);
router.patch("/:id/location", protect, updateBookingLocation);

export default router;
