import type { NextFunction, Request, Response } from "express";
import { logger } from "@/infra/logger.js";
import { AppError, ValidationError } from "./app-error.js";
import type { ErrorResponse } from "./error-response.schema.js";

export function createErrorHandler() {
  return (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      const body: ErrorResponse = {
        error: {
          code: err.code,
          message: err.message,
          ...(err instanceof ValidationError ? { issues: err.issues } : {}),
        },
      };
      res.status(err.httpStatusCode).json(body);
      return;
    }

    logger.error({ error: err }, "unhandled error");
    const body: ErrorResponse = {
      error: { code: "INTERNAL_ERROR", message: "internal server error" },
    };
    res.status(500).json(body);
  };
}
