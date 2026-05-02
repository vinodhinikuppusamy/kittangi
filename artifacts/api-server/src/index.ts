import "./lib/load-env.js";
import app from "./app.js";
import { connectDB } from "./db.js";
import { seedIfEmpty } from "./seed.js";
import { logger } from "./lib/logger.js";
import { getPort, validateRuntimeConfig } from "./lib/env.js";

validateRuntimeConfig();
const port = getPort();

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
