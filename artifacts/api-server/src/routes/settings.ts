import { Router } from "express";
import { Settings } from "../models/Settings.js";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  const list = await Settings.find();
  const obj: Record<string, unknown> = {};
  for (const s of list) obj[s.key] = s.value;
  res.json(obj);
});

router.put("/:key", requireAdmin, async (req, res) => {
  const doc = await Settings.findOneAndUpdate(
    { key: req.params["key"] },
    { $set: { value: req.body.value } },
    { upsert: true, new: true },
  );
  res.json(doc);
});

export default router;
