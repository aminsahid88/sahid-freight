import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";
import prisma from "../utils/prisma";
import { verifyFirebaseToken } from "../utils/firebase";
import { OAuth2Client } from "google-auth-library";
import * as appleSignin from "apple-signin-auth";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

// ── HELPER ─────────────────────────────────────────────────────────────────
const issueTokens = async (userId: string, role: string) => {
  const accessToken = jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "7d" });
  const refreshToken = jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: "30d" });
  await prisma.refreshToken.create({
    data: { token: refreshToken, userId, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  });
  return { accessToken, refreshToken };
};

const userPayload = (user: any) => ({
  id: user.id, fullName: user.fullName, phone: user.phone, email: user.email,
  role: user.role, status: user.status, country: user.country, city: user.city,
  isVerified: user.isVerified, phoneVerified: user.phoneVerified,
  averageRating: user.averageRating, totalRatings: user.totalRatings,
});

// ── REGISTER (Firebase phone-verified) ────────────────────────────────────
export const register = async (req: Request, res: Response) => {
  try {
    const { firebaseIdToken, fullName, password, role, country, city } = req.body;

    if (!firebaseIdToken || !fullName || !password || !role) {
      return res.status(400).json({ message: "firebaseIdToken, fullName, password and role are required" });
    }

    // Verify Firebase token to get the verified phone number
    let phone: string;
    let firebaseUid: string;
    try {
      const result = await verifyFirebaseToken(firebaseIdToken);
      phone = result.phone;
      firebaseUid = result.uid;
    } catch (err: any) {
      console.error("Firebase token verification failed:", err);
      return res.status(401).json({ message: "Phone verification failed. Please try again." });
    }

    // Check for existing user
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) return res.status(400).json({ message: "Phone number already registered. Please log in instead." });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        fullName, phone, passwordHash, role,
        country: country || "ETHIOPIA",
        city: city || "",
        firebaseUid,
        phoneVerified: true,
        status: "ACTIVE",
        isVerified: false,
      },
    });

    // Create role-specific profile (non-critical)
    try {
      if (role === "CARGO_SENDER") {
        await prisma.senderProfile.create({ data: { userId: user.id, senderType: "INDIVIDUAL" } });
      }
      if (role === "TRUCK_OWNER") {
        await prisma.truckOwnerProfile.create({ data: { userId: user.id } });
      }
    } catch (err) { console.error("Profile creation failed (user still created):", err); }

    // Best-effort driver-invite auto-link. If a non-expired PENDING invite exists
    // for this phone, link the new driver to the inviting owner's fleet.
    // MUST NOT throw — registration succeeds even if linking fails.
    if (role === "DRIVER") {
      try {
        const invite = await prisma.driverInvite.findFirst({
          where: {
            phone,
            status: "PENDING",
            expiresAt: { gt: new Date() },
          },
          orderBy: { createdAt: "desc" },
        });
        if (invite) {
          await prisma.$transaction([
            prisma.user.update({
              where: { id: user.id },
              data: { invitedById: invite.ownerId },
            }),
            prisma.driverInvite.update({
              where: { id: invite.id },
              data: {
                status: "ACCEPTED",
                acceptedByUserId: user.id,
                acceptedAt: new Date(),
              },
            }),
          ]);
        }
      } catch (err) {
        console.error("Driver auto-link failed (registration still succeeded):", err);
      }
    }

    const { accessToken, refreshToken } = await issueTokens(user.id, user.role);

    return res.status(201).json({
      message: "Account created successfully",
      accessToken, refreshToken,
      user: userPayload(user),
    });
  } catch (error) {
    console.error("register failed:", error);
    return res.status(500).json({ message: "Failed to create account. Please try again." });
  }
};

