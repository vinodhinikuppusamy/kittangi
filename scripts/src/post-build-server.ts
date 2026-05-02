import { execSync } from "node:child_process";
import { existsSync, mkdirSync, cpSync, readdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writePm2Ecosystem } from "./write-pm2-ecosystem.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const apiServerDir = path.resolve(root, "artifacts/api-server");
const distDir = path.resolve(apiServerDir, "dist");
const envProd = path.resolve(apiServerDir, ".env.production");
const buildsDir = path.resolve(root, "builds");

if (!existsSync(envProd)) {
  console.error(`ERROR: ${envProd} not found. Create it before running a production build.`);
  process.exit(1);
}

if (!existsSync(path.resolve(distDir, "index.cjs"))) {
  console.error(`ERROR: ${distDir}/index.cjs not found. Run build-server first.`);
  process.exit(1);
}

// Auto-increment build number
mkdirSync(buildsDir, { recursive: true });
const prefix = "kittangi-backend-build-";
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

console.log(`Packaging backend as ${buildName}...`);

mkdirSync(buildDir, { recursive: true });

// Copy dist folder (bundled server + pino worker files)
cpSync(distDir, path.resolve(buildDir, "dist"), { recursive: true });

// Copy production runtime env file into the package with its production name.
cpSync(envProd, path.resolve(buildDir, ".env.production"));

// Generate a minimal package.json for the deployment package
const pkgJson = {
  name: "kittangi-api-server",
  version: "1.0.0",
  private: true,
  main: "dist/index.cjs",
  scripts: {
    "dev:prod": "NODE_ENV=production ENV_FILE=.env.production node dist/index.cjs",
    start: "pnpm run dev:prod",
  },
};
writeFileSync(
  path.resolve(buildDir, "package.json"),
  JSON.stringify(pkgJson, null, 2),
  "utf-8"
);

writePm2Ecosystem({
  buildDir,
  appName: "kittangi-backend",
  defaultNodeEnv: "production",
  envFileName: ".env.production",
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

console.log(`Backend packaged: ${zipPath}`);
