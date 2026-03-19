import { Router } from "express";
import { register, login, logout, refresh, sendOtp, verifyOtp } from "../controllers/auth.controller";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.post("/refresh", refresh);
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);

export default router;
