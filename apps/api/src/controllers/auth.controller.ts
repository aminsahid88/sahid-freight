import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomInt } from "crypto";
import dotenv from "dotenv";
import path from "path";
import prisma from "../utils/prisma";
import { verifyFirebaseToken } from "../utils/firebase";
import { sendOTPEmail } from "../utils/email";
import { OAuth2Client } from "google-auth-library";
import * as appleSignin from "apple-signin-auth";

const OTP_TTL_MS = 10 * 60 * 1000;          // 10 minutes
const OTP_RATE_WINDOW_MS = 15 * 60 * 1000;  // 15 minutes
const OTP_RATE_LIMIT = 3;                    // max requests per identifier+purpose per window
const OTP_MAX_ATTEMPTS = 5;                  // max failed verifies before invalidation
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_OTP_PURPOSES = ["REGISTER", "RESET_PASSWORD"] as const;
type OtpPurpose = typeof VALID_OTP_PURPOSES[number];

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

// ── REGISTER (server-side email-OTP verified) ────────────────────────────
export const register = async (req: Request, res: Response) => {
  try {
    const { verificationToken, phone, fullName, password, role, country, city } = req.body;

    if (!verificationToken || !phone || !fullName || !password || !role) {
      return res.status(400).json({ message: "verificationToken, phone, fullName, password and role are required" });
    }

    // Verify the email-OTP verification token (issued by /auth/verify-otp).
    // Token carries the canonical email — we trust the JWT signature, not the request body.
    let email: string;
    try {
      const decoded = jwt.verify(verificationToken, JWT_SECRET) as any;
      if (decoded?.type !== "otp_verification" || decoded?.purpose !== "REGISTER") {
        throw new Error("Token has wrong type or purpose");
      }
      if (!decoded?.identifier || typeof decoded.identifier !== "string") {
        throw new Error("Token missing identifier");
      }
      email = decoded.identifier;
    } catch (err: any) {
      console.error("verificationToken verification failed:", err?.message);
      return res.status(401).json({ message: "Verification expired or invalid. Please verify your email again." });
    }

    // Dedupe on both unique fields — phone (always) and email (now required + load-bearing)
    const existingByPhone = await prisma.user.findUnique({ where: { phone } });
    if (existingByPhone) return res.status(400).json({ message: "Phone number already registered. Please log in instead." });
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) return res.status(400).json({ message: "This email is already registered. Please log in instead." });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        fullName, phone, email, passwordHash, role,
        country: country || "ETHIOPIA",
        city: city || "",
        phoneVerified: false,        // phone is now a claimed-but-unverified field
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

// ─────────────────────────────────────────────────────────────────────────
// REQUEST EMAIL OTP (Stage 2 of email-OTP rollout)
// ─────────────────────────────────────────────────────────────────────────
export const requestOtp = async (req: Request, res: Response) => {
  try {
    const { identifier, purpose } = req.body as { identifier?: string; purpose?: OtpPurpose };

    if (!identifier || !purpose) {
      return res.status(400).json({ message: "identifier and purpose are required" });
    }
    if (!VALID_OTP_PURPOSES.includes(purpose)) {
      return res.status(400).json({ message: "purpose must be REGISTER or RESET_PASSWORD" });
    }
    if (!EMAIL_RE.test(identifier)) {
      return res.status(400).json({ message: "A valid email address is required" });
    }
    const email = identifier.trim().toLowerCase();

    // Rate limit: max OTP_RATE_LIMIT requests per (identifier, purpose) in the
    // OTP_RATE_WINDOW_MS window. Defeats spam + protects email reputation.
    const windowStart = new Date(Date.now() - OTP_RATE_WINDOW_MS);
    const recentCount = await prisma.otp.count({
      where: { identifier: email, purpose, createdAt: { gt: windowStart } },
    });
    if (recentCount >= OTP_RATE_LIMIT) {
      return res.status(429).json({ message: "Too many requests. Please wait a few minutes before requesting another code." });
    }

    // Invalidate any prior unconsumed OTPs for this (identifier, purpose) so
    // only the latest code can be used. Audit-trail preserved (rows kept).
    await prisma.otp.updateMany({
      where: { identifier: email, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    // Crypto-secure 6-digit code; bcrypt-hashed before storage (never plaintext).
    const code = randomInt(100000, 1000000).toString();
    const codeHash = await bcrypt.hash(code, 10);

    await prisma.otp.create({
      data: {
        identifier: email,
        channel: "EMAIL",
        codeHash,
        purpose,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    // Send via Resend. If sending fails (Resend API error or network error),
    // sendOTPEmail throws — we return 502 so the caller can prompt retry.
    try {
      await sendOTPEmail(email, code);
    } catch (err: any) {
      console.error("requestOtp: email send failed:", err?.message);
      return res.status(502).json({ message: "Couldn't send the code, please try again." });
    }

    // Always { ok: true } regardless of whether the email maps to an account,
    // to avoid account-enumeration leakage.
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error("requestOtp failed:", error?.message);
    return res.status(500).json({ message: "Failed to send code. Please try again." });
  }
};

// ─────────────────────────────────────────────────────────────────────────
// VERIFY EMAIL OTP — returns a short-lived verificationToken JWT on success.
// ─────────────────────────────────────────────────────────────────────────
export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { identifier, code, purpose } = req.body as { identifier?: string; code?: string; purpose?: OtpPurpose };

    if (!identifier || !code || !purpose) {
      return res.status(400).json({ message: "identifier, code and purpose are required" });
    }
    if (!VALID_OTP_PURPOSES.includes(purpose)) {
      return res.status(400).json({ message: "purpose must be REGISTER or RESET_PASSWORD" });
    }
    const email = identifier.trim().toLowerCase();

    // Latest unconsumed, non-expired OTP for (identifier, purpose).
    const otp = await prisma.otp.findFirst({
      where: { identifier: email, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!otp) {
      return res.status(400).json({ message: "Code expired or not found, request a new one." });
    }

    const match = await bcrypt.compare(code, otp.codeHash);
    if (!match) {
      const newAttempts = otp.attempts + 1;
      if (newAttempts >= OTP_MAX_ATTEMPTS) {
        // Burn the row so it can't be used even with a correct code later.
        await prisma.otp.update({
          where: { id: otp.id },
          data: { attempts: newAttempts, consumedAt: new Date() },
        });
        return res.status(429).json({ message: "Too many attempts, request a new code." });
      }
      await prisma.otp.update({ where: { id: otp.id }, data: { attempts: newAttempts } });
      return res.status(400).json({ message: "Incorrect code. Please try again." });
    }

    // Mark the OTP consumed (single-use), mint a short-lived verificationToken.
    await prisma.otp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

    const verificationToken = jwt.sign(
      { identifier: email, purpose, type: "otp_verification" },
      JWT_SECRET,
      { expiresIn: "10m" },
    );

    return res.status(200).json({ verificationToken });
  } catch (error: any) {
    console.error("verifyOtp failed:", error?.message);
    return res.status(500).json({ message: "Failed to verify code. Please try again." });
  }
};

// Legacy stub kept until Stage 4 swaps the forgot-password flow too.
export const forgotPassword = async (_req: Request, res: Response) => {
  return res.status(410).json({ message: "Password reset is being upgraded. Please use the latest app version." });
};
