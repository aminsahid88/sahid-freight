import { Response } from "express";
import prisma from "../utils/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { notify } from "../utils/notify";
import { sendSMS } from "../utils/sms";
import { getIO } from "../utils/socket";

export const createBooking = async (req: AuthRequest, res: Response) => {
  try {
    const { loadId, truckId, agreedPrice, currency } = req.body;

    const load = await prisma.load.findUnique({ where: { id: loadId } });
    if (!load) return res.status(404).json({ message: "Load not found" });
    if (load.status !== "OPEN") return res.status(400).json({ message: "Load is no longer available" });

    const truck = await prisma.truck.findUnique({ where: { id: truckId } });
    if (!truck) return res.status(404).json({ message: "Truck not found" });
    if (truck.ownerId !== req.user!.userId) return res.status(403).json({ message: "Not your truck" });

    const existing = await prisma.booking.findFirst({
      where: { loadId, ownerId: req.user!.userId },
    });
    if (existing) return res.status(400).json({ message: "You already applied for this load" });

    const booking = await prisma.booking.create({
      data: { loadId, truckId, senderId: load.senderId, ownerId: req.user!.userId, agreedPrice, currency: currency || "USD" },
    });

    // Notify cargo sender
    await notify(load.senderId, "NEW_LOAD", "New Booking Request", `A truck owner has applied for your load: ${load.title}`);

    return res.status(201).json({ message: "Booking request sent", booking });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
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

    // Notify truck owner
    await notify(booking.ownerId, "BOOKING_ACCEPTED", "Booking Accepted! 🎉", `Your booking for "${booking.load.title}" has been accepted!`);

    return res.status(200).json({ message: "Booking accepted", booking: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
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

    // Notify truck owner
    await notify(booking.ownerId, "BOOKING_REJECTED", "Booking Rejected", `Your booking for "${booking.load.title}" was not accepted this time.`);

    return res.status(200).json({ message: "Booking rejected", booking: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
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

    // Update load status to IN_TRANSIT
    const updatedLoad = await prisma.load.update({
      where: { id: booking.loadId },
      data: { status: "IN_TRANSIT" },
    });

    // Notify cargo sender
    const { notify } = await import("../utils/notify");
    await notify(booking.load.senderId, "LOAD_PICKED_UP", "Cargo On The Way", "Your cargo is now in transit. You can track it live.");

    // SMS cargo sender
    const sender = await prisma.user.findUnique({ where: { id: booking.load.senderId }, select: { phone: true } });
    if (sender?.phone) {
      await sendSMS(sender.phone, `SahidFreight: Your cargo "${booking.load.title}" is now in transit. Track it in your dashboard.`);
    }

    return res.status(200).json({ message: "Journey started", booking: { ...booking, load: updatedLoad } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
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

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: "COMPLETED", deliveredAt: new Date() },
    });

    // Update load status
    await prisma.load.update({
      where: { id: booking.loadId },
      data: { status: "DELIVERED" },
    });

    // Notify cargo sender
    const { notify } = await import("../utils/notify");
    await notify(booking.load.senderId, "LOAD_DELIVERED", "Cargo Delivered!", "Your cargo has been delivered successfully.");

    // SMS cargo sender
    const senderDelivered = await prisma.user.findUnique({ where: { id: booking.load.senderId }, select: { phone: true } });
    if (senderDelivered?.phone) {
      await sendSMS(senderDelivered.phone, `SahidFreight: Your cargo "${booking.load.title}" has been delivered! Rate your experience in the app.`);
    }

    return res.status(200).json({ message: "Marked as delivered", booking: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
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

    const updated = await prisma.booking.update({
      where: { id },
      data: { driverId },
    });

    // Notify driver
    const { notify } = await import("../utils/notify");
    await notify(driverId, "BOOKING_ACCEPTED", "New Assignment", `You have been assigned to deliver: ${booking.loadId}`);

    return res.status(200).json({ message: "Driver assigned", booking: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
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

    // Notify the rated user
    const { notify } = await import("../utils/notify");
    await notify(ratedUserId, "NEW_REVIEW", "New Rating Received", `You received a ${rating}-star rating for load: ${booking.load.title}`);

    return res.status(200).json({ message: "Rating submitted" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
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
