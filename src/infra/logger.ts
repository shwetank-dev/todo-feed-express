import pino from "pino";
import pretty from "pino-pretty";
import { reportError } from "@/infra/sentry.js";

type LogPayload = Record<string, unknown>;

const pinoInstance = pino(
  {
    level: process.env.ENVIRONMENT === "testing" ? "silent" : "info",
  },
  process.env.ENVIRONMENT === "development"
    ? pretty({ colorize: true })
    : undefined,
);

export const logger = {
  info(payload: LogPayload, message: string) {
    pinoInstance.info(payload, message);
  },
  warn(payload: LogPayload, message: string) {
    pinoInstance.warn(payload, message);
  },
  error(payload: LogPayload, message: string) {
    pinoInstance.error(payload, message);
    reportError(payload, message);
  },
  fatal(payload: LogPayload, message: string) {
    pinoInstance.fatal(payload, message);
    reportError(payload, message);
  },
};

export type Logger = typeof logger;
