import { Response } from "express";
import prisma from "../utils/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { notify } from "../utils/notify";
import { sendSMS } from "../utils/sms";
import { getIO } from "../utils/socket";
import { uploadToS3 } from "../utils/s3";

export const createBooking = async (req: AuthRequest, res: Response) => {
  try {
    const { loadId, truckId, agreedPrice, currency } = req.body;

    const load = await prisma.load.findUnique({ where: { id: loadId } });
    if (!load) return res.status(404).json({ message: "Load not found" });
    if (load.status !== "OPEN") return res.status(400).json({ message: "Load is no longer available" });

    const truck = await prisma.truck.findUnique({ where: { id: truckId } });
    if (!truck) return res.status(404).json({ message: "Truck not found" });

    // Truck owners may only book their own trucks; brokers can dispatch any truck.
    const isBroker = req.user!.role === "BROKER";
    if (!isBroker && truck.ownerId !== req.user!.userId) {
      return res.status(403).json({ message: "Not your truck" });
    }

    // Dedupe per (load, truck owner). For TRUCK_OWNER callers truck.ownerId === req.user.userId,
    // preserving the prior "owner can't apply twice on same load" rule; for BROKER callers it
    // prevents a broker from dispatching two trucks from the same owner to the same load.
    const existing = await prisma.booking.findFirst({
      where: { loadId, ownerId: truck.ownerId },
    });
    if (existing) return res.status(400).json({ message: "This truck owner already has a booking for this load" });

    const booking = await prisma.booking.create({
      data: {
        loadId,
        truckId,
        senderId: load.senderId,
        ownerId: truck.ownerId,
        agreedPrice,
        currency: currency || "USD",
        brokerId: isBroker ? req.user!.userId : null,
      },
    });

    try {
      const message = isBroker
        ? `A truck has been dispatched for your load: ${load.title}`
        : `A truck owner has applied for your load: ${load.title}`;
      await notify(load.senderId, "NEW_LOAD", "New Booking Request", message);
    } catch (err) { console.error("Notify failed (booking still created):", err); }

    return res.status(201).json({ message: "Booking request sent", booking });
  } catch (error) {
    console.error("createBooking failed:", error);
    return res.status(500).json({ message: "Failed to create booking. Please try again." });
  }
};

export const getBookingsForLoad = async (req: AuthRequest, res: Response) => {
  try {
    const { loadId } = req.params;

    const load = await prisma.load.findUnique({ where: { id: loadId } });
    if (!load) return res.status(404).json({ message: "Load not found" });
    if (load.senderId !== req.user!.userId) return res.status(403).json({ message: "Not your load" });

    const bookings = await prisma.booking.findMany({
      where: { loadId },
      include: {
        owner: { select: { id: true, fullName: true, phone: true, isVerified: true } },
        truck: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ bookings });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const acceptBooking = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({ where: { id }, include: { load: true } });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.senderId !== req.user!.userId) return res.status(403).json({ message: "Not authorized" });
    if (booking.status !== "PENDING") return res.status(400).json({ message: "Booking is no longer pending" });

    await prisma.booking.updateMany({
      where: { loadId: booking.loadId, id: { not: id } },
      data: { status: "REJECTED" },
    });

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: "ACCEPTED" },
    });

    await prisma.load.update({
      where: { id: booking.loadId },
      data: { status: "BOOKED" },
    });

    try { await notify(booking.ownerId, "BOOKING_ACCEPTED", "Booking Accepted! 🎉", `Your booking for "${booking.load.title}" has been accepted!`); }
    catch (err) { console.error("Notify failed (booking still accepted):", err); }

    return res.status(200).json({ message: "Booking accepted", booking: updated });
  } catch (error) {
    console.error("acceptBooking failed:", error);
    return res.status(500).json({ message: "Failed to accept booking. Please try again." });
  }
};

