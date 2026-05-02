import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import type { RequestHandler } from "express";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { getCorsAllowedOrigins } from "./lib/env.js";

const app: Express = express();

let allowedOriginsCache: Set<string> | null = null;

function getAllowedOrigins(): Set<string> {
  if (!allowedOriginsCache) {
    allowedOriginsCache = new Set(getCorsAllowedOrigins());
  }
  return allowedOriginsCache;
}

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
app.use(
  cors({
    origin(origin, callback) {
      // Allow server-to-server requests and non-browser clients that omit origin.
      if (!origin) {
        callback(null, true);
        return;
      }

      if (getAllowedOrigins().has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use("/api", router);

export default app;
