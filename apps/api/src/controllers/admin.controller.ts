import { Response } from "express";
import prisma from "../utils/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { notify } from "../utils/notify";

// ─────────────────────────────────────────
// DASHBOARD STATS
// ─────────────────────────────────────────
export const getStats = async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalUsers, totalTrucks, totalLoads,
      totalBookings, pendingVerifications, activeLoads,
      pendingDocuments,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.truck.count(),
      prisma.load.count(),
      prisma.booking.count(),
      prisma.user.count({ where: { status: "PENDING_VERIFICATION" } }),
      prisma.load.count({ where: { status: "OPEN" } }),
      prisma.verificationDocument.count({ where: { status: "PENDING" } }).catch(() => 0),
    ]);

    return res.status(200).json({
      stats: {
        totalUsers, totalTrucks, totalLoads,
        totalBookings, pendingVerifications, activeLoads,
        pendingDocuments,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// USERS
// ─────────────────────────────────────────
export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { role, status, country, search, page = "1" } = req.query;
    const take = 50;
    const skip = (parseInt(page as string, 10) - 1) * take;

    const where: any = {
      ...(role && { role: role as any }),
      ...(status && { status: status as any }),
      ...(country && { country: country as any }),
    };
    if (search) {
      where.OR = [
        { fullName: { contains: search as string, mode: "insensitive" } },
        { phone: { contains: search as string } },
        { email: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, fullName: true, email: true, phone: true,
          role: true, status: true, country: true, city: true,
          isVerified: true, createdAt: true, profilePhoto: true,
          senderProfile: { select: { verificationStatus: true, senderType: true } },
          truckOwnerProfile: { select: { verificationStatus: true } },
          _count: { select: { loadsPosted: true, bookingsAsSender: true, bookingsAsOwner: true, bidsPlaced: true } },
        },
        orderBy: { createdAt: "desc" },
        take, skip,
      }),
      prisma.user.count({ where }),
    ]);

    return res.status(200).json({ users, total, page: parseInt(page as string, 10), totalPages: Math.ceil(total / take) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        senderProfile: { include: { documents: true } },
        truckOwnerProfile: { include: { documents: true } },
        trucks: { select: { id: true, plateNumber: true, truckType: true, isVerified: true } },
        _count: { select: { loadsPosted: true, bookingsAsSender: true, bookingsAsOwner: true, bidsPlaced: true } },
      },
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({ user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const approveVerification = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: { senderProfile: true, truckOwnerProfile: true },
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    await prisma.user.update({ where: { id }, data: { isVerified: true, status: "ACTIVE" } });

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

    await notify(id, "ACCOUNT_VERIFIED", "Account Verified!", "Your account has been verified. You can now use all Sahid Freight features!");
    return res.status(200).json({ message: "User verified successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

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

    await notify(id, "ACCOUNT_VERIFIED", "Verification Rejected", `Your verification was rejected. Reason: ${reason}`);
    return res.status(200).json({ message: "Verification rejected" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const suspendUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.user.update({ where: { id }, data: { status: "SUSPENDED" } });
    return res.status(200).json({ message: "User suspended" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const banUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    await prisma.user.update({ where: { id }, data: { status: "BANNED" } });
    await notify(id, "ACCOUNT_VERIFIED", "Account Banned", `Your account has been banned. Reason: ${reason || "Policy violation"}`);
    return res.status(200).json({ message: "User banned" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const unbanUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.user.update({ where: { id }, data: { status: "ACTIVE" } });
    await notify(id, "ACCOUNT_VERIFIED", "Account Reinstated", "Your account has been reinstated. Welcome back!");
    return res.status(200).json({ message: "User unbanned" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// LOADS
// ─────────────────────────────────────────
export const getAllLoads = async (req: AuthRequest, res: Response) => {
  try {
    const { status, country, search, page = "1" } = req.query;
    const take = 50;
    const skip = (parseInt(page as string, 10) - 1) * take;

    const where: any = {
      ...(status && { status: status as any }),
      ...(country && { pickupCountry: country as any }),
    };
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: "insensitive" } },
        { pickupCity: { contains: search as string, mode: "insensitive" } },
        { deliveryCity: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const [loads, total] = await Promise.all([
      prisma.load.findMany({
        where,
        include: {
          sender: { select: { id: true, fullName: true, phone: true } },
          _count: { select: { bids: true, bookings: true } },
        },
        orderBy: { createdAt: "desc" },
        take, skip,
      }),
      prisma.load.count({ where }),
    ]);

    return res.status(200).json({ loads, total, page: parseInt(page as string, 10), totalPages: Math.ceil(total / take) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getLoad = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const load = await prisma.load.findUnique({
      where: { id },
      include: {
        sender: { select: { id: true, fullName: true, phone: true, email: true } },
        bids: {
          include: {
            truckOwner: { select: { id: true, fullName: true, phone: true } },
            truck: { select: { plateNumber: true, truckType: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        bookings: {
          include: {
            owner: { select: { fullName: true, phone: true } },
            truck: { select: { plateNumber: true } },
            driver: { select: { fullName: true, phone: true } },
          },
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

export const cancelLoad = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const load = await prisma.load.findUnique({ where: { id } });
    if (!load) return res.status(404).json({ message: "Load not found" });

    await prisma.load.update({ where: { id }, data: { status: "CANCELLED" } });
    await prisma.bid.updateMany({ where: { loadId: id, status: "PENDING" }, data: { status: "REJECTED" } });
    await prisma.booking.updateMany({ where: { loadId: id, status: { in: ["PENDING", "ACCEPTED"] } }, data: { status: "CANCELLED" } });

    await notify(load.senderId, "LOAD_DELIVERED", "Load Cancelled by Admin", `Your load "${load.title}" was cancelled by admin. ${reason ? `Reason: ${reason}` : ""}`);
    return res.status(200).json({ message: "Load cancelled" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// BOOKINGS
// ─────────────────────────────────────────
export const getAllBookings = async (req: AuthRequest, res: Response) => {
  try {
    const { status, page = "1" } = req.query;
    const take = 50;
    const skip = (parseInt(page as string, 10) - 1) * take;

    const where: any = { ...(status && { status: status as any }) };

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          load: { select: { title: true, pickupCity: true, deliveryCity: true, pickupCountry: true, deliveryCountry: true } },
          sender: { select: { id: true, fullName: true, phone: true } },
          owner: { select: { id: true, fullName: true, phone: true } },
          driver: { select: { id: true, fullName: true, phone: true } },
          truck: { select: { plateNumber: true, truckType: true } },
        },
        orderBy: { createdAt: "desc" },
        take, skip,
      }),
      prisma.booking.count({ where }),
    ]);

    return res.status(200).json({ bookings, total, page: parseInt(page as string, 10), totalPages: Math.ceil(total / take) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getBooking = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        load: { include: { sender: { select: { fullName: true, phone: true } } } },
        sender: { select: { id: true, fullName: true, phone: true } },
        owner: { select: { id: true, fullName: true, phone: true } },
        driver: { select: { id: true, fullName: true, phone: true } },
        truck: { select: { plateNumber: true, truckType: true, capacityTons: true } },
        payment: true,
      },
    });
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    return res.status(200).json({ booking });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// TRUCKS
// ─────────────────────────────────────────
export const getAllTrucks = async (req: AuthRequest, res: Response) => {
  try {
    const { type, verified, search, page = "1" } = req.query;
    const take = 50;
    const skip = (parseInt(page as string, 10) - 1) * take;

    const where: any = {
      ...(type && { truckType: type as any }),
      ...(verified === "true" && { isVerified: true }),
      ...(verified === "false" && { isVerified: false }),
    };
    if (search) {
      where.OR = [
        { plateNumber: { contains: search as string, mode: "insensitive" } },
        { owner: { fullName: { contains: search as string, mode: "insensitive" } } },
      ];
    }

    const [trucks, total] = await Promise.all([
      prisma.truck.findMany({
        where,
        include: {
          owner: { select: { id: true, fullName: true, phone: true, isVerified: true } },
        },
        orderBy: { createdAt: "desc" },
        take, skip,
      }),
      prisma.truck.count({ where }),
    ]);

    return res.status(200).json({ trucks, total, page: parseInt(page as string, 10), totalPages: Math.ceil(total / take) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getTruck = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const truck = await prisma.truck.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, fullName: true, phone: true, email: true, isVerified: true } },
        bookings: { select: { id: true, status: true, agreedPrice: true, createdAt: true }, take: 10, orderBy: { createdAt: "desc" } },
      },
    });
    if (!truck) return res.status(404).json({ message: "Truck not found" });
    return res.status(200).json({ truck });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const verifyTruck = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const truck = await prisma.truck.findUnique({ where: { id }, include: { owner: true } });
    if (!truck) return res.status(404).json({ message: "Truck not found" });

    await prisma.truck.update({ where: { id }, data: { isVerified: true } });
    await notify(truck.ownerId, "ACCOUNT_VERIFIED", "Truck Verified", `Your truck ${truck.plateNumber} has been verified and is ready for bookings.`);

    return res.status(200).json({ message: "Truck verified" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// DOCUMENTS
// ─────────────────────────────────────────
export const getAllDocuments = async (req: AuthRequest, res: Response) => {
  try {
    const { status = "PENDING", page = "1" } = req.query;
    const take = 50;
    const skip = (parseInt(page as string, 10) - 1) * take;

    const where: any = { ...(status && { status: status as any }) };

    const [documents, total] = await Promise.all([
      prisma.verificationDocument.findMany({
        where,
        include: {
          senderProfile: { include: { user: { select: { id: true, fullName: true, phone: true, role: true } } } },
          truckOwnerProfile: { include: { user: { select: { id: true, fullName: true, phone: true, role: true } } } },
        },
        orderBy: { uploadedAt: "asc" },
        take, skip,
      }),
      prisma.verificationDocument.count({ where }),
    ]);

    // Flatten user info for frontend convenience
    const docs = documents.map((d: any) => ({
      ...d,
      user: d.senderProfile?.user || d.truckOwnerProfile?.user || null,
    }));

    return res.status(200).json({ documents: docs, total, page: parseInt(page as string, 10), totalPages: Math.ceil(total / take) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const doc = await prisma.verificationDocument.findUnique({
      where: { id },
      include: {
        senderProfile: { include: { user: { select: { id: true, fullName: true, phone: true, role: true, email: true } } } },
        truckOwnerProfile: { include: { user: { select: { id: true, fullName: true, phone: true, role: true, email: true } } } },
      },
    });
    if (!doc) return res.status(404).json({ message: "Document not found" });

    // Generate presigned URL for viewing
    let presignedUrl = doc.fileUrl;
    try {
      const { getPresignedUrl } = await import("../utils/s3");
      presignedUrl = await getPresignedUrl(doc.fileUrl, 900);
    } catch (e) {
      console.warn("Could not generate presigned URL, returning raw URL");
    }

    return res.status(200).json({
      document: {
        ...doc,
        presignedUrl,
        user: doc.senderProfile?.user || doc.truckOwnerProfile?.user || null,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const approveDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const doc = await prisma.verificationDocument.findUnique({
      where: { id },
      include: {
        senderProfile: { include: { user: true } },
        truckOwnerProfile: { include: { user: true } },
      },
    });
    if (!doc) return res.status(404).json({ message: "Document not found" });

    await prisma.verificationDocument.update({
      where: { id },
      data: { status: "APPROVED", reviewedBy: req.user!.userId, reviewedAt: new Date() },
    });

    const userId = doc.senderProfile?.user?.id || doc.truckOwnerProfile?.user?.id;
    if (userId) {
      await notify(userId, "ACCOUNT_VERIFIED", "Document Approved", `Your ${doc.documentType.replace(/_/g, " ").toLowerCase()} has been approved.`);

      // Check if all documents for this user are now approved — if so, auto-verify
      const profileId = doc.senderProfileId || doc.truckOwnerProfileId;
      if (profileId) {
        const allDocs = await prisma.verificationDocument.findMany({
          where: doc.senderProfileId
            ? { senderProfileId: profileId }
            : { truckOwnerProfileId: profileId },
        });
        const allApproved = allDocs.every((d: { id: string; status: string }) => d.id === id ? true : d.status === "APPROVED");
        if (allApproved && allDocs.length > 0) {
          if (doc.senderProfileId) {
            await prisma.senderProfile.update({
              where: { id: profileId },
              data: { verificationStatus: "APPROVED", verifiedAt: new Date() },
            });
          } else {
            await prisma.truckOwnerProfile.update({
              where: { id: profileId },
              data: { verificationStatus: "APPROVED", verifiedAt: new Date() },
            });
          }
          await prisma.user.update({ where: { id: userId }, data: { isVerified: true, status: "ACTIVE" } });
          await notify(userId, "ACCOUNT_VERIFIED", "Fully Verified!", "All your documents have been approved. Your account is now fully verified.");
        }
      }
    }

    return res.status(200).json({ message: "Document approved" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const rejectDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ message: "Rejection reason is required" });

    const doc = await prisma.verificationDocument.findUnique({
      where: { id },
      include: {
        senderProfile: { include: { user: true } },
        truckOwnerProfile: { include: { user: true } },
      },
    });
    if (!doc) return res.status(404).json({ message: "Document not found" });

    await prisma.verificationDocument.update({
      where: { id },
      data: { status: "REJECTED", rejectionReason: reason, reviewedBy: req.user!.userId, reviewedAt: new Date() },
    });

    const userId = doc.senderProfile?.user?.id || doc.truckOwnerProfile?.user?.id;
    if (userId) {
      await notify(userId, "ACCOUNT_VERIFIED", "Document Rejected", `Your ${doc.documentType.replace(/_/g, " ").toLowerCase()} was rejected: ${reason}`);
    }

    return res.status(200).json({ message: "Document rejected" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
