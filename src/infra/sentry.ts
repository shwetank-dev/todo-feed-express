import * as Sentry from "@sentry/node";
import type { Config } from "@/infra/config.js";

export function initSentry(config: Config) {
  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.ENVIRONMENT,
    tracesSampleRate: config.ENVIRONMENT === "production" ? 0.1 : 1.0,
    beforeSend(event) {
      if (event.request?.data && typeof event.request.data === "object") {
        const data = event.request.data as Record<string, unknown>;
        if ("password" in data) {
          data.password = "[REDACTED]";
        }
      }

      if (event.request?.headers?.authorization) {
        event.request.headers.authorization = "[REDACTED]";
      }

      const scrubbed = JSON.stringify(event)
        .split(config.DATABASE_URL)
        .join("[REDACTED]");
      return JSON.parse(scrubbed);
    },
  });
}

export function reportError(payload: Record<string, unknown>, message: string) {
  if (payload.error instanceof Error) {
    Sentry.captureException(payload.error);
  } else {
    Sentry.captureMessage(message, "error");
  }
}
