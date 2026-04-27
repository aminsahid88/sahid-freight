import { Router, Response } from "express";
import { protect, fleetManagerOnly } from "../middleware/auth.middleware";
import { AuthRequest } from "../middleware/auth.middleware";
import prisma from "../utils/prisma";

const router = Router();

// Invite an existing user as a driver (truck owner only)
router.post("/invite", protect, fleetManagerOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone number is required" });

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return res.status(404).json({ message: "No Sahid Freight account found with this phone number. Ask the driver to register first." });
    }

    if (user.role !== "DRIVER") {
      return res.status(400).json({ message: "This user is not registered as a driver. They need to register with the Driver role first." });
    }

    if ((user as any).invitedById && (user as any).invitedById !== req.user!.userId) {
      return res.status(400).json({ message: "This driver is already assigned to another fleet." });
    }

    if ((user as any).invitedById === req.user!.userId) {
      return res.status(400).json({ message: "This driver is already in your fleet." });
    }

    const driver = await prisma.user.update({
      where: { id: user.id },
      data: { invitedById: req.user!.userId },
    });

    return res.status(200).json({
      message: `${driver.fullName || 'Driver'} has been added to your fleet.`,
      driver: {
        id: driver.id,
        fullName: driver.fullName,
        phone: driver.phone,
        licenseNumber: (driver as any).licenseNumber,
        role: driver.role,
      },
    });
  } catch (error) {
    console.error("inviteDriver failed:", error);
    return res.status(500).json({ message: "Failed to invite driver. Please try again." });
  }
});

// Get my drivers (truck owner)
router.get("/", protect, fleetManagerOnly, async (req: AuthRequest, res: Response) => {
  try {
    const drivers = await prisma.user.findMany({
      where: { invitedById: req.user!.userId, role: "DRIVER" },
      select: {
        id: true, fullName: true, phone: true, licenseNumber: true, status: true, createdAt: true,
        bookingsAsDriver: {
          select: { id: true, status: true, load: { select: { title: true } } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
    return res.status(200).json({ drivers });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// Remove a driver
router.delete("/:id", protect, fleetManagerOnly, async (req: AuthRequest, res: Response) => {
  try {
    const driver = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!driver) return res.status(404).json({ message: "Driver not found" });
    if ((driver as any).invitedById !== req.user!.userId) return res.status(403).json({ message: "Not your driver" });

    await prisma.user.update({ where: { id: req.params.id }, data: { status: "SUSPENDED" } });
    return res.status(200).json({ message: "Driver removed" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

export default router;
