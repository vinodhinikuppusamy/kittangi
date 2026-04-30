import mongoose from "mongoose";
import { logger } from "./lib/logger.js";

export async function connectDB(): Promise<void> {
  const uri = process.env["MONGODB_URL"];
  if (!uri) {
    throw new Error("MONGODB_URL environment variable is required.");
  }

  mongoose.connection.on("connected", () => logger.info("MongoDB connected"));
  mongoose.connection.on("error", (err) =>
    logger.error({ err }, "MongoDB connection error"),
  );

  await mongoose.connect(uri);
}
