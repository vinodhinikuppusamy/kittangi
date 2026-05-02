import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const clientDir = path.resolve(root, "artifacts/kittangi-os");
const envFile = path.resolve(clientDir, ".env.production");

if (!existsSync(envFile)) {
  console.error(`ERROR: ${envFile} not found. Create it before running a production build.`);
  process.exit(1);
}

console.log("Building kittangi-os frontend (production)...");

execSync("pnpm exec vite build --config vite.config.ts --mode production", {
  cwd: clientDir,
  stdio: "inherit",
});

console.log("Frontend build complete.");