export const rejectBooking = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findUnique({ where: { id }, include: { load: true } });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.senderId !== req.user!.userId) return res.status(403).json({ message: "Not authorized" });
    if (booking.status !== "PENDING") return res.status(400).json({ message: "Booking is no longer pending" });

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: "REJECTED" },
    });

    try { await notify(booking.ownerId, "BOOKING_REJECTED", "Booking Rejected", `Your booking for "${booking.load.title}" was not accepted this time.`); }
    catch (err) { console.error("Notify failed (booking still rejected):", err); }

    return res.status(200).json({ message: "Booking rejected", booking: updated });
  } catch (error) {
    console.error("rejectBooking failed:", error);
    return res.status(500).json({ message: "Failed to reject booking. Please try again." });
  }
};

export const getMyBookings = async (req: AuthRequest, res: Response) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { ownerId: req.user!.userId },
      include: { load: true, truck: true },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ bookings });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getBookingById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        load: true,
        truck: true,
        owner: { select: { id: true, fullName: true, phone: true } },
        sender: { select: { id: true, fullName: true, phone: true } },
        driver: { select: { id: true, fullName: true, phone: true } },
        payment: true,
      },
    });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    const uid = req.user!.userId;
    if (booking.ownerId !== uid && booking.senderId !== uid && (booking as any).driverId !== uid) {
      return res.status(403).json({ message: "Access denied" });
    }
    return res.status(200).json({ booking });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// START JOURNEY (truck owner)
// ─────────────────────────────────────────
export const startJourney = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { load: true }
    });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    const isOwner = booking.ownerId === req.user!.userId;
    const isDriver = (booking as any).driverId === req.user!.userId;
    if (!isOwner && !isDriver) return res.status(403).json({ message: "Not your booking" });
    if (booking.status !== "ACCEPTED") return res.status(400).json({ message: "Booking must be accepted first" });

    // Update booking status to IN_TRANSIT
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: { status: "IN_TRANSIT", pickedUpAt: new Date() },
    });

    // Update load status to IN_TRANSIT
    const updatedLoad = await prisma.load.update({
      where: { id: booking.loadId },
      data: { status: "IN_TRANSIT" },
    });

    try {
      const { notify } = await import("../utils/notify");
      await notify(booking.load.senderId, "LOAD_PICKED_UP", "Cargo On The Way", "Your cargo is now in transit. You can track it live.");
    } catch (err) { console.error("Notify failed (journey still started):", err); }

    try {
      const sender = await prisma.user.findUnique({ where: { id: booking.load.senderId }, select: { phone: true } });
      if (sender?.phone) {
        await sendSMS(sender.phone, `SahidFreight: Your cargo "${booking.load.title}" is now in transit. Track it in your dashboard.`);
      }
    } catch (err) { console.error("SMS failed (journey still started):", err); }

    return res.status(200).json({ message: "Journey started", booking: { ...updatedBooking, load: updatedLoad } });
  } catch (error) {
    console.error("startJourney failed:", error);
    return res.status(500).json({ message: "Failed to start journey. Please try again." });
  }
};

// ─────────────────────────────────────────
// MARK AS DELIVERED (truck owner)
// ─────────────────────────────────────────
export const markDelivered = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { load: true }
    });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    const isOwner2 = booking.ownerId === req.user!.userId;
    const isDriver2 = (booking as any).driverId === req.user!.userId;
    if (!isOwner2 && !isDriver2) return res.status(403).json({ message: "Not your booking" });
    if (booking.status !== "IN_TRANSIT") {
      return res.status(400).json({ message: "Booking must be in transit before it can be marked delivered." });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: "COMPLETED", deliveredAt: new Date() },
    });

    // Update load status
    await prisma.load.update({
      where: { id: booking.loadId },
      data: { status: "DELIVERED" },
    });

    try {
      const { notify } = await import("../utils/notify");
      await notify(booking.load.senderId, "LOAD_DELIVERED", "Cargo Delivered!", "Your cargo has been delivered successfully.");
    } catch (err) { console.error("Notify failed (delivery still recorded):", err); }

    try {
      const senderDelivered = await prisma.user.findUnique({ where: { id: booking.load.senderId }, select: { phone: true } });
      if (senderDelivered?.phone) {
        await sendSMS(senderDelivered.phone, `SahidFreight: Your cargo "${booking.load.title}" has been delivered! Rate your experience in the app.`);
      }
    } catch (err) { console.error("SMS failed (delivery still recorded):", err); }

    return res.status(200).json({ message: "Marked as delivered", booking: updated });
  } catch (error) {
    console.error("markDelivered failed:", error);
    return res.status(500).json({ message: "Failed to mark as delivered. Please try again." });
  }
};

