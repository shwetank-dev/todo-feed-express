import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { createErrorHandler } from "@/errors/error-handler.js";
import type { DbClient } from "@/infra/db-client.js";
import { dbHealthCheck } from "@/infra/db-client.js";
import type { Logger } from "@/infra/logger.js";
import { createAuthRoutes } from "@/modules/auth/auth.routes.js";
import { createAuthService } from "@/modules/auth/auth.service.js";
import {
  createActivityRoutes,
  createCommentRoutes,
  createFeedReadRoutes,
  createFeedRoutes,
  createFeedTodoRoutes,
} from "@/modules/feed/feed.routes.js";
import { createFeedService } from "@/modules/feed/feed.service.js";
import {
  createListRoutes,
  createTodoRoutes,
} from "@/modules/todos/todos.routes.js";
import { createTodoService } from "@/modules/todos/todos.service.js";
import { openApiDocument } from "@/openapi.js";

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

  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

  const authService = createAuthService(dbClient);
  app.use("/api/auth", createAuthRoutes(authService));

  const todoService = createTodoService(dbClient);
  app.use("/api/lists", createListRoutes(todoService));
  app.use("/api/todos", createTodoRoutes(todoService));

  const feedService = createFeedService(dbClient);
  app.use("/api/lists", createFeedRoutes(feedService));
  app.use("/api/todos", createFeedTodoRoutes(feedService));
  app.use("/api/feed", createFeedReadRoutes(feedService));
  app.use("/api/activities", createActivityRoutes(feedService));
  app.use("/api/comments", createCommentRoutes(feedService));

  app.use((_req, res) => {
    res.status(404).json({ error: "not found" });
  });

  app.use(createErrorHandler());

  return app;
}
