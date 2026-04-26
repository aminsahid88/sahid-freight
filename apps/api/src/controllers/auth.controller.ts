import { sendOTPEmail } from "../utils/email";
import { sendSMS } from "../utils/sms";
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";
import prisma from "../utils/prisma";
import { OAuth2Client } from "google-auth-library";
import * as appleSignin from "apple-signin-auth";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

// In-memory OTP store (replace with Redis or DB in production)
const otpStore: Record<string, { otp: string; expiresAt: number }> = {};

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

export const sendOtp = async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone number required" });

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return res.status(404).json({ message: "Phone number not registered" });
    if (user.status === "ACTIVE") return res.status(400).json({ message: "Account already verified" });

    const otp = generateOTP();
    otpStore[phone] = { otp, expiresAt: Date.now() + 10 * 60 * 1000 }; // 10 min

    if (user.email) { try { await sendOTPEmail(user.email, otp); } catch (emailError) { console.error("Email OTP failed:", emailError); } } else { console.log(`📱 OTP for ${phone}: ${otp}`); }

    return res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ message: "Phone and OTP required" });

    const stored = otpStore[phone];
    if (!stored) return res.status(400).json({ message: "No OTP found. Please request a new one." });
    if (Date.now() > stored.expiresAt) {
      delete otpStore[phone];
      return res.status(400).json({ message: "OTP expired. Please request a new one." });
    }
    if (stored.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });

    // Mark user as active
    const user = await prisma.user.update({
      where: { phone },
      data: { status: "ACTIVE" },
    });

    delete otpStore[phone];

    const accessToken = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: "30d" });
    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });

    return res.status(200).json({
      message: "Phone verified successfully",
      accessToken,
      refreshToken,
      user: { id: user.id, fullName: user.fullName, phone: user.phone, email: user.email, role: user.role, status: user.status, country: user.country, city: user.city, isVerified: user.isVerified },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { fullName, email, phone, password, role, country, city, preferredLanguage } = req.body;
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) return res.status(400).json({ message: "Phone number already registered" });
    if (email) {
      const existingEmail = await prisma.user.findUnique({ where: { email } });
      if (existingEmail) return res.status(400).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { fullName, email, phone, passwordHash, role, country, city, preferredLanguage: preferredLanguage || "EN" },
    });

    if (role === "CARGO_SENDER") {
      await prisma.senderProfile.create({
        data: { userId: user.id, senderType: req.body.senderType || "INDIVIDUAL", organizationName: req.body.organizationName || null },
      });
    }
    if (role === "TRUCK_OWNER") {
      await prisma.truckOwnerProfile.create({ data: { userId: user.id } });
    }

    // Auto-send OTP after registration
    const otp = generateOTP();
    otpStore[phone] = { otp, expiresAt: Date.now() + 10 * 60 * 1000 };
    if (user.email) { try { await sendOTPEmail(user.email, otp); } catch (emailError) { console.error("Email OTP failed:", emailError); } } else { console.log(`📱 OTP for ${phone}: ${otp}`); }

    const accessToken = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: "30d" });
    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });

    return res.status(201).json({
      message: "Account created successfully",
      accessToken,
      refreshToken,
      user: { id: user.id, fullName: user.fullName, phone: user.phone, email: user.email, role: user.role, status: user.status, country: user.country, city: user.city, isVerified: user.isVerified },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return res.status(401).json({ message: "Invalid phone or password" });
    if (!user.passwordHash) return res.status(401).json({ message: "Invalid credentials" });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ message: "Invalid phone or password" });
    if (user.status === "SUSPENDED") return res.status(403).json({ message: "Your account has been suspended" });

    const accessToken = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: "30d" });
    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });

    return res.status(200).json({
      message: "Login successful",
      accessToken,
      refreshToken,
      user: { id: user.id, fullName: user.fullName, phone: user.phone, email: user.email, role: user.role, status: user.status, country: user.country, city: user.city, isVerified: user.isVerified },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

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

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone number required" });

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return res.status(404).json({ message: "No account found with this phone number" });

    const otp = generateOTP();
    otpStore[phone] = { otp, expiresAt: Date.now() + 10 * 60 * 1000 };

    if (user.email) {
      try { await sendOTPEmail(user.email, otp); } catch (e) { console.error("Email failed:", e); }
    } else {
      console.log(`🔑 Reset OTP for ${phone}: ${otp}`);
    }

    return res.status(200).json({ message: "Reset code sent to your email" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { phone, otp, newPassword } = req.body;
    if (!phone || !otp || !newPassword) return res.status(400).json({ message: "All fields required" });

    const stored = otpStore[phone];
    if (!stored) return res.status(400).json({ message: "No reset code found. Please request a new one." });
    if (Date.now() > stored.expiresAt) {
      delete otpStore[phone];
      return res.status(400).json({ message: "Code expired. Please request a new one." });
    }
    if (stored.otp !== otp) return res.status(400).json({ message: "Invalid code" });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { phone }, data: { passwordHash } });
    delete otpStore[phone];

    return res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// ── HELPER ─────────────────────────────────────────────────────────────────
const issueTokens = async (userId: string, role: string) => {
  const accessToken = jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: "7d" });
  const refreshToken = jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: "30d" });
  await prisma.refreshToken.create({
    data: { token: refreshToken, userId, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  });
  return { accessToken, refreshToken };
};

