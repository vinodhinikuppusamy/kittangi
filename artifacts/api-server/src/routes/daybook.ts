import { Router } from "express";
import { DaybookEntry } from "../models/DaybookEntry.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const filter: Record<string, unknown> = {};
  if (req.query["dateIso"]) filter["dateIso"] = req.query["dateIso"];
  const list = await DaybookEntry.find(filter).sort({ dateIso: -1, time: -1 });
  res.json(list);
});

router.post("/", async (req, res) => {
  const doc = await DaybookEntry.create({
    ...req.body,
    id: req.body.id ?? `DB-${String(Date.now()).slice(-8)}`,
    time: req.body.time ?? new Date().toTimeString().slice(0, 5),
  });
  res.status(201).json(doc);
});

router.get("/:id", async (req, res) => {
  const doc = await DaybookEntry.findOne({ id: req.params["id"] });
  if (!doc) { res.status(404).json({ message: "Not found." }); return; }
  res.json(doc);
});

router.patch("/:id", async (req, res) => {
  const doc = await DaybookEntry.findOneAndUpdate(
    { id: req.params["id"] },
    { $set: req.body },
    { new: true },
  );
  if (!doc) { res.status(404).json({ message: "Not found." }); return; }
  res.json(doc);
});

router.delete("/:id", async (req, res) => {
  await DaybookEntry.findOneAndDelete({ id: req.params["id"] });
  res.status(204).end();
});

export default router;
