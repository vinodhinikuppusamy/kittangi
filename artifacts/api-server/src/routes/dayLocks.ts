import { Router } from "express";
import { DayLock } from "../models/DayLock.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  const list = await DayLock.find().sort({ dateIso: -1 });
  res.json(list);
});

router.post("/", async (req, res) => {
  const { dateIso } = req.body as { dateIso?: string };
  if (!dateIso) { res.status(400).json({ message: "dateIso is required." }); return; }
  const existing = await DayLock.findOne({ dateIso });
  if (existing) { res.status(409).json({ message: "Day already locked." }); return; }
  const doc = await DayLock.create({
    dateIso,
    lockedByUserId: req.auth!.userId,
    lockedAtIso: new Date().toISOString(),
  });
  res.status(201).json(doc);
});

router.delete("/:dateIso", async (req, res) => {
  await DayLock.findOneAndDelete({ dateIso: req.params["dateIso"] });
  res.status(204).end();
});

export default router;
