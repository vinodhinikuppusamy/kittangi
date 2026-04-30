import { Router } from "express";
import { ActivityLog } from "../models/ActivityLog.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const limit = Math.min(Number(req.query["limit"] ?? 100), 500);
  const list = await ActivityLog.find().sort({ atIso: -1 }).limit(limit);
  res.json(list);
});

router.post("/", async (req, res) => {
  const doc = await ActivityLog.create({
    ...req.body,
    id: req.body.id ?? `ACT-${Date.now()}`,
    atIso: req.body.atIso ?? new Date().toISOString(),
  });
  res.status(201).json(doc);
});

export default router;
