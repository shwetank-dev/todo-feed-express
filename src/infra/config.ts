import z from "zod";

const configSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive(),
  ENVIRONMENT: z.enum(["development", "production", "testing", "staging"]),
  JWT_SECRET: z.string().min(1),
  SENTRY_DSN: z.string().optional(),
});

const parseResult = configSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error("invalid config:", z.prettifyError(parseResult.error));
  process.exit(1);
}

export const config = parseResult.data;
export type Config = typeof config;
