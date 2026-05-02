/**
 * package-deploy.mjs
 *
 * Creates hosting-ready zip files for Hostinger deployment:
 *   deploy/kittangi-backend.zip   — PM2 + bundled API server
 *   deploy/kittangi-frontend.zip  — Static React build
 *
 * Run via: pnpm run build:prod   (from workspace root)
 *       or: pnpm run package-deploy  (from scripts/ only, skips build)
 */

import archiver from "archiver";
import { existsSync, mkdirSync, createWriteStream, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Workspace root is two levels up from scripts/src/
const ROOT = path.resolve(__dirname, "..", "..");
const DEPLOY = path.join(ROOT, "deploy");

/**
 * Scans the deploy/ folder for existing numbered zips and returns the next build number.
 * Matches files like kittangi-backend-3.zip or kittangi-frontend-7.zip.
 */
function nextBuildNumber() {
  mkdirSync(DEPLOY, { recursive: true });
  const pattern = /^kittangi-(?:backend|frontend)-(\d+)\.zip$/;
  const max = readdirSync(DEPLOY).reduce((acc, file) => {
    const m = file.match(pattern);
    return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
  }, 0);
  return max + 1;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function abort(message) {
  console.error(`\n[ERROR] ${message}`);
  process.exit(1);
}

function assertExists(filePath, label) {
  if (!existsSync(filePath)) {
    abort(`${label} not found at:\n       ${filePath}\n       Run 'pnpm run build' first.`);
  }
}

/**
 * Creates a zip archive at `zipPath`.
 * `addFiles(archive)` receives an archiver instance to add files/directories.
 */
function createZip(zipPath, addFiles) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      const kb = (archive.pointer() / 1024).toFixed(1);
      console.log(`  ✓ ${path.relative(ROOT, zipPath).replace(/\\/g, "/")}  (${kb} KB)`);
      resolve();
    });

    archive.on("warning", (err) => {
      if (err.code !== "ENOENT") reject(err);
    });
    archive.on("error", reject);

    archive.pipe(output);
    addFiles(archive);
    archive.finalize();
  });
}

// ── Validate build outputs exist ─────────────────────────────────────────────

assertExists(
  path.join(ROOT, "artifacts/api-server/dist/index.mjs"),
  "Backend build (artifacts/api-server/dist/index.mjs)"
);
assertExists(
  path.join(ROOT, "artifacts/kittangi-os/dist/public/index.html"),
  "Frontend build (artifacts/kittangi-os/dist/public/index.html)"
);
assertExists(
  path.join(ROOT, "artifacts/api-server/ecosystem.config.cjs"),
  "ecosystem.config.cjs"
);
assertExists(
  path.join(ROOT, "artifacts/api-server/.env.production"),
  "api-server/.env.production"
);

// ── Prepare deploy folder & determine build number ───────────────────────────

mkdirSync(DEPLOY, { recursive: true });
const buildNum = nextBuildNumber();
console.log(`\nBuild #${buildNum}`);

// ── Backend zip ──────────────────────────────────────────────────────────────
// Contents:
//   dist/              ← fully bundled server (no npm install needed)
//   ecosystem.config.cjs
//   .env.production

console.log("\n>>> Packaging backend...");

await createZip(path.join(DEPLOY, `kittangi-backend-${buildNum}.zip`), (archive) => {
  archive.directory(
    path.join(ROOT, "artifacts/api-server/dist"),
    "dist"
  );
  archive.file(
    path.join(ROOT, "artifacts/api-server/ecosystem.config.cjs"),
    { name: "ecosystem.config.cjs" }
  );
  archive.file(
    path.join(ROOT, "artifacts/api-server/.env.production"),
    { name: ".env.production" }
  );
});

// ── Frontend zip ─────────────────────────────────────────────────────────────
// Contents:
//   index.html
//   assets/
//   (extract directly into Hostinger public_html)

console.log(">>> Packaging frontend...");

await createZip(path.join(DEPLOY, `kittangi-frontend-${buildNum}.zip`), (archive) => {
  archive.directory(
    path.join(ROOT, "artifacts/kittangi-os/dist/public"),
    false   // no wrapping folder — files go into root of zip
  );
});

// ── Done ─────────────────────────────────────────────────────────────────────

console.log("\n=== Deploy packages ready ===");
console.log(`  deploy/kittangi-backend-${buildNum}.zip  → extract to ~/kittangi-backend  → pm2 start ecosystem.config.cjs`);
console.log(`  deploy/kittangi-frontend-${buildNum}.zip → extract into public_html/\n`);
