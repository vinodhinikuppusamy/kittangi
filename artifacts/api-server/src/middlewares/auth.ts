import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../lib/env.js";

const AUTH_COOKIE_NAME = "ktg_access";

export interface AuthPayload {
  userId: string;
  username: string;
  role: "ADMIN" | "STAFF";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers["authorization"];
  const bearerToken = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const cookieToken =
    typeof req.cookies?.[AUTH_COOKIE_NAME] === "string"
      ? (req.cookies[AUTH_COOKIE_NAME] as string)
      : null;
  const token = bearerToken ?? cookieToken;

  if (!token) {
    res.status(401).json({ message: "No token provided." });
    return;
  }

  let secret: string;
  try {
    secret = getJwtSecret();
  } catch {
    res.status(500).json({ message: "Server misconfiguration: JWT_SECRET missing." });
    return;
  }
  try {
    req.auth = jwt.verify(token, secret) as AuthPayload;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token." });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.auth?.role !== "ADMIN") {
      res.status(403).json({ message: "Admin access required." });
      return;
    }
    next();
  });
}
