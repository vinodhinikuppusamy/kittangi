import { Router } from "express";
import { PledgedItem } from "../models/PledgedItem.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  const list = await PledgedItem.find().sort({ _id: -1 });
  res.json(list);
});

router.post("/", async (req, res) => {
  const doc = await PledgedItem.create({
    ...req.body,
    id: req.body.id ?? `PI-${String(Date.now()).slice(-6)}`,
  });
  res.status(201).json(doc);
});

router.get("/:id", async (req, res) => {
  const doc = await PledgedItem.findOne({ id: req.params["id"] });
  if (!doc) { res.status(404).json({ message: "Not found." }); return; }
  res.json(doc);
});

router.patch("/:id", async (req, res) => {
  const doc = await PledgedItem.findOneAndUpdate(
    { id: req.params["id"] },
    { $set: req.body },
    { new: true },
  );
  if (!doc) { res.status(404).json({ message: "Not found." }); return; }
  res.json(doc);
});

router.delete("/:id", async (req, res) => {
  await PledgedItem.findOneAndDelete({ id: req.params["id"] });
  res.status(204).end();
});

export default router;