// ─────────────────────────────────────────
// ASSIGN DRIVER TO BOOKING (truck owner)
// ─────────────────────────────────────────
export const assignDriver = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { driverId } = req.body;

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.ownerId !== req.user!.userId) return res.status(403).json({ message: "Not your booking" });

    // Verify driver exists and belongs to this owner
    const driver = await prisma.user.findUnique({ where: { id: driverId } });
    if (!driver) return res.status(404).json({ message: "Driver not found" });
    if (driver.role !== "DRIVER") return res.status(400).json({ message: "User is not a driver" });
    if ((driver as any).invitedById !== req.user!.userId) return res.status(403).json({ message: "Driver not in your fleet" });
    if (!(driver as any).fleetConfirmed) return res.status(403).json({ message: "Driver must be confirmed to your fleet first." });

    const updated = await prisma.booking.update({
      where: { id },
      data: { driverId },
    });

    try {
      const { notify } = await import("../utils/notify");
      await notify(driverId, "BOOKING_ACCEPTED", "New Assignment", `You have been assigned to deliver: ${booking.loadId}`);
    } catch (err) { console.error("Notify failed (driver still assigned):", err); }

    return res.status(200).json({ message: "Driver assigned", booking: updated });
  } catch (error) {
    console.error("assignDriver failed:", error);
    return res.status(500).json({ message: "Failed to assign driver. Please try again." });
  }
};

// ─────────────────────────────────────────
// RATE A BOOKING (sender rates owner, owner rates sender)
// ─────────────────────────────────────────
export const rateBooking = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const uid = req.user!.userId;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { load: true },
    });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.status !== "COMPLETED") return res.status(400).json({ message: "Can only rate completed bookings" });

    const isSender = booking.senderId === uid;
    const isOwner  = booking.ownerId  === uid;
    if (!isSender && !isOwner) return res.status(403).json({ message: "Not part of this booking" });

    if (isSender && booking.senderRatedAt) return res.status(400).json({ message: "You already rated this booking" });
    if (isOwner  && booking.ownerRatedAt)  return res.status(400).json({ message: "You already rated this booking" });

    // Which user is being rated?
    const ratedUserId = isSender ? booking.ownerId : booking.senderId;

    // Update booking with the rating
    const updateData: any = isSender
      ? { senderRating: rating, senderComment: comment?.trim() || null, senderRatedAt: new Date() }
      : { ownerRating:  rating, ownerComment:  comment?.trim() || null, ownerRatedAt:  new Date() };

    await prisma.booking.update({ where: { id }, data: updateData });

    // Recalculate averageRating for the rated user
    const ratedUser = await prisma.user.findUnique({ where: { id: ratedUserId } });
    if (ratedUser) {
      const prev  = ratedUser.totalRatings;
      const prevAvg = ratedUser.averageRating ?? 0;
      const newTotal = prev + 1;
      const newAvg   = (prevAvg * prev + rating) / newTotal;
      await prisma.user.update({
        where: { id: ratedUserId },
        data: { averageRating: parseFloat(newAvg.toFixed(2)), totalRatings: newTotal },
      });
    }

    try {
      const { notify } = await import("../utils/notify");
      await notify(ratedUserId, "NEW_REVIEW", "New Rating Received", `You received a ${rating}-star rating for load: ${booking.load.title}`);
    } catch (err) { console.error("Notify failed (rating still saved):", err); }

    return res.status(200).json({ message: "Rating submitted" });
  } catch (error) {
    console.error("rateBooking failed:", error);
    return res.status(500).json({ message: "Failed to submit rating. Please try again." });
  }
};

