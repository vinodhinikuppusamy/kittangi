import { User } from "./models/User.js";
import { Account } from "./models/Account.js";
import { BranchProfile } from "./models/BranchProfile.js";
import { Settings } from "./models/Settings.js";
import { logger } from "./lib/logger.js";
<<<<<<< HEAD
import { createHash } from "node:crypto";
=======
import { getSeedAdminConfig } from "./lib/env.js";
>>>>>>> 219d30d (fix: build scripts and deployment debug)

const DEFAULT_SEED_PASSWORD = "kittangi123";

function sha256Hex(salt: string, password: string): string {
  return createHash("sha256").update(salt + password).digest("hex");
}

export async function seedIfEmpty(): Promise<void> {
  logger.info("Checking seed data…");
  const userCount = await User.countDocuments();

  if (userCount === 0) {
    logger.info("Seeding users…");
<<<<<<< HEAD
    const adminUsername = process.env["ADMIN_USERNAME"]?.trim().toLowerCase();
    const adminPassword = process.env["ADMIN_PASSWORD"];
    const adminName = process.env["ADMIN_NAME"]?.trim() || "Administrator";
    const adminEmail =
      process.env["ADMIN_EMAIL"]?.trim().toLowerCase() ??
      `${adminUsername}@local.kittangi`;

    if (!adminUsername || !adminPassword) {
      throw new Error(
        "Missing required env for initial admin seed: ADMIN_USERNAME, ADMIN_PASSWORD.",
      );
    }

    const adminHash = sha256Hex("seed-salt-admin-001", adminPassword);
=======
    const seedAdmin = getSeedAdminConfig();
    const adminUsername = seedAdmin?.username ?? "anita";
    const adminPassword = seedAdmin?.password ?? DEFAULT_SEED_PASSWORD;
    const adminName = seedAdmin?.name ?? "Anita Sharma";
    const adminEmail = seedAdmin?.email ?? "anita.sharma@kittangi.in";

    const anitaHash = await sha256Hex("ktg-salt-anita-001", adminPassword);
    const rahulHash = await sha256Hex("ktg-salt-rahul-002", DEFAULT_SEED_PASSWORD);
    const priyaHash = await sha256Hex("ktg-salt-priya-003", DEFAULT_SEED_PASSWORD);
>>>>>>> 219d30d (fix: build scripts and deployment debug)
    await User.insertMany([
      {
        username: adminUsername,
        name: adminName,
        email: adminEmail,
        role: "ADMIN",
        status: "ACTIVE",
        passwordSalt: "seed-salt-admin-001",
        passwordHash: adminHash,
        createdAtIso: new Date().toISOString(),
      },
    ]);
  }

  const accountCount = await Account.countDocuments();
  if (accountCount === 0) {
    await Account.insertMany([
      {
        id: "CASH",
        name: "Cash in Hand",
        type: "CASH",
        subtitle: "Branch cash drawer",
        openingBalance: 218430,
        openedAtIso: "2025-04-01",
      },
      {
        id: "HDFC",
        name: "HDFC Bank",
        type: "BANK",
        subtitle: "Current A/c ••• 4521",
        openingBalance: 1250000,
        openedAtIso: "2025-04-01",
      },
      {
        id: "SBI",
        name: "SBI Bank",
        type: "BANK",
        subtitle: "Overdraft A/c ••• 8870",
        openingBalance: 875000,
        openedAtIso: "2025-04-01",
      },
    ]);
  }

  const branchCount = await BranchProfile.countDocuments();
  if (branchCount === 0) {
    await BranchProfile.create({
      branchName: "Kittangi Main",
      branchCode: "KTG-001",
      gstin: "29ABCDE1234F1Z5",
      address: "No. 14, MG Road, Bengaluru, Karnataka — 560001",
      contact: "+91 98450 12345",
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
