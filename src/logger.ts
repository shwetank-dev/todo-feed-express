import pino from "pino";
import pretty from "pino-pretty";

export const createLogger = () => {
  return pino(
    process.env.ENVIRONMENT === "development"
      ? pretty({ colorize: true })
      : undefined,
  );
};

export const logger = createLogger();
