import { eq, sql } from "drizzle-orm";
import type { DbClient } from "@/infra/db-client.js";
import { todoLists, todos } from "./todos.db-schema.js";

export function createTodoService(dbClient: DbClient) {
  return {
    createList: async (ownerId: string, name: string) => {
      const [list] = await dbClient
        .insert(todoLists)
        .values({ ownerId, name })
        .returning();
      return list;
    },

    getListById: async (listId: string, ownerId: string) => {
      const [list] = await dbClient
        .select()
        .from(todoLists)
        .where(eq(todoLists.id, listId));

      if (!list || list.ownerId !== ownerId) {
        return null;
      }

      return list;
    },

    getListsByOwner: async (ownerId: string) => {
      return dbClient
        .select()
        .from(todoLists)
        .where(eq(todoLists.ownerId, ownerId));
    },

    addTodo: async (listId: string, text: string, ownerId: string) => {
      const [list] = await dbClient
        .select()
        .from(todoLists)
        .where(eq(todoLists.id, listId));

      if (!list || list.ownerId !== ownerId) {
        return null;
      }

      const [todo] = await dbClient
        .insert(todos)
        .values({ listId, text })
        .returning();
      return todo;
    },

    toggleTodo: async (todoId: string, ownerId: string) => {
      const [row] = await dbClient
        .select({ ownerId: todoLists.ownerId })
        .from(todos)
        .innerJoin(todoLists, eq(todos.listId, todoLists.id))
        .where(eq(todos.id, todoId));

      if (!row || row.ownerId !== ownerId) {
        return null;
      }

      const [todo] = await dbClient
        .update(todos)
        .set({ done: sql`not ${todos.done}` })
        .where(eq(todos.id, todoId))
        .returning();
      return todo;
    },

    deleteTodo: async (todoId: string, ownerId: string) => {
      const [row] = await dbClient
        .select({ ownerId: todoLists.ownerId })
        .from(todos)
        .innerJoin(todoLists, eq(todos.listId, todoLists.id))
        .where(eq(todos.id, todoId));

      if (!row || row.ownerId !== ownerId) {
        return null;
      }

      const [todo] = await dbClient
        .delete(todos)
        .where(eq(todos.id, todoId))
        .returning();
      return todo;
    },
  };
}

export type TodoService = ReturnType<typeof createTodoService>;
