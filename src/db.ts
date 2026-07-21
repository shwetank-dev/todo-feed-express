import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "@/config.js";

export const createDb = (connectionString: string) => {
  const sql = postgres(connectionString);
  return drizzle(sql);
};

export const db = createDb(config.DATABASE_URL);

export const dbHealthCheck = async () => {
  await db.execute(sql`SELECT 1`);
};
