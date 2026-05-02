import { execSync } from "node:child_process";
import { existsSync, mkdirSync, cpSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writePm2Ecosystem } from "./write-pm2-ecosystem.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const apiServerDir = path.resolve(root, "artifacts/api-server");
const distDir = path.resolve(apiServerDir, "dist");
const buildsDir = path.resolve(root, "builds");

if (!existsSync(path.resolve(distDir, "index.cjs"))) {
  console.error(`ERROR: ${distDir}/index.cjs not found. Run build-server-staging first.`);
  process.exit(1);
}

// Auto-increment build number
mkdirSync(buildsDir, { recursive: true });
const prefix = "kittangi-backend-staging-build-";
const existing = readdirSync(buildsDir).filter((f) =>
  new RegExp(`^${prefix}\\d+$`).test(f)
);
const maxN = existing.reduce((max, f) => {
  const n = parseInt(f.replace(prefix, ""), 10);
  return n > max ? n : max;
}, 0);
const buildN = maxN + 1;

const buildName = `${prefix}${buildN}`;
const buildDir = path.resolve(buildsDir, buildName);
const zipPath = path.resolve(buildsDir, `${buildName}.zip`);

console.log(`Packaging staging backend as ${buildName}...`);

mkdirSync(buildDir, { recursive: true });

// Copy dist folder (bundled server + pino worker files + sourcemaps)
cpSync(distDir, path.resolve(buildDir, "dist"), { recursive: true });

// Copy .env.staging or .env as .env (optional for staging)
const envStaging = path.resolve(apiServerDir, ".env.staging");
const envFallback = path.resolve(apiServerDir, ".env");
if (existsSync(envStaging)) {
  cpSync(envStaging, path.resolve(buildDir, ".env"));
} else if (existsSync(envFallback)) {
  cpSync(envFallback, path.resolve(buildDir, ".env"));
} else {
  console.warn("WARNING: No .env.staging or .env found — skipping env copy.");
}

// Generate a minimal package.json for the deployment package
const pkgJson = {
  name: "kittangi-api-server",
  version: "1.0.0",
  private: true,
  main: "dist/index.cjs",
  scripts: {
    start: "node dist/index.cjs",
  },
};
writeFileSync(
  path.resolve(buildDir, "package.json"),
  JSON.stringify(pkgJson, null, 2),
  "utf-8"
);

writePm2Ecosystem({
  buildDir,
  appName: "kittangi-backend-staging",
  defaultNodeEnv: "staging",
});

// Create ZIP
const isWindows = process.platform === "win32";
if (isWindows) {
  execSync(
    `powershell -Command "Compress-Archive -Path '${buildDir}\\*' -DestinationPath '${zipPath}'"`,
    { stdio: "inherit" }
  );
} else {
  execSync(`zip -r "${zipPath}" .`, { cwd: buildDir, stdio: "inherit" });
}

console.log(`Staging backend packaged: ${zipPath}`);
