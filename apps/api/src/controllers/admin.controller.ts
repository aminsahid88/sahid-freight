import { Response } from "express";
import prisma from "../utils/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { notify } from "../utils/notify";

// ─────────────────────────────────────────
// DASHBOARD STATS
// ─────────────────────────────────────────
export const getStats = async (req: AuthRequest, res: Response) => {
  try {
    const [
      totalUsers, totalTrucks, totalLoads,
      totalBookings, pendingVerifications, activeLoads
    ] = await Promise.all([
      prisma.user.count(),
      prisma.truck.count(),
      prisma.load.count(),
      prisma.booking.count(),
      prisma.user.count({ where: { status: "PENDING_VERIFICATION" } }),
      prisma.load.count({ where: { status: "OPEN" } }),
    ]);

    return res.status(200).json({
      stats: {
        totalUsers,
        totalTrucks,
        totalLoads,
        totalBookings,
        pendingVerifications,
        activeLoads,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// GET ALL USERS
// ─────────────────────────────────────────
export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { role, status, country } = req.query;

    const users = await prisma.user.findMany({
      where: {
        ...(role && { role: role as any }),
        ...(status && { status: status as any }),
        ...(country && { country: country as any }),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        country: true,
        city: true,
        isVerified: true,
        createdAt: true,
        senderProfile: { select: { verificationStatus: true, senderType: true } },
        truckOwnerProfile: { select: { verificationStatus: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ users });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// GET SINGLE USER
// ─────────────────────────────────────────
export const getUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        senderProfile: { include: { documents: true } },
        truckOwnerProfile: { include: { documents: true } },
        trucks: true,
        loadsPosted: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json({ user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// APPROVE USER VERIFICATION
// ─────────────────────────────────────────
export const approveVerification = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: { senderProfile: true, truckOwnerProfile: true },
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    // Update user
    await prisma.user.update({
      where: { id },
      data: { isVerified: true, status: "ACTIVE" },
    });

    // Update profile verification status
    if (user.role === "CARGO_SENDER" && user.senderProfile) {
      await prisma.senderProfile.update({
        where: { id: user.senderProfile.id },
        data: { verificationStatus: "APPROVED", verifiedAt: new Date() },
      });
    }

    if (user.role === "TRUCK_OWNER" && user.truckOwnerProfile) {
      await prisma.truckOwnerProfile.update({
        where: { id: user.truckOwnerProfile.id },
        data: { verificationStatus: "APPROVED", verifiedAt: new Date() },
      });
    }

    // Notify user
    await notify(id, "ACCOUNT_VERIFIED", "Account Verified! ✅", "Your account has been verified. You can now use all Sahid Freight features!");

    return res.status(200).json({ message: "User verified successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// REJECT USER VERIFICATION
// ─────────────────────────────────────────
export const rejectVerification = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await prisma.user.findUnique({
      where: { id },
      include: { senderProfile: true, truckOwnerProfile: true },
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.role === "CARGO_SENDER" && user.senderProfile) {
      await prisma.senderProfile.update({
        where: { id: user.senderProfile.id },
        data: { verificationStatus: "REJECTED", rejectionReason: reason },
      });
    }

    if (user.role === "TRUCK_OWNER" && user.truckOwnerProfile) {
      await prisma.truckOwnerProfile.update({
        where: { id: user.truckOwnerProfile.id },
        data: { verificationStatus: "REJECTED", rejectionReason: reason },
      });
    }

    // Notify user
    await notify(id, "ACCOUNT_VERIFIED", "Verification Rejected", `Your verification was rejected. Reason: ${reason}`);

    return res.status(200).json({ message: "Verification rejected" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// SUSPEND USER
// ─────────────────────────────────────────
export const suspendUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.user.update({
      where: { id },
      data: { status: "SUSPENDED" },
    });

    return res.status(200).json({ message: "User suspended" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// GET ALL LOADS
// ─────────────────────────────────────────
export const getAllLoads = async (req: AuthRequest, res: Response) => {
  try {
    const { status, country } = req.query;

    const loads = await prisma.load.findMany({
      where: {
        ...(status && { status: status as any }),
        ...(country && { pickupCountry: country as any }),
      },
      include: {
        sender: { select: { id: true, fullName: true, phone: true } },
        bookings: { select: { id: true, status: true } },
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
// GET ALL BOOKINGS
// ─────────────────────────────────────────
export const getAllBookings = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;

    const bookings = await prisma.booking.findMany({
      where: { ...(status && { status: status as any }) },
      include: {
        load: { select: { title: true, pickupCity: true, deliveryCity: true } },
        sender: { select: { fullName: true, phone: true } },
        owner: { select: { fullName: true, phone: true } },
        truck: { select: { plateNumber: true, truckType: true } },
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
// VERIFY TRUCK
// ─────────────────────────────────────────
export const verifyTruck = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const truck = await prisma.truck.findUnique({ where: { id }, include: { owner: true } });
    if (!truck) return res.status(404).json({ message: "Truck not found" });

    await prisma.truck.update({
      where: { id },
      data: { isVerified: true },
    });

    const { notify } = await import("../utils/notify");
    await notify(truck.ownerId, "ACCOUNT_VERIFIED", "Truck Verified", `Your truck ${truck.plateNumber} has been verified and is ready for bookings.`);

    return res.status(200).json({ message: "Truck verified" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// GET ALL TRUCKS (admin)
// ─────────────────────────────────────────
export const getAllTrucks = async (req: AuthRequest, res: Response) => {
  try {
    const trucks = await prisma.truck.findMany({
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
