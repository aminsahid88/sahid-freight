import { Router } from "express";
import { getConversations, getConversation, sendMessage, markRead, getUnreadCount } from "../controllers/message.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.get("/conversations", protect, getConversations);
router.get("/unread-count", protect, getUnreadCount);
router.get("/:userId", protect, getConversation);
router.post("/", protect, sendMessage);
router.patch("/read/:userId", protect, markRead);

export default router;
