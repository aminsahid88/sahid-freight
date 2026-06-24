import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const JWT_SECRET = process.env.JWT_SECRET!;

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

// ─────────────────────────────────────────
// PROTECT — any logged in user
// ─────────────────────────────────────────
export const protect = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    const token = authHeader.split(" ")[1];
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; role: string };

    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Not authorized, invalid token" });
  }
};

// ─────────────────────────────────────────
// ADMIN ONLY
// ─────────────────────────────────────────
export const adminOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ message: "Access denied, admins only" });
  }
  next();
};

// ─────────────────────────────────────────
// TRUCK OWNER ONLY
// ─────────────────────────────────────────
export const truckOwnerOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== "TRUCK_OWNER") {
    return res.status(403).json({ message: "Access denied, truck owners only" });
  }
  next();
};

// ─────────────────────────────────────────
// FLEET MANAGER — truck owners OR cargo senders
// ─────────────────────────────────────────
export const fleetManagerOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!["TRUCK_OWNER", "CARGO_SENDER"].includes(req.user?.role || "")) {
    return res.status(403).json({ message: "Access denied, truck owners and cargo senders only" });
  }
  next();
};

// ─────────────────────────────────────────
// TRUCK OWNER OR BROKER — for direct-assignment booking creation
// ─────────────────────────────────────────
export const truckOwnerOrBrokerOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!["TRUCK_OWNER", "BROKER"].includes(req.user?.role || "")) {
    return res.status(403).json({ message: "Access denied, truck owners and brokers only" });
  }
  next();
};

// ─────────────────────────────────────────
// BROKER ONLY — broker dispatch endpoints (cross-owner truck marketplace)
// ─────────────────────────────────────────
export const brokerOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== "BROKER") {
    return res.status(403).json({ message: "Access denied, brokers only" });
  }
  next();
};

// ─────────────────────────────────────────
// CARGO SENDER ONLY
// ─────────────────────────────────────────
export const cargoSenderOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== "CARGO_SENDER") {
    return res.status(403).json({ message: "Only cargo sender accounts can post loads. If you need to ship cargo, please register a separate cargo sender account." });
  }
  next();
};
