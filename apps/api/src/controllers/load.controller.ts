import { Response } from "express";
import prisma from "../utils/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

// ─────────────────────────────────────────
// POST A LOAD
// ─────────────────────────────────────────
export const createLoad = async (req: AuthRequest, res: Response) => {
  try {
    // Check sender is verified
    const sender = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!sender?.isVerified) return res.status(403).json({ message: "Your account must be verified before posting loads." });

    const {
      title, description, weightTons, truckTypeNeeded,
      pickupCity, pickupCountry, pickupLat, pickupLng,
      deliveryCity, deliveryCountry, deliveryLat, deliveryLng,
      offeredPrice, currency, scheduledDate,
    } = req.body;

    const load = await prisma.load.create({
      data: {
        senderId: req.user!.userId,
        title,
        description,
        weightTons,
        truckTypeNeeded,
        pickupCity,
        pickupCountry,
        pickupLat,
        pickupLng,
        deliveryCity,
        deliveryCountry,
        deliveryLat,
        deliveryLng,
        offeredPrice,
        currency: currency || "USD",
        scheduledDate: new Date(scheduledDate),
      },
    });

    return res.status(201).json({ message: "Load posted successfully", load });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// GET ALL OPEN LOADS
// ─────────────────────────────────────────
export const getLoads = async (req: AuthRequest, res: Response) => {
  try {
    const { country, truckType, pickupCity, deliveryCity } = req.query;

    const loads = await prisma.load.findMany({
      where: {
        status: "OPEN",
        ...(country && { pickupCountry: country as any }),
        ...(truckType && { truckTypeNeeded: truckType as any }),
        ...(pickupCity && { pickupCity: { contains: pickupCity as string, mode: "insensitive" } }),
        ...(deliveryCity && { deliveryCity: { contains: deliveryCity as string, mode: "insensitive" } }),
      },
      include: {
        sender: {
          select: { id: true, fullName: true, phone: true, isVerified: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ loads });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// GET SINGLE LOAD
// ─────────────────────────────────────────
export const getLoad = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const load = await prisma.load.findUnique({
      where: { id },
      include: {
        sender: {
          select: { id: true, fullName: true, phone: true, isVerified: true },
        },
        bookings: {
          select: { id: true, status: true, agreedPrice: true, createdAt: true },
        },
      },
    });

    if (!load) return res.status(404).json({ message: "Load not found" });

    return res.status(200).json({ load });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// GET MY LOADS (sender sees their own loads)
// ─────────────────────────────────────────
export const getMyLoads = async (req: AuthRequest, res: Response) => {
  try {
    const loads = await prisma.load.findMany({
      where: { senderId: req.user!.userId },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ loads });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// CANCEL A LOAD
// ─────────────────────────────────────────
export const cancelLoad = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const load = await prisma.load.findUnique({ where: { id } });

    if (!load) return res.status(404).json({ message: "Load not found" });
    if (load.senderId !== req.user!.userId) return res.status(403).json({ message: "Not your load" });
    if (load.status !== "OPEN") return res.status(400).json({ message: "Only open loads can be cancelled" });

    const updated = await prisma.load.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return res.status(200).json({ message: "Load cancelled", load: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
