import type { NextFunction, Request, Response } from "express";
import type { Logger } from "@/infra/logger.js";
import { AppError, ValidationError } from "./app-error.js";

export function createErrorHandler(logger: Logger) {
  return (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
          ...(err instanceof ValidationError ? { issues: err.issues } : {}),
        },
      });
      return;
    }

    logger.error({ error: err }, "unhandled error");
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "internal server error" },
    });
  };
}
