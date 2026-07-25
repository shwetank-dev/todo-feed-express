import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export const createDbClient = (connectionString: string) => {
  const sql = postgres(connectionString);
  return drizzle(sql, { casing: "snake_case" });
};

export type DbClient = ReturnType<typeof createDbClient>;

export const dbHealthCheck = async (client: DbClient) => {
  await client.execute(sql`SELECT 1`);
};
