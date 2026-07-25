import express from "express";
import helmet from "helmet";
import { createErrorHandler } from "@/errors/error-handler.js";
import type { DbClient } from "@/infra/db-client.js";
import { dbHealthCheck } from "@/infra/db-client.js";
import type { Logger } from "@/infra/logger.js";
import { createAuthRoutes } from "@/modules/auth/auth.routes.js";
import { createAuthService } from "@/modules/auth/auth.service.js";
import {
  createListRoutes,
  createTodoRoutes,
} from "@/modules/todos/todos.routes.js";
import { createTodoService } from "@/modules/todos/todos.service.js";

export function createApp(dbClient: DbClient, logger: Logger) {
  const app = express();
  app.use(helmet());
  app.use(express.json());

  app.get("/health", async (_req, res) => {
    let isDbOk = false;

    try {
      await dbHealthCheck(dbClient);
      isDbOk = true;
    } catch (err) {
      logger.error({ error: err }, "db health check failed");
    }

    res.json({ server: "ok", db: isDbOk });
  });

  const authService = createAuthService(dbClient);
  app.use("/api/auth", createAuthRoutes(authService));

  const todoService = createTodoService(dbClient);
  app.use("/api/lists", createListRoutes(todoService));
  app.use("/api/todos", createTodoRoutes(todoService));

  app.use((_req, res) => {
    res.status(404).json({ error: "not found" });
  });

  app.use(createErrorHandler(logger));

  return app;
}
