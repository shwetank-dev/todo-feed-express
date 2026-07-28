import type { Request } from "express";
import type { z } from "zod";
import { ValidationError } from "@/errors/app-error.js";

function toValidationError(
  message: string,
  error: z.ZodError,
): ValidationError {
  const issues = error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  return new ValidationError(message, issues);
}

export function getValidatedBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): z.infer<T> {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    throw toValidationError("invalid request body", result.error);
  }
  return result.data;
}

export function getValidatedQuery<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): z.infer<T> {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    throw toValidationError("invalid query parameters", result.error);
  }
  return result.data;
}
