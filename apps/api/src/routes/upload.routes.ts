import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { uploadDocument, getMyDocuments } from "../controllers/upload.controller";
import { protect } from "../middleware/auth.middleware";

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
