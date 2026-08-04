import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { todoLists, todos } from "@/modules/todos/todos.db-schema.js";
import { users } from "@/modules/users/users.db-schema.js";

export const listFollows = pgTable(
  "list_follows",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    listId: uuid()
      .notNull()
      .references(() => todoLists.id),
  },
  (table) => [
    index("list_follows_user_id_idx").on(table.userId),
    index("list_follows_list_id_idx").on(table.listId),
    // a user can only follow a given list once
    uniqueIndex("list_follows_user_id_list_id_idx").on(
      table.userId,
      table.listId,
    ),
  ],
);

export const activities = pgTable(
  "activities",
  {
    id: uuid().primaryKey().defaultRandom(),
    listId: uuid()
      .notNull()
      .references(() => todoLists.id),
    // nullable: "list_created" has no specific todo attached
    todoId: uuid().references(() => todos.id),
    type: text().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (table) => [
    index("activities_list_id_idx").on(table.listId),
    index("activities_todo_id_idx").on(table.todoId),
  ],
);

export const activityLikes = pgTable(
  "activity_likes",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    activityId: uuid()
      .notNull()
      .references(() => activities.id),
  },
  (table) => [
    // a user can only like a given activity once; also serves as the
    // "has this user already liked this?" lookup index
    uniqueIndex("activity_likes_user_id_activity_id_idx").on(
      table.userId,
      table.activityId,
    ),
  ],
);

export const activityComments = pgTable(
  "activity_comments",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    activityId: uuid()
      .notNull()
      .references(() => activities.id),
    text: text().notNull(),
    createdAt: timestamp().notNull().defaultNow(),
  },
  (table) => [index("activity_comments_activity_id_idx").on(table.activityId)],
);
