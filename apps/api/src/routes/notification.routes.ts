import { Router } from "express";
import { getMyNotifications, markAsRead, markAllAsRead, getUnreadCount } from "../controllers/notification.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.get("/", protect, getMyNotifications);
router.get("/unread", protect, getUnreadCount);
router.patch("/read-all", protect, markAllAsRead);
router.patch("/:id/read", protect, markAsRead);

export default router;
