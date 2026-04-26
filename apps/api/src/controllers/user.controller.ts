import { Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../utils/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true, fullName: true, email: true, phone: true, role: true,
        status: true, country: true, city: true, preferredLanguage: true,
        profilePhoto: true, isVerified: true, createdAt: true,
        senderProfile: true, truckOwnerProfile: true,
      },
    });
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({ user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const updateMe = async (req: AuthRequest, res: Response) => {
  try {
    const { fullName, city, country } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        ...(fullName && { fullName }),
        ...(city && { city }),
        ...(country && { country }),
      },
      select: { id: true, fullName: true, phone: true, role: true, status: true, country: true, city: true },
    });
    return res.status(200).json({ message: "Profile updated", user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const changePassword = async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (!user.passwordHash) return res.status(400).json({ message: "No password set. Use social login." });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(400).json({ message: "Current password is incorrect" });
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.user!.userId }, data: { passwordHash } });
    return res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const updatePushToken = async (req: AuthRequest, res: Response) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken) return res.status(400).json({ message: "pushToken required" });
    await prisma.user.update({ where: { id: req.user!.userId }, data: { pushToken } });
    return res.status(200).json({ message: "Push token updated" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
