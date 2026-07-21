import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const ping = pgTable("ping", {
  id: serial("id").primaryKey(),
  message: text("message"),
});
