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
// CARGO SENDER ONLY
// ─────────────────────────────────────────
export const cargoSenderOnly = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== "CARGO_SENDER") {
    return res.status(403).json({ message: "Access denied, cargo senders only" });
  }
  next();
};