// ── GOOGLE SIGN IN ─────────────────────────────────────────────────────────
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
      // Create minimal user — role will be set in RoleSelectionScreen
      user = await prisma.user.create({
        data: {
          fullName: name || "Google User",
          email: email || null,
          phone: `google_${googleId}`,
          googleId,
          role: "CARGO_SENDER", // temporary, UI will prompt for real role
          status: "ACTIVE",
          country: "ETHIOPIA",
          city: "",
        },
      });
    } else if (!user.googleId) {
      user = await prisma.user.update({ where: { id: user.id }, data: { googleId } });
    }

    const { accessToken, refreshToken } = await issueTokens(user.id, user.role);

    return res.status(200).json({
      message: isNewUser ? "Account created" : "Login successful",
      accessToken,
      refreshToken,
      isNewUser,
      user: { id: user.id, fullName: user.fullName, phone: user.phone, email: user.email, role: user.role, status: user.status, country: user.country, city: user.city, isVerified: user.isVerified },
    });
  } catch (error) {
    console.error("Google auth error:", error);
    return res.status(500).json({ message: "Google authentication failed" });
  }
};

// ── APPLE SIGN IN ──────────────────────────────────────────────────────────
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
          fullName: fullName || "Apple User",
          email: email || null,
          phone: `apple_${appleId}`,
          appleId,
          role: "CARGO_SENDER", // temporary
          status: "ACTIVE",
          country: "ETHIOPIA",
          city: "",
        },
      });
    } else if (!user.appleId) {
      user = await prisma.user.update({ where: { id: user.id }, data: { appleId } });
    }

    const { accessToken, refreshToken } = await issueTokens(user.id, user.role);

    return res.status(200).json({
      message: isNewUser ? "Account created" : "Login successful",
      accessToken,
      refreshToken,
      isNewUser,
      user: { id: user.id, fullName: user.fullName, phone: user.phone, email: user.email, role: user.role, status: user.status, country: user.country, city: user.city, isVerified: user.isVerified },
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

    // Delete in dependency order
    await prisma.notification.deleteMany({ where: { userId } });
    await prisma.refreshToken.deleteMany({ where: { userId } });
    await prisma.bid.deleteMany({ where: { truckOwnerId: userId } });

    // Loads and bookings — cancel/soft delete
    await prisma.load.updateMany({ where: { senderId: userId, status: { in: ["OPEN", "DRAFT"] } }, data: { status: "CANCELLED" } });

    // Remove profile documents
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

// ── SET ROLE (for social login new users) ──────────────────────────────────
export const setRole = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { role, country, city } = req.body;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!role || !["CARGO_SENDER", "TRUCK_OWNER"].includes(role)) {
      return res.status(400).json({ message: "Valid role required: CARGO_SENDER or TRUCK_OWNER" });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role, country: country || "ETHIOPIA", city: city || "" },
    });

    if (role === "CARGO_SENDER") {
      await prisma.senderProfile.upsert({
        where: { userId },
        create: { userId, senderType: "INDIVIDUAL" },
        update: {},
      });
    }
    if (role === "TRUCK_OWNER") {
      await prisma.truckOwnerProfile.upsert({
        where: { userId },
        create: { userId },
        update: {},
      });
    }

    return res.status(200).json({
      message: "Role set successfully",
      user: { id: user.id, fullName: user.fullName, role: user.role, country: user.country, city: user.city },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
