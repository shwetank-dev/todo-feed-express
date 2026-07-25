import { sql } from "drizzle-orm";
import { afterAll, beforeEach } from "vitest";
import { config } from "@/infra/config.js";
import { createDbClient } from "@/infra/db-client.js";
import { todoLists, todos } from "@/modules/todos/todos.db-schema.js";
import { users } from "@/modules/users/users.db-schema.js";

export const testDbClient = createDbClient(config.DATABASE_URL);

beforeEach(async () => {
  await testDbClient.execute(
    sql`TRUNCATE TABLE ${todos}, ${todoLists}, ${users} RESTART IDENTITY CASCADE`,
  );
});

afterAll(async () => {
  await testDbClient.$client.end();
});
