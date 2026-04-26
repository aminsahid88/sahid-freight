import { Router } from "express";
import { getMe, updateMe, changePassword, updatePushToken } from "../controllers/user.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.get("/me", protect, getMe);
router.patch("/me", protect, updateMe);
router.patch("/me/password", protect, changePassword);
router.patch("/push-token", protect, updatePushToken);

export default router;