// ── LOGIN (phone + password, no Firebase) ─────────────────────────────────
export const login = async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ message: "Phone and password required" });

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return res.status(401).json({ message: "Invalid phone or password" });
    if (!user.passwordHash) return res.status(401).json({ message: "This account uses social login. Please sign in with Google or Apple." });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ message: "Invalid phone or password" });
    if (user.status === "SUSPENDED") return res.status(403).json({ message: "Your account has been suspended" });

    const { accessToken, refreshToken } = await issueTokens(user.id, user.role);

    return res.status(200).json({
      message: "Login successful",
      accessToken, refreshToken,
      user: userPayload(user),
    });
  } catch (error) {
    console.error("login failed:", error);
    return res.status(500).json({ message: "Failed to log in. Please try again." });
  }
};

// ── RESET PASSWORD (Firebase phone-verified) ──────────────────────────────
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { firebaseIdToken, newPassword } = req.body;
    if (!firebaseIdToken || !newPassword) {
      return res.status(400).json({ message: "firebaseIdToken and newPassword required" });
    }

    let phone: string;
    try {
      const result = await verifyFirebaseToken(firebaseIdToken);
      phone = result.phone;
    } catch (err: any) {
      console.error("Firebase token verification failed:", err);
      return res.status(401).json({ message: "Phone verification failed. Please try again." });
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return res.status(404).json({ message: "No account found with this phone number" });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const updated = await prisma.user.update({
      where: { phone },
      data: { passwordHash, phoneVerified: true },
    });

    const { accessToken, refreshToken } = await issueTokens(updated.id, updated.role);

    return res.status(200).json({
      message: "Password reset successfully",
      accessToken, refreshToken,
      user: userPayload(updated),
    });
  } catch (error) {
    console.error("resetPassword failed:", error);
    return res.status(500).json({ message: "Failed to reset password. Please try again." });
  }
};

// ── LOGOUT ────────────────────────────────────────────────────────────────
export const logout = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ── REFRESH TOKEN ─────────────────────────────────────────────────────────
export const refresh = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored) return res.status(401).json({ message: "Invalid refresh token" });
    const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return res.status(401).json({ message: "User not found" });
    const accessToken = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    return res.status(200).json({ accessToken });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ message: "Invalid or expired refresh token" });
  }
};

// ── GOOGLE SIGN IN ────────────────────────────────────────────────────────
export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: "idToken required" });

    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub) return res.status(400).json({ message: "Invalid Google token" });

    const { sub: googleId, email, name } = payload;

    let user = await prisma.user.findUnique({ where: { googleId } });
    if (!user && email) user = await prisma.user.findUnique({ where: { email } });

    const isNewUser = !user;

    if (!user) {
      user = await prisma.user.create({
        data: {
          fullName: name || "Google User", email: email || null,
          phone: `google_${googleId}`, googleId,
          role: "CARGO_SENDER", status: "ACTIVE", country: "ETHIOPIA", city: "",
        },
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({ where: { id: user.id }, data: { googleId } });
    }

    const { accessToken, refreshToken } = await issueTokens(user.id, user.role);

    return res.status(200).json({
      message: isNewUser ? "Account created" : "Login successful",
      accessToken, refreshToken, isNewUser,
      user: userPayload(user),
    });
  } catch (error) {
    console.error("Google auth error:", error);
    return res.status(500).json({ message: "Google authentication failed" });
  }
};

// ── APPLE SIGN IN ─────────────────────────────────────────────────────────
export const appleAuth = async (req: Request, res: Response) => {
  try {
    const { identityToken, fullName } = req.body;
    if (!identityToken) return res.status(400).json({ message: "identityToken required" });

    const applePayload = await appleSignin.verifyIdToken(identityToken, {
      audience: process.env.APPLE_BUNDLE_ID || "com.sahidfreight.app",
      ignoreExpiration: false,
    });

    const { sub: appleId, email } = applePayload;

    let user = await prisma.user.findUnique({ where: { appleId } });
    if (!user && email) user = await prisma.user.findUnique({ where: { email } });

    const isNewUser = !user;

    if (!user) {
      user = await prisma.user.create({
        data: {
          fullName: fullName || "Apple User", email: email || null,
          phone: `apple_${appleId}`, appleId,
          role: "CARGO_SENDER", status: "ACTIVE", country: "ETHIOPIA", city: "",
        },
      });
    } else if (!user.appleId) {
      user = await prisma.user.update({ where: { id: user.id }, data: { appleId } });
    }

    const { accessToken, refreshToken } = await issueTokens(user.id, user.role);

    return res.status(200).json({
      message: isNewUser ? "Account created" : "Login successful",
      accessToken, refreshToken, isNewUser,
      user: userPayload(user),
    });
  } catch (error) {
    console.error("Apple auth error:", error);
    return res.status(500).json({ message: "Apple authentication failed" });
  }
};

