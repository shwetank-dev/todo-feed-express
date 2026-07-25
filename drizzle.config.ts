import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/modules/*/*.db-schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  dbCredentials: {
    // biome-ignore lint/style/noNonNullAssertion: <DATABASE_URL must be present>
    url: process.env.DATABASE_URL!,
  },
});
