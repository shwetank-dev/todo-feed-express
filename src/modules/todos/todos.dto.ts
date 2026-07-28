import { z } from "zod";
import { createPaginatedResponseSchema } from "@/lib/pagination.js";

export const todoListResponseSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  name: z.string(),
});

export const todoResponseSchema = z.object({
  id: z.string(),
  listId: z.string(),
  text: z.string(),
  done: z.boolean(),
});

export const paginatedTodoListsResponseSchema = createPaginatedResponseSchema(
  todoListResponseSchema,
);
