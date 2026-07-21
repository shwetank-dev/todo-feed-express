import express from "express";
import { config } from "@/config.js";
import { dbHealthCheck } from "@/db.js";
import { logger } from "@/logger.js";

const app = express();

app.get("/health", async (_req, res) => {
  let isDbOk: boolean = false;

  try {
    await dbHealthCheck();
    isDbOk = true;
  } catch (err) {
    logger.error({ error: err }, "db health check failed");
  }

  res.json({ server: "ok", db: isDbOk });
});

app.listen(config.PORT, () => {
  logger.info(`server listening on ${config.PORT}`);
});
