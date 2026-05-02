import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function loadIfExists(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  dotenv.config({ path: filePath, override: false });
}

function resolveCandidates(): string[] {
  const nodeEnv = process.env["NODE_ENV"];
  const cwd = process.cwd();
  const currentFilePath = fileURLToPath(import.meta.url);
  const projectRoot = path.resolve(path.dirname(currentFilePath), "..", "..");

  const envFileFromProcess = process.env["ENV_FILE"];
  const candidates: string[] = [];

  if (envFileFromProcess) {
    candidates.push(path.isAbsolute(envFileFromProcess) ? envFileFromProcess : path.resolve(cwd, envFileFromProcess));
  }

  if (nodeEnv === "production") {
    candidates.push(path.resolve(cwd, ".env.production"));
    candidates.push(path.resolve(projectRoot, ".env.production"));
  } else {
    candidates.push(path.resolve(cwd, ".env.local"));
    candidates.push(path.resolve(projectRoot, ".env.local"));
  }

  candidates.push(path.resolve(cwd, ".env"));
  candidates.push(path.resolve(projectRoot, ".env"));

  return unique(candidates);
}

for (const candidate of resolveCandidates()) {
  loadIfExists(candidate);
}
