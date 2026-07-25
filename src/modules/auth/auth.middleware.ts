import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { UnauthenticatedError } from "@/errors/app-error.js";
import { config } from "@/infra/config.js";
import { logger } from "@/infra/logger.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : undefined;

  if (!token) {
    logger.warn({ path: req.path }, "rejected request with missing token");
    throw new UnauthenticatedError("missing token");
  }

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch {
    logger.warn(
      { path: req.path },
      "rejected request with invalid or expired token",
    );
    throw new UnauthenticatedError("invalid or expired token");
  }
}
