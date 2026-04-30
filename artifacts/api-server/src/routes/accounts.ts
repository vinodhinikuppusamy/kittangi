import { Router } from "express";
import { Account } from "../models/Account.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  const list = await Account.find().sort({ openedAtIso: 1 });
  res.json(list);
});

router.post("/", async (req, res) => {
  const doc = await Account.create({
    ...req.body,
    id: req.body.id ?? `ACC-${String(Date.now()).slice(-6)}`,
    openedAtIso: req.body.openedAtIso ?? new Date().toISOString(),
  });
  res.status(201).json(doc);
});

router.get("/:id", async (req, res) => {
  const doc = await Account.findOne({ id: req.params["id"] });
  if (!doc) { res.status(404).json({ message: "Not found." }); return; }
  res.json(doc);
});

router.patch("/:id", async (req, res) => {
  const doc = await Account.findOneAndUpdate(
    { id: req.params["id"] },
    { $set: req.body },
    { new: true },
  );
  if (!doc) { res.status(404).json({ message: "Not found." }); return; }
  res.json(doc);
});

router.delete("/:id", async (req, res) => {
  await Account.findOneAndDelete({ id: req.params["id"] });
  res.status(204).end();
});

export default router;
