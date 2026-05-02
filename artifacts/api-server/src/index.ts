import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import app from "./app.js";
import { connectDB } from "./db.js";
import { seedIfEmpty } from "./seed.js";
import { logger } from "./lib/logger.js";
import { getPort, validateRuntimeConfig } from "./lib/env.js";

// Load environment files in order of precedence without overriding already-set values:
// 1) ENV_FILE (if provided by host/PM2)
// 2) .env.<NODE_ENV>
// 3) .env fallback
const nodeEnv = process.env["NODE_ENV"]?.trim();
const explicitEnvFile = process.env["ENV_FILE"]?.trim();
const envCandidates = explicitEnvFile
  ? [explicitEnvFile, ".env"]
  : [nodeEnv ? `.env.${nodeEnv}` : undefined, ".env"].filter(
      (value): value is string => Boolean(value),
    );

const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
const runtimeAppRoot = entryFile
  ? path.resolve(path.dirname(entryFile), "..")
  : process.cwd();

const lookupDirs = [process.cwd(), runtimeAppRoot];
const shouldOverrideProcessEnv = Boolean(explicitEnvFile);
const seen = new Set<string>();
for (const candidate of envCandidates) {
  if (path.isAbsolute(candidate)) {
    if (!seen.has(candidate) && existsSync(candidate)) {
      seen.add(candidate);
      dotenv.config({ path: candidate, override: shouldOverrideProcessEnv });
    }
    continue;
  }

  for (const dir of lookupDirs) {
    const resolved = path.resolve(dir, candidate);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    if (existsSync(resolved)) {
      dotenv.config({ path: resolved, override: shouldOverrideProcessEnv });
    }
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

(async () => {
  try {
    await connectDB();
    await seedIfEmpty();
    app.listen(port, (err?: Error) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  } catch (err) {
    logger.error({ err }, "Failed to start server");
    process.exit(1);
  }
})();
