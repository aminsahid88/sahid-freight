import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { uploadDocument, getMyDocuments } from "../controllers/upload.controller";
import { protect, AuthRequest } from "../middleware/auth.middleware";
import prisma from "../utils/prisma";

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG and PDF files are allowed"));
    }
  },
});

const router = Router();

const multerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  upload.single("file")(req as any, res as any, next);
};

router.post("/", protect, multerMiddleware, uploadDocument);
router.get("/", protect, getMyDocuments);

export default router;

// Get presigned URL for a document.
// The requested URL must belong to a verification document the user owns
// (via senderProfile or truckOwnerProfile). Admins may presign any document.
router.get("/presign", protect, async (req: AuthRequest, res: Response) => {
  try {
    const { getPresignedUrl } = require("../utils/s3");
    const { url } = req.query;
    if (!url || typeof url !== "string") return res.status(400).json({ message: "url is required" });

    const userId = req.user!.userId;
    const isAdmin = req.user!.role === "ADMIN";

    if (!isAdmin) {
      const doc = await prisma.verificationDocument.findFirst({
        where: {
          fileUrl: url,
          OR: [
            { senderProfile: { userId } },
            { truckOwnerProfile: { userId } },
          ],
        },
        select: { id: true },
      });
      if (!doc) return res.status(403).json({ message: "Not authorized for this document" });
    }

    const presignedUrl = await getPresignedUrl(url, 900);
    return res.json({ url: presignedUrl });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to generate presigned URL" });
  }
});
