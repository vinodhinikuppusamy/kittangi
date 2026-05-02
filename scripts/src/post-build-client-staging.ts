import { execSync } from "node:child_process";
import { existsSync, mkdirSync, cpSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const clientDir = path.resolve(root, "artifacts/kittangi-os");
const distDir = path.resolve(clientDir, "dist/public");
const buildsDir = path.resolve(root, "builds");

if (!existsSync(distDir)) {
  console.error(`ERROR: ${distDir} not found. Run build-client-staging first.`);
  process.exit(1);
}

// Auto-increment build number
mkdirSync(buildsDir, { recursive: true });
const prefix = "kittangi-frontend-staging-build-";
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

console.log(`Packaging staging frontend as ${buildName}...`);

mkdirSync(buildDir, { recursive: true });
cpSync(distDir, buildDir, { recursive: true });

// Optional: copy .htaccess and web.staging.config (renamed to web.config) if present
const htaccess = path.resolve(clientDir, ".htaccess");
const webStagingConfig = path.resolve(clientDir, "web.staging.config");
const webConfig = path.resolve(clientDir, "web.config");
if (existsSync(htaccess)) cpSync(htaccess, path.resolve(buildDir, ".htaccess"));
if (existsSync(webStagingConfig)) {
  cpSync(webStagingConfig, path.resolve(buildDir, "web.config"));
} else if (existsSync(webConfig)) {
  cpSync(webConfig, path.resolve(buildDir, "web.config"));
}

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

console.log(`Staging frontend packaged: ${zipPath}`);
