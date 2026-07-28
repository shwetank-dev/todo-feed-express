import { z } from "zod";
import { createPaginationQuerySchema } from "@/lib/pagination.js";

export const createListSchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export const addTodoSchema = z.object({
  text: z.string().trim().min(1).max(2000),
});

export const listTodosQuerySchema = createPaginationQuerySchema();
export type ListTodosQuery = z.infer<typeof listTodosQuerySchema>;
