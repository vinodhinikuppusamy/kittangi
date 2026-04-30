import "dotenv/config";
import app from "./app.js";
import { connectDB } from "./db.js";
import { seedIfEmpty } from "./seed.js";
import { logger } from "./lib/logger.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

(async () => {
  try {
    await connectDB();
    await seedIfEmpty();
    app.listen(port, (err?: Error) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  } catch (err) {
    logger.error({ err }, "Failed to start server");
    process.exit(1);
  }
})();
