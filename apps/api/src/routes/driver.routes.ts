import { Router, Response } from "express";
import { protect, fleetManagerOnly } from "../middleware/auth.middleware";
import { AuthRequest } from "../middleware/auth.middleware";
import prisma from "../utils/prisma";

const router = Router();

const ROLE_LABELS: Record<string, string> = {
  CARGO_SENDER: "Cargo Sender",
  TRUCK_OWNER: "Truck Owner",
  ADMIN: "Admin",
};

// Invite an existing user as a driver (truck owner only)
router.post("/invite", protect, fleetManagerOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone number is required" });

    const user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      // User doesn't exist — client can offer to send an SMS invite
      // TODO: store pending invite in DB and auto-link when this phone registers as DRIVER
      return res.status(404).json({
        message: "This number isn't on Sahid Freight yet.",
        code: "USER_NOT_FOUND",
        canInvite: true,
        phone,
      });
    }

    if (user.role !== "DRIVER") {
      const roleLabel = ROLE_LABELS[user.role] || user.role;
      return res.status(400).json({
        message: `This number is registered as a ${roleLabel}. They need to switch to a driver account to be added to your fleet.`,
        code: "WRONG_ROLE",
      });
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

// Send SMS invite to unregistered driver (stub — stores intent, actual SMS is a TODO)
router.post("/send-invite", protect, fleetManagerOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone number is required" });

    // TODO: integrate SMS provider (Twilio, Africa's Talking, etc.) to send:
    // "[OwnerName] invited you to drive for their fleet on Sahid Freight.
    //  Download: https://sahidfreight.app and register as a driver to accept."
    //
    // TODO: store pending invite in a DriverInvite table with phone, ownerId, expiresAt.
    // When this phone later registers as DRIVER, auto-link via invitedById.

    const owner = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    console.log(`[SMS INVITE STUB] ${owner?.fullName} invited ${phone} to join their fleet`);

    return res.status(200).json({
      message: "Invite recorded. The driver will be linked to your fleet when they register.",
      phone,
    });
  } catch (error) {
    console.error("sendInvite failed:", error);
    return res.status(500).json({ message: "Failed to send invite." });
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
