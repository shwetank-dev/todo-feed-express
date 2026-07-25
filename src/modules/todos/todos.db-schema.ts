import { boolean, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { users } from "@/modules/users/users.db-schema.js";

export const todoLists = pgTable(
  "todo_lists",
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id),
    name: text().notNull(),
  },
  (table) => [index("todo_lists_owner_id_idx").on(table.ownerId)],
);

export const todos = pgTable(
  "todos",
  {
    id: uuid().primaryKey().defaultRandom(),
    listId: uuid()
      .notNull()
      .references(() => todoLists.id),
    text: text().notNull(),
    done: boolean().notNull().default(false),
  },
  (table) => [index("todos_list_id_idx").on(table.listId)],
);
