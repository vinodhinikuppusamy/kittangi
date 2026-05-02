import { Router } from "express";
import { VaultConfig } from "../models/VaultConfig.js";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  const list = await VaultConfig.find().sort({ startNumber: 1, name: 1 });
  res.json(list);
});

router.post("/", requireAdmin, async (req, res) => {
  const doc = await VaultConfig.create({
    ...req.body,
    id: req.body.id ?? `SAFE_${String(Date.now()).slice(-6)}`,
  });
  res.status(201).json(doc);
});

router.patch("/:id", requireAdmin, async (req, res) => {
  const doc = await VaultConfig.findOneAndUpdate(
    { id: req.params["id"] },
    { $set: req.body },
    { new: true },
  );
  if (!doc) {
    res.status(404).json({ message: "Not found." });
    return;
  }
  res.json(doc);
});

router.delete("/:id", requireAdmin, async (req, res) => {
  await VaultConfig.findOneAndDelete({ id: req.params["id"] });
  res.status(204).end();
});

export default router;
