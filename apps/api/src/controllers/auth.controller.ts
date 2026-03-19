import { sendOTPEmail } from "../utils/email";
import { sendSMS } from "../utils/sms";
import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";
import prisma from "../utils/prisma";

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

    const accessToken = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "15m" });
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

    const accessToken = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "15m" });
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
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ message: "Invalid phone or password" });
    if (user.status === "SUSPENDED") return res.status(403).json({ message: "Your account has been suspended" });

    const accessToken = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "15m" });
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
    const accessToken = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: "15m" });
    return res.status(200).json({ accessToken });
  } catch (error) {
    console.error(error);
    return res.status(401).json({ message: "Invalid or expired refresh token" });
  }
};
