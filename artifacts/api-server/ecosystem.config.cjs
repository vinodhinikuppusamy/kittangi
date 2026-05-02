/**
 * PM2 Ecosystem Config — Kittangi Backend
 *
 * Deploy steps on Hostinger:
 *   1. Extract kittangi-backend.zip into a folder (e.g. ~/kittangi-backend)
 *   2. cd into that folder
 *   3. Run: pm2 start ecosystem.config.cjs
 *   4. Run: pm2 save   (so it auto-starts on reboot)
 *   5. Run: pm2 startup  (follow the printed command to enable boot hook)
 */

module.exports = {
  apps: [
    {
      name: "kittangi-backend",
      script: "./dist/index.mjs",

      // Tell PM2 to load .env.production from the same directory
      env_file: ".env.production",

      // Explicit env overrides (these always win over env_file)
      env: {
        NODE_ENV: "production",
      },

      // Single process (fork mode) — safe for all setups
      instances: 1,
      exec_mode: "fork",

      // Never watch files in production
      watch: false,

      // Restart if memory grows beyond 512 MB
      max_memory_restart: "512M",

      // Log files (PM2 creates these directories automatically)
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      merge_logs: true,

      // Restart policy
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: "10s",

      // Graceful shutdown — wait up to 5s for in-flight requests
      kill_timeout: 5000,
      listen_timeout: 8000,

      // Node interpreter — use "node" (Hostinger resolves the version via nvm/node path)
      interpreter: "node",
      interpreter_args: "",
    },
  ],
};
