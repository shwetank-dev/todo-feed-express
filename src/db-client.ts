import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "@/config.js";

export const createDbClient = (connectionString: string) => {
  const sql = postgres(connectionString);
  return drizzle(sql);
};

export const dbClient = createDbClient(config.DATABASE_URL);

export const dbHealthCheck = async () => {
  await dbClient.execute(sql`SELECT 1`);
};
