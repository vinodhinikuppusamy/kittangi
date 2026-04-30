import { Router } from "express";
import { Investor } from "../models/Investor.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  const list = await Investor.find().sort({ depositDateIso: -1 });
  res.json(list);
});

router.post("/", async (req, res) => {
  const doc = await Investor.create({
    ...req.body,
    id: req.body.id ?? `INV-${String(Date.now()).slice(-6)}`,
  });
  res.status(201).json(doc);
});

router.get("/:id", async (req, res) => {
  const doc = await Investor.findOne({ id: req.params["id"] });
  if (!doc) { res.status(404).json({ message: "Not found." }); return; }
  res.json(doc);
});

router.patch("/:id", async (req, res) => {
  const doc = await Investor.findOneAndUpdate(
    { id: req.params["id"] },
    { $set: req.body },
    { new: true },
  );
  if (!doc) { res.status(404).json({ message: "Not found." }); return; }
  res.json(doc);
});

router.delete("/:id", async (req, res) => {
  await Investor.findOneAndDelete({ id: req.params["id"] });
  res.status(204).end();
});

export default router;
