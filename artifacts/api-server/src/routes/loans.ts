import { Router } from "express";
import { Loan } from "../models/Loan.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  const list = await Loan.find().sort({ startedAtIso: -1 });
  res.json(list);
});

router.get("/repossession-yard", async (_req, res) => {
  const list = await Loan.find({
    product: "VEHICLE",
    "repossessionDetails.status": { $in: ["SEIZED", "LEGAL_HOLD", "AUCTION_READY"] },
  }).sort({ "repossessionDetails.seizedOnIso": -1, startedAtIso: -1 });
  res.json(list);
});

router.post("/", async (req, res) => {
  const doc = await Loan.create({
    ...req.body,
    id: req.body.id ?? `L-${String(Date.now()).slice(-6)}`,
  });
  res.status(201).json(doc);
});

router.get("/:id", async (req, res) => {
  const doc = await Loan.findOne({ id: req.params["id"] });
  if (!doc) { res.status(404).json({ message: "Not found." }); return; }
  res.json(doc);
});

router.patch("/:id", async (req, res) => {
  const doc = await Loan.findOneAndUpdate(
    { id: req.params["id"] },
    { $set: req.body },
    { new: true },
  );
  if (!doc) { res.status(404).json({ message: "Not found." }); return; }
  res.json(doc);
});

router.delete("/:id", async (req, res) => {
  await Loan.findOneAndDelete({ id: req.params["id"] });
  res.status(204).end();
});

export default router;
