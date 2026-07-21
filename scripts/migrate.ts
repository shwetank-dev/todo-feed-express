import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// biome-ignore lint/style/noNonNullAssertion: <DATABASE_URL must be present>
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(sql);

await migrate(db, { migrationsFolder: "./drizzle" });

console.log("migrations applied");
process.exit(0);
