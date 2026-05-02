import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import type { RequestHandler } from "express";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

function normalizeOrigin(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed === "*") return "*";

  // Accept plain hostnames from env and normalize to URL origins.
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    return new URL(withProtocol).origin.toLowerCase();
  } catch {
    return trimmed.replace(/\/+$/, "").toLowerCase();
  }
}

const allowedOrigins = new Set(
  (process.env["CORS_ALLOWED_ORIGINS"] ?? "")
    .split(/[\s,]+/)
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean),
);

const corsOptions: cors.CorsOptions = {
  credentials: true,
  origin(origin, callback) {
    // Allow server-to-server and tools without origin header.
    if (!origin) return callback(null, true);

    const normalizedRequestOrigin = normalizeOrigin(origin);

    if (allowedOrigins.size === 0) {
      const isDev = process.env["NODE_ENV"] !== "production";
      return callback(null, isDev);
    }

    if (allowedOrigins.has("*")) {
      return callback(null, true);
    }

    const isAllowed =
      allowedOrigins.has(normalizedRequestOrigin) || allowedOrigins.has(origin);

    if (!isAllowed) {
      logger.warn(
        {
          origin,
          normalizedRequestOrigin,
          allowedOrigins: Array.from(allowedOrigins),
        },
        "CORS blocked origin",
      );
    }

    return callback(null, isAllowed);
  },
};

const preflightCors = cors(corsOptions) as RequestHandler;

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors(corsOptions));
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return preflightCors(req, res, next);
  }

  return next();
});
app.use(cookieParser());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use("/api", router);

export default app;
