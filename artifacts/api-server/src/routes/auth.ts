import { Router } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { requireAuth } from "../middlewares/auth.js";
import { ActivityLog } from "../models/ActivityLog.js";
import crypto from "node:crypto";
import { getCookieDomain, getJwtSecret, isProductionEnv } from "../lib/env.js";

const router = Router();
const AUTH_COOKIE_NAME = "ktg_access";

function authCookieOptions() {
  const cookieDomain = getCookieDomain();
  const options = {
    httpOnly: true,
    secure: isProductionEnv(),
    sameSite: "lax" as const,
    maxAge: 8 * 60 * 60 * 1000,
    path: "/",
  };

  return cookieDomain ? { ...options, domain: cookieDomain } : options;
}

function sha256Hex(salt: string, password: string): string {
  return createHash("sha256").update(salt + password).digest("hex");
}

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    res.status(400).json({ message: "Username and password are required." });
    return;
  }

  const user = await User.findOne({
    $or: [
      { username: username.trim().toLowerCase() },
      { email: username.trim().toLowerCase() },
    ],
  });

  if (!user) {
    res.status(401).json({ message: "Unknown username." });
    return;
  }
  if (user.status !== "ACTIVE") {
    res.status(403).json({ message: "This account is inactive." });
    return;
  }

  const hashed = sha256Hex(user.passwordSalt, password);
  if (hashed !== user.passwordHash) {
    res.status(401).json({ message: "Incorrect password." });
    return;
  }

  const secret = getJwtSecret();
  const token = jwt.sign(
    { userId: user._id.toString(), username: user.username, role: user.role },
    secret,
    { expiresIn: "8h" },
  );

  res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions());

  // Log activity (best-effort)
  try {
    await ActivityLog.create({
      id: `ACT-${Date.now()}`,
      atIso: new Date().toISOString(),
      actor: user.username,
      kind: "AUTH",
      summary: `${user.name ?? user.username} signed in`,
    });
  } catch { /* ignore */ }

  res.json({
    token,
    user: {
      id: user._id.toString(),
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    },
  });
});

// POST /api/auth/logout
router.post("/logout", (_req, res) => {
  const { maxAge: _ignoredMaxAge, ...cookieClearOptions } = authCookieOptions();
  res.clearCookie(AUTH_COOKIE_NAME, cookieClearOptions);
  res.status(204).end();
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.auth!.userId).select("-passwordHash -passwordSalt");
  if (!user) {
    res.status(404).json({ message: "User not found." });
    return;
  }
  res.json({
    id: user._id.toString(),
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  });
});

export default router;
