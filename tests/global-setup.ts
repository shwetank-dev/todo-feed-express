import { config as loadEnv } from "dotenv";

export default async function setup() {
  loadEnv({ path: ".env.test" });

  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const { createDbClient } = await import("@/infra/db-client.js");
  const { config } = await import("@/infra/config.js");

  const db = createDbClient(config.DATABASE_URL);
  await migrate(db, { migrationsFolder: "./drizzle" });

  return async () => {
    await db.$client.end();
  };
}
