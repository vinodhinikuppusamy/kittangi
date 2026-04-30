import { Router } from "express";
import { BranchProfile } from "../models/BranchProfile.js";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

// GET /api/branch-profile
router.get("/", async (_req, res) => {
  const doc = await BranchProfile.findOne();
  if (!doc) { res.status(404).json({ message: "Branch profile not set up." }); return; }
  res.json(doc);
});

// PUT /api/branch-profile
router.put("/", requireAdmin, async (req, res) => {
  let doc = await BranchProfile.findOne();
  if (doc) {
    Object.assign(doc, req.body);
    await doc.save();
  } else {
    doc = await BranchProfile.create(req.body);
  }
  res.json(doc);
});

export default router;
