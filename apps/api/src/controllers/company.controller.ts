import { Response } from "express";
import prisma from "../utils/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

const companyPayload = (u: { id: string; companyName: string | null; iftaBaseState: string | null; preferredLanguage: string }) => ({
  id: u.id,
  legalName: u.companyName,
  iftaBaseJurisdiction: u.iftaBaseState,
  language: u.preferredLanguage,
});

// POST /companies — called right after signup by the back-office web app.
// One carrier company per account for now; it lives on the owner's User row.
export const createCompany = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const legalName = str(req.body?.legalName ?? req.body?.companyName);
    const ifta = str(req.body?.iftaBaseJurisdiction ?? req.body?.iftaBaseState).toUpperCase();
    const lang = str(req.body?.language).toUpperCase();

    if (!legalName) return res.status(400).json({ message: "Please enter your company name." });
    if (ifta && !/^[A-Z]{2}$/.test(ifta)) {
      return res.status(400).json({ message: "IFTA base state must be a 2-letter state code." });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        companyName: legalName,
        iftaBaseState: ifta || null,
        ...(["EN", "AM", "SO"].includes(lang) ? { preferredLanguage: lang as "EN" | "AM" | "SO" } : {}),
      },
    });
    return res.status(201).json(companyPayload(user));
  } catch (error) {
    console.error("createCompany failed:", error);
    return res.status(500).json({ message: "We couldn't save your company. Please try again." });
  }
};

// GET /companies — the signed-in user's company (empty list if not set up yet).
export const getMyCompanies = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return res.status(404).json({ message: "Account not found." });
    return res.status(200).json(user.companyName ? [companyPayload(user)] : []);
  } catch (error) {
    console.error("getMyCompanies failed:", error);
    return res.status(500).json({ message: "We couldn't load your company. Please try again." });
  }
};