// ─────────────────────────────────────────
// UPDATE BOOKING LOCATION (driver or truck owner while IN_TRANSIT)
// ─────────────────────────────────────────
export const updateBookingLocation = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { lat, lng } = req.body;

    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ message: "lat and lng are required" });
    }

    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const uid = req.user!.userId;
    const userRole = req.user!.role;
    if (booking.ownerId !== uid && booking.driverId !== uid && userRole !== "DRIVER") {
      return res.status(403).json({ message: "Not authorized" });
    }

    await prisma.truckLocation.create({
      data: { truckId: booking.truckId, lat: Number(lat), lng: Number(lng) },
    });

    // Broadcast to anyone watching this booking on the tracking page
    getIO()?.to(`tracking_${id}`).emit("location_updated", {
      lat: Number(lat),
      lng: Number(lng),
      speed: 0,
      timestamp: new Date().toISOString(),
    });

    return res.status(200).json({ message: "Location updated" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// GET MY BOOKINGS AS DRIVER
// ─────────────────────────────────────────
export const getMyBookingsAsDriver = async (req: AuthRequest, res: Response) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { driverId: req.user!.userId },
      include: {
        load: { select: { id: true, title: true, pickupCity: true, deliveryCity: true, pickupLat: true, pickupLng: true, deliveryLat: true, deliveryLng: true, status: true, weightTons: true } },
        truck: { select: { plateNumber: true, truckType: true } },
        owner: { select: { fullName: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json({ bookings });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// GET MY BOOKINGS AS SENDER (accepted/in-transit/delivered)
// ─────────────────────────────────────────
export const getMySenderBookings = async (req: AuthRequest, res: Response) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { senderId: req.user!.userId },
      include: {
        load: { select: { id: true, title: true, pickupCity: true, deliveryCity: true, status: true } },
        truck: { select: { plateNumber: true, truckType: true } },
        owner: { select: { fullName: true, phone: true } },
        payment: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.status(200).json({ bookings });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

// ─────────────────────────────────────────
// SUBMIT PROOF OF DELIVERY (owner or driver)
// ─────────────────────────────────────────
export const submitProofOfDelivery = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const files = ((req as any).files as Express.Multer.File[] | undefined) || [];
    const notesRaw = typeof req.body?.notes === "string" ? req.body.notes.trim() : "";
    const notes = notesRaw.length > 0 ? notesRaw : null;

    if (files.length === 0) {
      return res.status(400).json({ message: "At least one photo is required." });
    }

    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { id: true, ownerId: true, driverId: true, status: true },
    });
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const isOwner = booking.ownerId === req.user!.userId;
    const isDriver = booking.driverId === req.user!.userId;
    if (!isOwner && !isDriver) return res.status(403).json({ message: "Not your booking" });

    if (booking.status !== "IN_TRANSIT") {
      return res.status(400).json({ message: "Booking must be in transit before proof of delivery can be submitted." });
    }

    const existing = await prisma.proofOfDelivery.findUnique({ where: { bookingId: id } });
    if (existing) return res.status(400).json({ message: "Proof of delivery already submitted for this booking." });

    const uploadedPhotos = await Promise.all(files.map(async (file) => {
      const key = await uploadToS3(file.buffer, file.originalname, file.mimetype, "proof-of-delivery");
      return {
        fileUrl: key,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      };
    }));

    const pod = await prisma.$transaction(async (tx) => {
      return tx.proofOfDelivery.create({
        data: {
          bookingId: id,
          submittedById: req.user!.userId,
          notes,
          photos: { create: uploadedPhotos },
        },
        include: { photos: true },
      });
    });

    return res.status(201).json({ message: "Proof of delivery submitted", proofOfDelivery: pod });
  } catch (error) {
    console.error("submitProofOfDelivery failed:", error);
    return res.status(500).json({ message: "Failed to submit proof of delivery. Please try again." });
  }
};
