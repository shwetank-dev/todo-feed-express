import { sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import {
  drizzle,
  type PostgresJsQueryResultHKT,
} from "drizzle-orm/postgres-js";
import postgres from "postgres";

export const createDbClient = (connectionString: string) => {
  const sql = postgres(connectionString);
  return drizzle(sql, { casing: "snake_case" });
};

export type DbClient = ReturnType<typeof createDbClient>;

// Shared base both a pool-wide DbClient and a transaction (`tx`) satisfy.
// Unlike DbClient, this has no `$client` — a transaction isn't a standalone
// connection. Services should accept this instead of DbClient wherever they
// might be constructed against a transaction (e.g. feed.service.ts's
// completeTodo building a transaction-scoped todos.service.ts instance).
export type QueryClient = PgDatabase<
  PostgresJsQueryResultHKT,
  Record<string, never>
>;

export const dbHealthCheck = async (client: DbClient) => {
  await client.execute(sql`SELECT 1`);
};