// ── DELETE ACCOUNT ─────────────────────────────────────────────────────────
export const deleteAccount = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma.bid.deleteMany({ where: { truckOwnerId: userId } });
    await prisma.load.updateMany({ where: { senderId: userId, status: { in: ["OPEN", "DRAFT"] } }, data: { status: "CANCELLED" } });

    const senderProfile = await prisma.senderProfile.findUnique({ where: { userId } });
    if (senderProfile) {
      await prisma.verificationDocument.deleteMany({ where: { senderProfileId: senderProfile.id } });
      await prisma.senderProfile.delete({ where: { userId } });
    }
    const ownerProfile = await prisma.truckOwnerProfile.findUnique({ where: { userId } });
    if (ownerProfile) {
      await prisma.verificationDocument.deleteMany({ where: { truckOwnerProfileId: ownerProfile.id } });
      await prisma.truckOwnerProfile.delete({ where: { userId } });
    }

    await prisma.user.delete({ where: { id: userId } });

    return res.status(200).json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Delete account error:", error);
    return res.status(500).json({ message: "Failed to delete account" });
  }
};

// ── SET ROLE (for social login new users) ─────────────────────────────────
export const setRole = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { role, country, city } = req.body;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!role || !["CARGO_SENDER", "TRUCK_OWNER", "DRIVER"].includes(role)) {
      return res.status(400).json({ message: "Valid role required: CARGO_SENDER, TRUCK_OWNER, or DRIVER" });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role, country: country || "ETHIOPIA", city: city || "" },
    });

    try {
      if (role === "CARGO_SENDER") {
        await prisma.senderProfile.upsert({ where: { userId }, create: { userId, senderType: "INDIVIDUAL" }, update: {} });
      }
      if (role === "TRUCK_OWNER") {
        await prisma.truckOwnerProfile.upsert({ where: { userId }, create: { userId }, update: {} });
      }
    } catch (err) { console.error("Profile upsert failed:", err); }

    return res.status(200).json({
      message: "Role set successfully",
      user: userPayload(user),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ── ADMIN LOGIN (email + password, separate from mobile) ─────────────────
export const adminLogin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });

    const user = await prisma.user.findFirst({ where: { email, role: "ADMIN" } });
    if (!user) return res.status(401).json({ message: "Invalid email or password" });
    if (!user.passwordHash) return res.status(401).json({ message: "No password set for this account" });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ message: "Invalid email or password" });

    const { accessToken, refreshToken } = await issueTokens(user.id, user.role);

    return res.status(200).json({
      message: "Admin login successful",
      accessToken, refreshToken,
      user: userPayload(user),
    });
  } catch (error) {
    console.error("admin login failed:", error);
    return res.status(500).json({ message: "Failed to log in" });
  }
};

// Legacy exports kept for backward compat with routes that reference them
export const sendOtp = async (_req: Request, res: Response) => {
  return res.status(410).json({ message: "OTP is now handled by Firebase. Please update your app." });
};
export const verifyOtp = async (_req: Request, res: Response) => {
  return res.status(410).json({ message: "OTP is now handled by Firebase. Please update your app." });
};
export const forgotPassword = async (_req: Request, res: Response) => {
  return res.status(410).json({ message: "Password reset now uses Firebase phone verification. Please update your app." });
};
