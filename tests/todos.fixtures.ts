import { todoLists, todos } from "@/modules/todos/todos.db-schema.js";
import { testDbClient } from "./setup.js";

export async function createTestList(ownerId: string, name: string) {
  const [list] = await testDbClient
    .insert(todoLists)
    .values({ ownerId, name })
    .returning();

  if (!list) {
    throw new Error("failed to insert test list");
  }

  return list;
}

export async function createTestTodo(listId: string, text: string) {
  const [todo] = await testDbClient
    .insert(todos)
    .values({ listId, text })
    .returning();

  if (!todo) {
    throw new Error("failed to insert test todo");
  }

  return todo;
}
