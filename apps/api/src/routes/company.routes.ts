import { Router } from "express";
import { createCompany, getMyCompanies } from "../controllers/company.controller";
import { protect } from "../middleware/auth.middleware";

const router = Router();

router.get("/", protect, getMyCompanies);
router.post("/", protect, createCompany);

export default router;
