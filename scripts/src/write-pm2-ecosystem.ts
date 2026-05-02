import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

type Pm2Environment = "production" | "staging";

export function writePm2Ecosystem(args: {
  buildDir: string;
  appName: string;
  defaultNodeEnv: Pm2Environment;
  envFileName?: string;
}): void {
  const logsDir = path.resolve(args.buildDir, "logs");
  mkdirSync(logsDir, { recursive: true });
  const envFileName = args.envFileName ?? ".env";

  const pm2Config = `module.exports = {
  apps: [
    {
      name: ${JSON.stringify(args.appName)},
      script: "./dist/index.cjs",
      instances: 1,
      exec_mode: "fork",
      cwd: "./",
      env: {
        NODE_ENV: ${JSON.stringify(args.defaultNodeEnv)},
        ENV_FILE: ${JSON.stringify(envFileName)},
      },
      env_staging: {
        NODE_ENV: "staging",
        ENV_FILE: ${JSON.stringify(envFileName)},
      },
      autorestart: true,
      watch: false,
      kill_timeout: 10000,
      wait_ready: false,
      listen_timeout: 10000,
      max_memory_restart: "512M",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./logs/error.log",
      out_file: "./logs/out.log",
      merge_logs: true,
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
    },
  ],
};
`;

  writeFileSync(
    path.resolve(args.buildDir, "ecosystem.config.cjs"),
    pm2Config,
    "utf-8",
  );
}