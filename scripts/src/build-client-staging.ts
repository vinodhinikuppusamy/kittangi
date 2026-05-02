import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const clientDir = path.resolve(root, "artifacts/kittangi-os");

console.log("Building kittangi-os frontend (staging)...");

execSync("pnpm exec vite build --config vite.config.ts --mode staging", {
  cwd: clientDir,
  stdio: "inherit",
});

console.log("Frontend staging build complete.");
