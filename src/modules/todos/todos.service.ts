import { and, eq, gt, sql } from "drizzle-orm";
import { NotFoundError } from "@/errors/app-error.js";
import type { QueryClient } from "@/infra/db-client.js";
import { paginateRows } from "@/lib/pagination.js";
import { todoLists, todos } from "./todos.db-schema.js";
import type { ListTodosQuery } from "./todos.validation.js";

export function createTodoService(dbClient: QueryClient) {
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
        throw new NotFoundError("list not found");
      }

      return list;
    },

    getListsByOwner: async (
      ownerId: string,
      { cursor, limit }: ListTodosQuery,
    ) => {
      const rows = await dbClient
        .select()
        .from(todoLists)
        .where(
          cursor
            ? and(eq(todoLists.ownerId, ownerId), gt(todoLists.id, cursor))
            : eq(todoLists.ownerId, ownerId),
        )
        .orderBy(todoLists.id)
        .limit(limit + 1);

      return paginateRows(rows, limit, (row) => row.id);
    },

    addTodo: async (listId: string, text: string, ownerId: string) => {
      const [list] = await dbClient
        .select()
        .from(todoLists)
        .where(eq(todoLists.id, listId));

      if (!list || list.ownerId !== ownerId) {
        throw new NotFoundError("list not found");
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
        throw new NotFoundError("todo not found");
      }

      const [todo] = await dbClient
        .update(todos)
        .set({ done: sql`not ${todos.done}` })
        .where(eq(todos.id, todoId))
        .returning();

      if (!todo) {
        throw new Error("update returned no row");
      }

      return todo;
    },

    deleteTodo: async (todoId: string, ownerId: string) => {
      const [row] = await dbClient
        .select({ ownerId: todoLists.ownerId })
        .from(todos)
        .innerJoin(todoLists, eq(todos.listId, todoLists.id))
        .where(eq(todos.id, todoId));

      if (!row || row.ownerId !== ownerId) {
        throw new NotFoundError("todo not found");
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
