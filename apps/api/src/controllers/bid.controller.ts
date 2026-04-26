import { Response } from "express";
import prisma from "../utils/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { notify } from "../utils/notify";
import { sendSMS } from "../utils/sms";

// ─────────────────────────────────────────
// PLACE A BID (truck owner)
// ─────────────────────────────────────────
export const placeBid = async (req: AuthRequest, res: Response) => {
  try {
    const { loadId, truckId, price, currency, message } = req.body;

    if (!loadId || !price) {
      return res.status(400).json({ message: "loadId and price are required" });
    }

    const parsedPrice = Number(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ message: "Price must be a positive number" });
    }

    const load = await prisma.load.findUnique({ where: { id: loadId } });
    if (!load) return res.status(404).json({ message: "Load not found" });
    if (load.status !== "OPEN") return res.status(400).json({ message: "Load is no longer accepting bids" });

    // Prevent double booking: if owner has active trip, only allow bids from that delivery city
    const activeBooking = await prisma.booking.findFirst({
      where: { ownerId: req.user!.userId, status: { in: ["ACCEPTED", "IN_TRANSIT"] as any[] } },
      include: { load: true },
    });
    if (activeBooking) {
      const deliveryCity = activeBooking.load.deliveryCity.toLowerCase().trim();
      const newPickupCity = load.pickupCity.toLowerCase().trim();
      if (deliveryCity !== newPickupCity) {
        return res.status(400).json({
          message: `You have an active trip to ${activeBooking.load.deliveryCity}. You can only bid on loads departing from ${activeBooking.load.deliveryCity}.`,
        });
      }
    }

    // Validate truck belongs to this owner (if provided)
    if (truckId) {
      const truck = await prisma.truck.findUnique({ where: { id: truckId } });
      if (!truck) return res.status(404).json({ message: "Truck not found" });
      if (truck.ownerId !== req.user!.userId) return res.status(403).json({ message: "Not your truck" });
    }

    const existing = await prisma.bid.findFirst({
      where: { loadId, truckOwnerId: req.user!.userId },
    });
    if (existing) return res.status(400).json({ message: "You already placed a bid on this load" });

    const bid = await prisma.bid.create({
      data: {
        loadId,
        truckOwnerId: req.user!.userId,
        truckId: truckId || null,
        price: parsedPrice,
        currency: currency || "USD",
        message: message?.trim() || null,
      },
    });

    await notify(load.senderId, "NEW_BID", "New Bid Received", `A truck owner placed a bid of ${parsedPrice} ${currency || "USD"} on your load: ${load.title}`);

    // SMS to cargo sender
    const sender = await prisma.user.findUnique({ where: { id: load.senderId }, select: { phone: true } });
    if (sender?.phone) {
      await sendSMS(sender.phone, `SahidFreight: New bid of ${parsedPrice} ${currency || "USD"} on your load "${load.title}". Login to review.`);
    }

    return res.status(201).json({ message: "Bid placed successfully", bid });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// GET BIDS FOR A LOAD (cargo sender)
// ─────────────────────────────────────────
export const getBidsForLoad = async (req: AuthRequest, res: Response) => {
  try {
    const { loadId } = req.params;

    const load = await prisma.load.findUnique({ where: { id: loadId } });
    if (!load) return res.status(404).json({ message: "Load not found" });
    if (load.senderId !== req.user!.userId) return res.status(403).json({ message: "Not your load" });

    const bids = await prisma.bid.findMany({
      where: { loadId },
      include: {
        truckOwner: { select: { id: true, fullName: true, phone: true, isVerified: true, averageRating: true, totalRatings: true } },
        truck: { select: { id: true, plateNumber: true, truckType: true, capacityTons: true } },
      },
      orderBy: { price: "asc" },
    });

    return res.status(200).json({ bids });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// GET MY BIDS (truck owner)
// ─────────────────────────────────────────
export const getMyBids = async (req: AuthRequest, res: Response) => {
  try {
    const bids = await prisma.bid.findMany({
      where: { truckOwnerId: req.user!.userId },
      include: {
        load: {
          select: {
            id: true, title: true, pickupCity: true, deliveryCity: true,
            offeredPrice: true, currency: true, status: true, scheduledDate: true,
          },
        },
        truck: { select: { plateNumber: true, truckType: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json({ bids });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// ACCEPT A BID (cargo sender)
// Auto-creates a booking and marks load BOOKED
// ─────────────────────────────────────────
export const acceptBid = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const bid = await prisma.bid.findUnique({
      where: { id },
      include: { load: true, truck: true },
    });
    if (!bid) return res.status(404).json({ message: "Bid not found" });
    if (bid.load.senderId !== req.user!.userId) return res.status(403).json({ message: "Not your load" });
    if (bid.status !== "PENDING") return res.status(400).json({ message: "Bid is no longer pending" });
    if (bid.load.status !== "OPEN") return res.status(400).json({ message: "Load is no longer open" });

    // Reject all other bids
    await prisma.bid.updateMany({
      where: { loadId: bid.loadId, id: { not: id } },
      data: { status: "REJECTED" },
    });

    // Accept this bid
    const updated = await prisma.bid.update({
      where: { id },
      data: { status: "ACCEPTED" },
    });

    // Auto-create a booking if truck was specified with the bid
    let booking = null;
    if (bid.truckId) {
      booking = await prisma.booking.create({
        data: {
          loadId: bid.loadId,
          truckId: bid.truckId,
          senderId: bid.load.senderId,
          ownerId: bid.truckOwnerId,
          agreedPrice: bid.price,
          currency: bid.currency,
          status: "ACCEPTED",
        },
      });

      // Mark load as BOOKED
      await prisma.load.update({
        where: { id: bid.loadId },
        data: { status: "BOOKED" },
      });
    }

    await notify(
      bid.truckOwnerId,
      "BID_ACCEPTED",
      "Bid Accepted! 🎉",
      bid.truckId
        ? `Your bid for "${bid.load.title}" was accepted and a booking has been created. You can now start the journey.`
        : `Your bid for "${bid.load.title}" was accepted. Contact the sender to arrange the booking.`
    );

    // SMS to truck owner
    const truckOwner = await prisma.user.findUnique({ where: { id: bid.truckOwnerId }, select: { phone: true } });
    if (truckOwner?.phone) {
      await sendSMS(truckOwner.phone, `SahidFreight: Your bid for "${bid.load.title}" was accepted! Login to start the journey.`);
    }

    return res.status(200).json({ message: "Bid accepted", bid: updated, booking });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// REJECT A BID (cargo sender)
// ─────────────────────────────────────────
export const rejectBid = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const bid = await prisma.bid.findUnique({ where: { id }, include: { load: true } });
    if (!bid) return res.status(404).json({ message: "Bid not found" });
    if (bid.load.senderId !== req.user!.userId) return res.status(403).json({ message: "Not your load" });
    if (bid.status !== "PENDING") return res.status(400).json({ message: "Bid is no longer pending" });

    const updated = await prisma.bid.update({
      where: { id },
      data: { status: "REJECTED" },
    });

    await notify(bid.truckOwnerId, "BID_REJECTED", "Bid Not Accepted", `Your bid for "${bid.load.title}" was not accepted this time.`);

    return res.status(200).json({ message: "Bid rejected", bid: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
