import { Response } from "express";
import prisma from "../utils/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

// ─────────────────────────────────────────
// POST A LOAD
// ─────────────────────────────────────────
const VALID_TRUCK_TYPES = ["FLATBED", "REFRIGERATED", "TANKER", "CONTAINER", "OPEN_BODY", "MINI_TRUCK"];
const VALID_COUNTRIES   = ["ETHIOPIA", "SOMALIA", "DJIBOUTI"];

export const createLoad = async (req: AuthRequest, res: Response) => {
  try {
    console.log("createLoad — user:", req.user?.userId, "role:", req.user?.role);

    // Role guard (belt-and-suspenders alongside route middleware)
    if (req.user?.role !== "CARGO_SENDER") {
      return res.status(403).json({ message: "Only cargo sender accounts can post loads." });
    }

    // Verification check
    const sender = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!sender?.isVerified) {
      return res.status(403).json({ message: "Your account must be verified before posting loads." });
    }

    const {
      title, description, weightTons, truckTypeNeeded,
      pickupCity, pickupCountry, pickupLat, pickupLng,
      deliveryCity, deliveryCountry, deliveryLat, deliveryLng,
      offeredPrice, currency, scheduledDate,
    } = req.body;

    // ── Validate required fields ──
    const missing: string[] = [];
    if (!title?.trim())         missing.push("title");
    if (!pickupCity?.trim())    missing.push("pickupCity");
    if (!deliveryCity?.trim())  missing.push("deliveryCity");
    if (!scheduledDate)         missing.push("scheduledDate");
    if (!truckTypeNeeded)       missing.push("truckTypeNeeded");
    if (!pickupCountry)         missing.push("pickupCountry");
    if (!deliveryCountry)       missing.push("deliveryCountry");
    if (missing.length > 0) {
      return res.status(400).json({ message: `Missing required fields: ${missing.join(", ")}` });
    }

    // ── Validate enums ──
    if (!VALID_TRUCK_TYPES.includes(truckTypeNeeded)) {
      return res.status(400).json({ message: `Invalid truck type: ${truckTypeNeeded}` });
    }
    if (!VALID_COUNTRIES.includes(pickupCountry)) {
      return res.status(400).json({ message: `Invalid pickup country: ${pickupCountry}` });
    }
    if (!VALID_COUNTRIES.includes(deliveryCountry)) {
      return res.status(400).json({ message: `Invalid delivery country: ${deliveryCountry}` });
    }

    // ── Validate numerics ──
    const parsedWeight = Number(weightTons);
    const parsedPrice  = Number(offeredPrice);
    if (isNaN(parsedWeight) || parsedWeight <= 0) {
      return res.status(400).json({ message: "Invalid weight — must be a positive number." });
    }
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ message: "Invalid price — must be a positive number." });
    }

    // ── Validate date ──
    const parsedDate = new Date(scheduledDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: "Invalid scheduled date." });
    }

    const load = await prisma.load.create({
      data: {
        senderId: req.user!.userId,
        title: title.trim(),
        description: description?.trim() || null,
        weightTons: parsedWeight,
        truckTypeNeeded,
        pickupCity: pickupCity.trim(),
        pickupCountry,
        pickupLat:  pickupLat  != null ? Number(pickupLat)  : null,
        pickupLng:  pickupLng  != null ? Number(pickupLng)  : null,
        deliveryCity: deliveryCity.trim(),
        deliveryCountry,
        deliveryLat: deliveryLat != null ? Number(deliveryLat) : null,
        deliveryLng: deliveryLng != null ? Number(deliveryLng) : null,
        offeredPrice: parsedPrice,
        currency: currency || "USD",
        scheduledDate: parsedDate,
      },
    });

    // Auto-notify truck owners whose currentCity matches pickupCity
    try {
      const nearbyTrucks = await prisma.truck.findMany({
        where: { isAvailable: true, owner: { isVerified: true }, currentCity: { equals: pickupCity.trim(), mode: "insensitive" } },
        include: { owner: { select: { id: true } } },
        take: 20,
      });
      const ownerIds = [...new Set(nearbyTrucks.map(t => t.owner.id))];
      const { notify } = await import("../utils/notify");
      await Promise.all(ownerIds.map(ownerId =>
        notify(ownerId, "NEW_LOAD", "New Load Near You", `A new load is available in ${pickupCity}: "${load.title}" — ${load.weightTons}t to ${load.deliveryCity}`)
      ));
    } catch (notifyErr) {
      console.error("createLoad — notify nearby trucks failed:", notifyErr);
    }

    console.log("createLoad — success, id:", load.id);
    return res.status(201).json({ message: "Load posted successfully", load });
  } catch (error: any) {
    console.error("createLoad — error:", error?.message, error?.code, JSON.stringify(error?.meta));
    return res.status(500).json({ message: "Something went wrong while posting the load." });
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
        _count: { select: { bids: true } },
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
        bids: {
          include: {
            truckOwner: { select: { id: true, fullName: true, phone: true, isVerified: true } },
          },
          orderBy: { createdAt: "desc" },
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
      include: { _count: { select: { bids: true } } },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ loads });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// UPDATE A LOAD (sender only, OPEN/DRAFT)
