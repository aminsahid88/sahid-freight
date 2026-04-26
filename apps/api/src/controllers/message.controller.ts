import { Response } from "express";
import prisma from "../utils/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

// GET /messages/conversations — list all conversations (latest message per contact)
export const getConversations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Get all messages involving this user
    const messages = await prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        sender: { select: { id: true, fullName: true, role: true } },
        receiver: { select: { id: true, fullName: true, role: true } },
      },
    });

    // Build conversations map: key = other user's id
    const convMap = new Map<string, any>();
    for (const msg of messages) {
      const otherId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      const other = msg.senderId === userId ? msg.receiver : msg.sender;
      if (!convMap.has(otherId)) {
        convMap.set(otherId, {
          userId: otherId,
          user: other,
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          unreadCount: 0,
        });
      }
      // Count unread from other user
      if (msg.receiverId === userId && !msg.read) {
        const existing = convMap.get(otherId);
        existing.unreadCount += 1;
      }
    }

    const conversations = Array.from(convMap.values()).sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    return res.json({ conversations });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// GET /messages/:userId — get conversation with a specific user
export const getConversation = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { userId: otherId } = req.params;

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherId },
          { senderId: otherId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: "asc" },
      include: {
        sender: { select: { id: true, fullName: true } },
        receiver: { select: { id: true, fullName: true } },
      },
    });

    // Fetch other user info
    const other = await prisma.user.findUnique({
      where: { id: otherId },
      select: { id: true, fullName: true, role: true, phone: true },
    });

    return res.json({ messages, other });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// POST /messages — send a message
export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { receiverId, content, bookingId } = req.body;

    if (!receiverId || !content?.trim()) {
      return res.status(400).json({ message: "receiverId and content are required" });
    }

    const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) return res.status(404).json({ message: "Receiver not found" });

    const message = await prisma.message.create({
      data: {
        senderId: userId,
        receiverId,
        content: content.trim(),
        bookingId: bookingId || null,
      },
      include: {
        sender: { select: { id: true, fullName: true } },
        receiver: { select: { id: true, fullName: true } },
      },
    });

    return res.status(201).json({ message });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// PATCH /messages/read/:userId — mark all messages from userId as read
export const markRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { userId: fromId } = req.params;

    await prisma.message.updateMany({
      where: { senderId: fromId, receiverId: userId, read: false },
      data: { read: true },
    });

    return res.json({ message: "Messages marked as read" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// GET /messages/unread-count — total unread messages count
export const getUnreadCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const count = await prisma.message.count({
      where: { receiverId: userId, read: false },
    });
    return res.json({ count });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
