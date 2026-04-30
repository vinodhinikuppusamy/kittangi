import { Router, type Response } from "express";
import mongoose from "mongoose";
import { Customer } from "../models/Customer.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();
router.use(requireAuth);

type CustomerAddress = {
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

type CustomerBody = {
  id?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  kycStatus?: string;
  activeLoans?: number;
  photoDataUrl?: string;
  dob?: string;
  aadhar?: string;
  pan?: string;
  address?: CustomerAddress;
  createdAtIso?: string;
};

function normalizeKycStatus(value: unknown): "Pending" | "Verified" | "Rejected" | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "pending") return "Pending";
  if (normalized === "verified") return "Verified";
  if (normalized === "rejected") return "Rejected";
  return undefined;
}

function sanitizeAddress(value: unknown): CustomerAddress | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  return {
    street: typeof raw["street"] === "string" ? raw["street"].trim() : undefined,
    city: typeof raw["city"] === "string" ? raw["city"].trim() : undefined,
    state: typeof raw["state"] === "string" ? raw["state"].trim() : undefined,
    pincode: typeof raw["pincode"] === "string" ? raw["pincode"].trim() : undefined,
  };
}

function pickCustomerPayload(body: CustomerBody): CustomerBody {
  const payload: CustomerBody = {};
  if (typeof body.id === "string") payload.id = body.id.trim();
  if (typeof body.fullName === "string") payload.fullName = body.fullName.trim();
  if (typeof body.phone === "string") payload.phone = body.phone.trim();
  if (typeof body.email === "string") payload.email = body.email.trim();
  if (typeof body.activeLoans === "number") payload.activeLoans = body.activeLoans;
  if (typeof body.photoDataUrl === "string") payload.photoDataUrl = body.photoDataUrl;
  if (typeof body.dob === "string") payload.dob = body.dob;
  if (typeof body.aadhar === "string") payload.aadhar = body.aadhar;
  if (typeof body.pan === "string") payload.pan = body.pan;
  if (typeof body.createdAtIso === "string") payload.createdAtIso = body.createdAtIso;

  const kycStatus = normalizeKycStatus(body.kycStatus);
  if (kycStatus) payload.kycStatus = kycStatus;

  const address = sanitizeAddress(body.address);
  if (address) payload.address = address;

  return payload;
}

function toBadRequest(res: Response, message: string): void {
  res.status(400).json({ message });
}

function handleCustomerError(err: unknown, res: Response): void {
  if (err instanceof mongoose.Error.ValidationError) {
    res.status(400).json({ message: err.message });
    return;
  }
  if (err && typeof err === "object" && "code" in err && (err as { code?: number }).code === 11000) {
    res.status(409).json({ message: "Customer already exists." });
    return;
  }
  res.status(500).json({ message: "Internal server error." });
}

// GET /api/customers
router.get("/", async (_req, res) => {
  try {
    const list = await Customer.find().sort({ createdAtIso: -1 });
    res.json(list);
  } catch (err) {
    handleCustomerError(err, res);
  }
});

// POST /api/customers
router.post("/", async (req, res) => {
  try {
    const body = req.body as CustomerBody;
    const payload = pickCustomerPayload(body);
    if (!payload.fullName) {
      toBadRequest(res, "fullName is required.");
      return;
    }
    if (!payload.phone) {
      toBadRequest(res, "phone is required.");
      return;
    }
    if (body.kycStatus != null && !payload.kycStatus) {
      toBadRequest(res, "kycStatus must be Pending, Verified, or Rejected.");
      return;
    }

    const doc = await Customer.create({
      ...payload,
      id: payload.id ?? `KTG-${String(Date.now()).slice(-5)}`,
      createdAtIso: payload.createdAtIso ?? new Date().toISOString(),
      activeLoans: payload.activeLoans ?? 0,
      kycStatus: payload.kycStatus ?? "Pending",
    });
    res.status(201).json(doc);
  } catch (err) {
    handleCustomerError(err, res);
  }
});

// GET /api/customers/:id
router.get("/:id", async (req, res) => {
  try {
    const doc = await Customer.findOne({ id: req.params["id"] });
    if (!doc) { res.status(404).json({ message: "Not found." }); return; }
    res.json(doc);
  } catch (err) {
    handleCustomerError(err, res);
  }
});

// PATCH /api/customers/:id
router.patch("/:id", async (req, res) => {
  try {
    const body = req.body as CustomerBody;
    const patch = pickCustomerPayload(body);

    if (body.kycStatus != null && !patch.kycStatus) {
      toBadRequest(res, "kycStatus must be Pending, Verified, or Rejected.");
      return;
    }

    const doc = await Customer.findOneAndUpdate(
      { id: req.params["id"] },
      { $set: patch },
      { new: true, runValidators: true },
    );
    if (!doc) { res.status(404).json({ message: "Not found." }); return; }
    res.json(doc);
  } catch (err) {
    handleCustomerError(err, res);
  }
});

// DELETE /api/customers/:id
router.delete("/:id", async (req, res) => {
  try {
    await Customer.findOneAndDelete({ id: req.params["id"] });
    res.status(204).end();
  } catch (err) {
    handleCustomerError(err, res);
  }
});

export default router;
