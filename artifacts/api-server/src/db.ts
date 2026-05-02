import mongoose from "mongoose";
import { logger } from "./lib/logger.js";
import { getMongoDbUrl } from "./lib/env.js";

export async function connectDB(): Promise<void> {
  const uri = getMongoDbUrl();

  mongoose.connection.on("connected", () => logger.info("MongoDB connected"));
  mongoose.connection.on("error", (err) =>
    logger.error({ err }, "MongoDB connection error"),
  );

  await mongoose.connect(uri);
}
