import { Response } from "express";
import prisma from "../utils/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

// ─────────────────────────────────────────
// ADD A TRUCK
// ─────────────────────────────────────────
export const addTruck = async (req: AuthRequest, res: Response) => {
  try {
    const { plateNumber, truckType, capacityTons, lengthMeters, currentCity, currentCountry } = req.body;

    const existing = await prisma.truck.findUnique({ where: { plateNumber } });
    if (existing) return res.status(400).json({ message: "Plate number already registered" });

    const truck = await prisma.truck.create({
      data: {
        ownerId: req.user!.userId,
        plateNumber,
        truckType,
        capacityTons,
        lengthMeters,
        currentCity,
        currentCountry,
      },
    });

    return res.status(201).json({ message: "Truck added successfully", truck });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// GET MY TRUCKS
// ─────────────────────────────────────────
export const getMyTrucks = async (req: AuthRequest, res: Response) => {
  try {
    const trucks = await prisma.truck.findMany({
      where: { ownerId: req.user!.userId },
      include: {
        driver: { select: { id: true, fullName: true, phone: true, licenseNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ trucks });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// GET ALL AVAILABLE TRUCKS
// ─────────────────────────────────────────
export const getAvailableTrucks = async (req: AuthRequest, res: Response) => {
  try {
    const { country, truckType, city } = req.query;

    const trucks = await prisma.truck.findMany({
      where: {
        isAvailable: true,
        ...(country && { currentCountry: country as any }),
        ...(truckType && { truckType: truckType as any }),
        ...(city && { currentCity: { contains: city as string, mode: "insensitive" } }),
      },
      include: {
        owner: { select: { id: true, fullName: true, phone: true, isVerified: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ trucks });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// UPDATE TRUCK
// ─────────────────────────────────────────
// ─────────────────────────────────────────
// DELETE A TRUCK
// ─────────────────────────────────────────
export const deleteTruck = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const truck = await prisma.truck.findUnique({ where: { id } });
    if (!truck) return res.status(404).json({ message: "Truck not found" });
    if (truck.ownerId !== req.user!.userId) return res.status(403).json({ message: "Not your truck" });

    // Check for active bookings
    const activeBookings = await prisma.booking.count({
      where: { truckId: id, status: { in: ["PENDING", "ACCEPTED"] } },
    });
    if (activeBookings > 0) {
      return res.status(400).json({ message: "Cannot delete a truck with active bookings" });
    }

    // Delete related records first
    await prisma.truckLocation.deleteMany({ where: { truckId: id } });
    await prisma.bid.deleteMany({ where: { truckId: id } });
    await prisma.truck.delete({ where: { id } });

    return res.status(200).json({ message: "Truck deleted" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// UPDATE TRUCK
// ─────────────────────────────────────────
export const updateTruck = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const truck = await prisma.truck.findUnique({ where: { id } });
    if (!truck) return res.status(404).json({ message: "Truck not found" });
    if (truck.ownerId !== req.user!.userId) return res.status(403).json({ message: "Not your truck" });
    const { isAvailable, currentCity, currentCountry, lengthMeters, driverId } = req.body;

    // If assigning a driver, verify they belong to this owner
    if (driverId !== undefined && driverId !== null) {
      const driver = await prisma.user.findUnique({ where: { id: driverId } });
      if (!driver) return res.status(404).json({ message: "Driver not found" });
      if ((driver as any).invitedById !== req.user!.userId) return res.status(403).json({ message: "Driver not in your fleet" });
      if (!(driver as any).fleetConfirmed) return res.status(403).json({ message: "Driver must be confirmed to your fleet first." });
    }

    const updated = await prisma.truck.update({
      where: { id },
      data: {
        ...(isAvailable !== undefined && { isAvailable }),
        ...(currentCity && { currentCity }),
        ...(currentCountry && { currentCountry }),
        ...(lengthMeters && { lengthMeters }),
        ...("driverId" in req.body && { driverId: driverId || null }),
      },
      include: {
        driver: { select: { id: true, fullName: true, phone: true, licenseNumber: true } },
      },
    });
    return res.status(200).json({ message: "Truck updated", truck: updated });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
