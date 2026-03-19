import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { uploadFile } from "../utils/minio";
import prisma from "../utils/prisma";
import crypto from "crypto";

export const uploadDocument = async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    const { documentType, profileType } = req.body;
    if (!documentType) return res.status(400).json({ message: "documentType is required" });

    const fileName = `${crypto.randomUUID()}-${file.originalname}`;
    const fileUrl = await uploadFile(fileName, file.buffer, file.mimetype);

    let senderProfileId = null;
    let truckOwnerProfileId = null;

    if (profileType === "SENDER") {
      const profile = await prisma.senderProfile.findUnique({ where: { userId: req.user!.userId } });
      if (!profile) return res.status(404).json({ message: "Sender profile not found" });
      senderProfileId = profile.id;
    } else if (profileType === "TRUCK_OWNER") {
      const profile = await prisma.truckOwnerProfile.findUnique({ where: { userId: req.user!.userId } });
      if (!profile) return res.status(404).json({ message: "Truck owner profile not found" });
      truckOwnerProfileId = profile.id;
    } else {
      return res.status(400).json({ message: "profileType must be SENDER or TRUCK_OWNER" });
    }

    const document = await prisma.verificationDocument.create({
      data: {
        documentType,
        fileUrl,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        senderProfileId,
        truckOwnerProfileId,
      },
    });

    return res.status(201).json({ message: "Document uploaded successfully", document });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export const getMyDocuments = async (req: AuthRequest, res: Response) => {
  try {
    const { profileType } = req.query;

    let documents;

    if (profileType === "SENDER") {
      const profile = await prisma.senderProfile.findUnique({
        where: { userId: req.user!.userId },
        include: { documents: true },
      });
      documents = profile?.documents || [];
    } else {
      const profile = await prisma.truckOwnerProfile.findUnique({
        where: { userId: req.user!.userId },
        include: { documents: true },
      });
      documents = profile?.documents || [];
    }

    return res.status(200).json({ documents });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};
