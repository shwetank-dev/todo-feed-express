import { createApp } from "@/app.js";
import { config } from "@/infra/config.js";
import { createDbClient } from "@/infra/db-client.js";
import { logger } from "@/infra/logger.js";
import { initSentry } from "@/infra/sentry.js";

initSentry(config);

const dbClient = createDbClient(config.DATABASE_URL);
const app = createApp(dbClient, logger);

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, "server listening");
});

const shutdown = (signal: string) => {
  logger.info({ signal }, "shutting down");

  server.close(async () => {
    await dbClient.$client.end();
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