// ─────────────────────────────────────────
export const updateLoad = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const load = await prisma.load.findUnique({ where: { id } });
    if (!load) return res.status(404).json({ message: "Load not found" });
    if (load.senderId !== req.user!.userId) return res.status(403).json({ message: "Not your load" });
    if (!["OPEN", "DRAFT"].includes(load.status)) {
      return res.status(400).json({ message: "Only open or draft loads can be edited" });
    }

    const {
      title, description, weightTons, truckTypeNeeded,
      pickupCity, pickupCountry, pickupLat, pickupLng,
      deliveryCity, deliveryCountry, deliveryLat, deliveryLng,
      offeredPrice, currency, scheduledDate,
    } = req.body;

    // Validate enums if provided
    if (truckTypeNeeded && !VALID_TRUCK_TYPES.includes(truckTypeNeeded)) {
      return res.status(400).json({ message: `Invalid truck type: ${truckTypeNeeded}` });
    }
    if (pickupCountry && !VALID_COUNTRIES.includes(pickupCountry)) {
      return res.status(400).json({ message: `Invalid pickup country: ${pickupCountry}` });
    }
    if (deliveryCountry && !VALID_COUNTRIES.includes(deliveryCountry)) {
      return res.status(400).json({ message: `Invalid delivery country: ${deliveryCountry}` });
    }

    // Build update data — only include fields that were sent
    const data: any = {};
    if (title !== undefined)           data.title = title.trim();
    if (description !== undefined)     data.description = description?.trim() || null;
    if (weightTons !== undefined) {
      const w = Number(weightTons);
      if (isNaN(w) || w <= 0) return res.status(400).json({ message: "Invalid weight" });
      data.weightTons = w;
    }
    if (offeredPrice !== undefined) {
      const p = Number(offeredPrice);
      if (isNaN(p) || p <= 0) return res.status(400).json({ message: "Invalid price" });
      data.offeredPrice = p;
    }
    if (truckTypeNeeded !== undefined) data.truckTypeNeeded = truckTypeNeeded;
    if (pickupCity !== undefined)      data.pickupCity = pickupCity.trim();
    if (pickupCountry !== undefined)   data.pickupCountry = pickupCountry;
    if (pickupLat !== undefined)       data.pickupLat = pickupLat != null ? Number(pickupLat) : null;
    if (pickupLng !== undefined)       data.pickupLng = pickupLng != null ? Number(pickupLng) : null;
    if (deliveryCity !== undefined)    data.deliveryCity = deliveryCity.trim();
    if (deliveryCountry !== undefined) data.deliveryCountry = deliveryCountry;
    if (deliveryLat !== undefined)     data.deliveryLat = deliveryLat != null ? Number(deliveryLat) : null;
    if (deliveryLng !== undefined)     data.deliveryLng = deliveryLng != null ? Number(deliveryLng) : null;
    if (currency !== undefined)        data.currency = currency;
    if (scheduledDate !== undefined) {
      const d = new Date(scheduledDate);
      if (isNaN(d.getTime())) return res.status(400).json({ message: "Invalid scheduled date" });
      data.scheduledDate = d;
    }

    const updated = await prisma.load.update({ where: { id }, data });
    return res.status(200).json({ message: "Load updated", load: updated });
  } catch (error: any) {
    console.error("updateLoad — error:", error?.message);
    return res.status(500).json({ message: "Something went wrong while updating the load." });
  }
};

// ─────────────────────────────────────────
// DELETE A LOAD (sender only, OPEN/DRAFT/CANCELLED)
// ─────────────────────────────────────────
export const deleteLoad = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const load = await prisma.load.findUnique({ where: { id } });
    if (!load) return res.status(404).json({ message: "Load not found" });
    if (load.senderId !== req.user!.userId) return res.status(403).json({ message: "Not your load" });
    if (!["OPEN", "DRAFT", "CANCELLED"].includes(load.status)) {
      return res.status(400).json({ message: "Only open, draft, or cancelled loads can be deleted" });
    }

    // Delete related bids first (FK constraint)
    await prisma.bid.deleteMany({ where: { loadId: id } });
    await prisma.load.delete({ where: { id } });

    return res.status(200).json({ message: "Load deleted" });
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

// ─────────────────────────────────────────
// PRICE SUGGESTION
// Returns min/max/avg price of recent similar loads
// ─────────────────────────────────────────
export const getPriceSuggestion = async (req: AuthRequest, res: Response) => {
  try {
    const { truckType, pickupCountry, deliveryCountry } = req.query;

    const loads = await prisma.load.findMany({
      where: {
        status: { in: ["BOOKED", "IN_TRANSIT", "DELIVERED"] as any },
        ...(truckType      && { truckTypeNeeded: truckType as any }),
        ...(pickupCountry  && { pickupCountry:   pickupCountry  as any }),
        ...(deliveryCountry && { deliveryCountry: deliveryCountry as any }),
      },
      select: { offeredPrice: true },
      take: 50,
      orderBy: { createdAt: "desc" },
    });

    if (loads.length === 0) return res.json({ count: 0 });

    const prices = loads.map(l => l.offeredPrice);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);

    return res.json({ count: loads.length, min, max, avg });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ─────────────────────────────────────────
// SUGGESTED TRUCKS (return load matching)
// Finds verified truck owners whose currentCity matches the pickupCity
// ─────────────────────────────────────────
export const getSuggestedTrucks = async (req: AuthRequest, res: Response) => {
  try {
    const { pickupCity } = req.query as { pickupCity: string };
    if (!pickupCity) return res.status(400).json({ message: "pickupCity is required" });

    // Find trucks whose currentCity case-insensitively matches pickupCity
    const trucks = await prisma.truck.findMany({
      where: {
        isAvailable: true,
        owner: { isVerified: true },
        currentCity: { equals: pickupCity, mode: "insensitive" },
      },
      include: {
        owner: {
          select: { id: true, fullName: true, phone: true, averageRating: true, totalRatings: true },
        },
      },
      take: 5,
    });

    return res.status(200).json({ trucks });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
