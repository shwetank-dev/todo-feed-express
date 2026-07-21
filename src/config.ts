import z from "zod";
import { logger } from "./logger.js";

const configSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive(),
  ENVIRONMENT: z.enum(["development", "production", "testing", "staging"]),
});

const parseResult = configSchema.safeParse(process.env);

if (!parseResult.success) {
  logger.fatal({ error: z.prettifyError(parseResult.error) }, "invalid config");
  process.exit(1);
}

export const config = parseResult.data;
