import { Router } from "express";
import { User } from "../models/User.js";
import { requireAuth, requireAdmin } from "../middlewares/auth.js";
import crypto from "node:crypto";

const router = Router();
router.use(requireAuth);

function toPublicUser(doc: {
  _id: { toString: () => string };
  username: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF";
  status: "ACTIVE" | "INACTIVE";
  createdAtIso?: string;
}) {
  return {
    id: doc._id.toString(),
    username: doc.username,
    name: doc.name,
    email: doc.email,
    role: doc.role,
    status: doc.status,
    createdAtIso: doc.createdAtIso,
  };
}

async function sha256Hex(salt: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(salt + password));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

// GET /api/users
router.get("/", requireAdmin, async (_req, res) => {
  const list = await User.find().select("-passwordHash -passwordSalt");
  res.json(list.map((doc) => toPublicUser(doc)));
});

// POST /api/users
router.post("/", requireAdmin, async (req, res) => {
  const { password, ...rest } = req.body as { password: string; [k: string]: unknown };
  if (!password) { res.status(400).json({ message: "password is required." }); return; }
  const salt = randomSalt();
  const hash = await sha256Hex(salt, password);
  const doc = await User.create({
    ...rest,
    passwordSalt: salt,
    passwordHash: hash,
    createdAtIso: new Date().toISOString(),
  });
  res.status(201).json(toPublicUser(doc));
});

// PATCH /api/users/:id — admin can update any field except password; use /change-password
router.patch("/:id", requireAdmin, async (req, res) => {
  const { password, ...rest } = req.body as { password?: string; [k: string]: unknown };
  const doc = await User.findByIdAndUpdate(req.params["id"], { $set: rest }, { new: true }).select("-passwordHash -passwordSalt");
  if (!doc) { res.status(404).json({ message: "Not found." }); return; }
  res.json(toPublicUser(doc));
});

// DELETE /api/users/:id
router.delete("/:id", requireAdmin, async (req, res) => {
  await User.findByIdAndDelete(req.params["id"]);
  res.status(204).end();
});

// POST /api/users/change-password  (self)
router.post("/change-password", async (req, res) => {
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) { res.status(400).json({ message: "currentPassword and newPassword required." }); return; }
  const user = await User.findById(req.auth!.userId);
  if (!user) { res.status(404).json({ message: "Not found." }); return; }
  const check = await sha256Hex(user.passwordSalt, currentPassword);
  if (check !== user.passwordHash) { res.status(401).json({ message: "Current password is incorrect." }); return; }
  const salt = randomSalt();
  const hash = await sha256Hex(salt, newPassword);
  user.passwordSalt = salt;
  user.passwordHash = hash;
  await user.save();
  res.json({ ok: true });
});

export default router;
