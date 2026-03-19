import { Router, Response } from "express";
import { protect, truckOwnerOnly } from "../middleware/auth.middleware";
import { AuthRequest } from "../middleware/auth.middleware";
import prisma from "../utils/prisma";
import bcrypt from "bcryptjs";

const router = Router();

// Invite/create a driver (truck owner only)
router.post("/invite", protect, truckOwnerOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { fullName, phone, password } = req.body;
    if (!fullName || !phone || !password) return res.status(400).json({ message: "fullName, phone and password required" });

    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) return res.status(400).json({ message: "Phone number already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const driver = await prisma.user.create({
      data: {
        fullName,
        phone,
        passwordHash: hashed,
        role: "DRIVER",
        status: "ACTIVE",
        isVerified: true,
        invitedById: req.user!.userId,
        country: req.body.country || "ETHIOPIA",
        city: req.body.city || "",
      },
    });

    return res.status(201).json({
      message: "Driver created successfully",
      driver: {
        id: driver.id,
        fullName: driver.fullName,
        phone: driver.phone,
        role: driver.role,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
});

// Get my drivers (truck owner)
router.get("/", protect, truckOwnerOnly, async (req: AuthRequest, res: Response) => {
  try {
    const drivers = await prisma.user.findMany({
      where: { invitedById: req.user!.userId, role: "DRIVER" },
      select: {
        id: true, fullName: true, phone: true, status: true, createdAt: true,
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
router.delete("/:id", protect, truckOwnerOnly, async (req: AuthRequest, res: Response) => {
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
