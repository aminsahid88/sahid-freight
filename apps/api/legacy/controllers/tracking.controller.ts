import { Response } from "express";
import prisma from "../utils/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

// ─────────────────────────────────────────
// SEND GPS LOCATION (truck owner)
// ─────────────────────────────────────────
export const sendLocation = async (req: AuthRequest, res: Response) => {
  try {
    const { truckId } = req.params;
    const { lat, lng, speed } = req.body;

    // Check truck belongs to this owner
    const truck = await prisma.truck.findUnique({ where: { id: truckId } });
    if (!truck) return res.status(404).json({ message: "Truck not found" });
    if (truck.ownerId !== req.user!.userId) return res.status(403).json({ message: "Not your truck" });

    const location = await prisma.truckLocation.create({
      data: { truckId, lat, lng, speed },
    });

    return res.status(201).json({ message: "Location updated", location });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// GET LATEST LOCATION (anyone with access)
// ─────────────────────────────────────────
export const getLatestLocation = async (req: AuthRequest, res: Response) => {
  try {
    const { truckId } = req.params;

    const location = await prisma.truckLocation.findFirst({
      where: { truckId },
      orderBy: { recordedAt: "desc" },
    });

    if (!location) return res.status(404).json({ message: "No location data yet" });

    return res.status(200).json({ location });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// GET LOCATION HISTORY
// ─────────────────────────────────────────
export const getLocationHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { truckId } = req.params;

    const locations = await prisma.truckLocation.findMany({
      where: { truckId },
      orderBy: { recordedAt: "desc" },
      take: 50,
    });

    return res.status(200).json({ locations });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
