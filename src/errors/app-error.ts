export class AppError extends Error {
  constructor(
    public httpStatusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "not found") {
    super(404, "NOT_FOUND", message);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "unauthenticated") {
    super(401, "UNAUTHENTICATED", message);
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(409, code, message);
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public issues: { path: string; message: string }[],
  ) {
    super(400, "VALIDATION_ERROR", message);
  }
}
