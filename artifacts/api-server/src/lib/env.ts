function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isProductionEnv(): boolean {
  return process.env["NODE_ENV"] === "production";
}

export function getPort(): number {
  const rawPort = readEnv("PORT");
  if (!rawPort) {
    throw new Error("PORT environment variable is required.");
  }

  const port = Number(rawPort);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT value: \"${rawPort}\"`);
  }
  return port;
}

export function getMongoDbUrl(): string {
  const mongodbUrl = readEnv("MONGODB_URL");
  if (!mongodbUrl) {
    throw new Error("MONGODB_URL environment variable is required.");
  }
  return mongodbUrl;
}

export function getJwtSecret(): string {
  const secret = readEnv("JWT_SECRET");
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required.");
  }

  if (isProductionEnv() && secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production.");
  }

  return secret;
}

export function getCookieDomain(): string | undefined {
  return readEnv("COOKIE_DOMAIN");
}

export function getCorsAllowedOrigins(): string[] {
  const raw = readEnv("CORS_ALLOWED_ORIGINS");

  if (!raw) {
    if (isProductionEnv()) {
      throw new Error("CORS_ALLOWED_ORIGINS is required in production.");
    }
    return ["http://localhost:5173", "http://127.0.0.1:5173"];
  }

  const origins = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        const parsed = new URL(value);
        return parsed.origin;
      } catch {
        throw new Error(`Invalid origin in CORS_ALLOWED_ORIGINS: \"${value}\"`);
      }
    });

  if (origins.length === 0) {
    throw new Error("CORS_ALLOWED_ORIGINS does not contain any valid origins.");
  }

  return Array.from(new Set(origins));
}

export type SeedAdminConfig = {
  username: string;
  password: string;
  name: string;
  email: string;
};

export function getSeedAdminConfig(): SeedAdminConfig | null {
  const username = readEnv("ADMIN_USERNAME");
  const password = readEnv("ADMIN_PASSWORD");

  if (username && !password) {
    throw new Error("ADMIN_PASSWORD is required when ADMIN_USERNAME is provided.");
  }
  if (password && !username) {
    throw new Error("ADMIN_USERNAME is required when ADMIN_PASSWORD is provided.");
  }
  if (!username || !password) {
    return null;
  }

  const normalizedUsername = username.toLowerCase();
  const name = readEnv("ADMIN_NAME") ?? "Kittangi Admin";
  const email = (readEnv("ADMIN_EMAIL") ?? `${normalizedUsername}@kittangi.local`).toLowerCase();

  return {
    username: normalizedUsername,
    password,
    name,
    email,
  };
}

export function validateRuntimeConfig(): void {
  getPort();
  getMongoDbUrl();
  getJwtSecret();
  getCorsAllowedOrigins();
}
