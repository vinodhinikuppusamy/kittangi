import { User } from "./models/User.js";
import { Account } from "./models/Account.js";
import { BranchProfile } from "./models/BranchProfile.js";
import { Settings } from "./models/Settings.js";
import { logger } from "./lib/logger.js";

const DEFAULT_SEED_PASSWORD = "kittangi123";

async function sha256Hex(salt: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest(
    "SHA-256",
    enc.encode(salt + password),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function seedIfEmpty(): Promise<void> {
  logger.info("Checking seed data…");
  const userCount = await User.countDocuments();

  if (userCount === 0) {
    logger.info("Seeding users…");
    const anitaHash = await sha256Hex("ktg-salt-anita-001", DEFAULT_SEED_PASSWORD);
    const rahulHash = await sha256Hex("ktg-salt-rahul-002", DEFAULT_SEED_PASSWORD);
    const priyaHash = await sha256Hex("ktg-salt-priya-003", DEFAULT_SEED_PASSWORD);
    await User.insertMany([
      {
        username: "anita",
        name: "Anita Sharma",
        email: "anita.sharma@kittangi.in",
        role: "ADMIN",
        status: "ACTIVE",
        passwordSalt: "ktg-salt-anita-001",
        passwordHash: anitaHash,
        createdAtIso: "2026-01-01T00:00:00.000Z",
      },
      {
        username: "rahul",
        name: "Rahul Mehta",
        email: "rahul.m@kittangi.in",
        role: "STAFF",
        status: "ACTIVE",
        passwordSalt: "ktg-salt-rahul-002",
        passwordHash: rahulHash,
        createdAtIso: "2026-01-10T09:00:00.000Z",
      },
      {
        username: "priya",
        name: "Priya Dubey",
        email: "priya.d@kittangi.in",
        role: "STAFF",
        status: "ACTIVE",
        passwordSalt: "ktg-salt-priya-003",
        passwordHash: priyaHash,
        createdAtIso: "2026-01-15T09:00:00.000Z",
      },
    ]);
  }

  const accountCount = await Account.countDocuments();
  if (accountCount === 0) {
    await Account.insertMany([
      {
        id: "ACC-001",
        name: "Main Cash",
        type: "CASH",
        openingBalance: 100000,
        openedAtIso: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "ACC-002",
        name: "HDFC Current",
        type: "BANK",
        subtitle: "A/c ending 4521",
        openingBalance: 500000,
        openedAtIso: "2026-01-01T00:00:00.000Z",
      },
    ]);
  }

  const branchCount = await BranchProfile.countDocuments();
  if (branchCount === 0) {
    await BranchProfile.create({
      branchName: "Kittangi Finance",
      address: "123 Main Street, City",
      phone: "+91 9999999999",
      email: "info@kittangi.in",
    });
  }

  const settingsCount = await Settings.countDocuments();
  if (settingsCount === 0) {
    const defaultSettings = [
      { key: "pawnRatePctPerMonth", value: 2.5 },
      { key: "vehicleRatePctPerAnnum", value: 11.25 },
      { key: "penaltyRatePctPerMonth", value: 2.0 },
      { key: "processingFeeFlat", value: 500 },
      { key: "processingFeePer1000", value: 15 },
      { key: "globalLegalInterestRatePct", value: 18 },
    ];
    await Settings.insertMany(defaultSettings);
  }

  logger.info("Seed complete.");
}
