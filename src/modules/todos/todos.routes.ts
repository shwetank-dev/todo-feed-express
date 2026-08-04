import { Router } from "express";
import { assertParam } from "@/lib/assert-param.js";
import { getValidatedBody, getValidatedQuery } from "@/lib/validate-request.js";
import { assertUserId, requireAuth } from "@/modules/auth/auth.middleware.js";
import {
  paginatedTodoListsResponseSchema,
  todoListResponseSchema,
  todoResponseSchema,
} from "./todos.dto.js";
import type { TodoService } from "./todos.service.js";
import {
  addTodoSchema,
  createListSchema,
  listTodosQuerySchema,
} from "./todos.validation.js";

export function createListRoutes(todoService: TodoService) {
  const router = Router();
  router.use(requireAuth);

  router.post("/", async (req, res) => {
    assertUserId(req);
    const { name } = getValidatedBody(req, createListSchema);
    const list = await todoService.createList(req.userId, name);
    res.status(201).json(todoListResponseSchema.parse(list));
  });

  router.get("/", async (req, res) => {
    assertUserId(req);
    const { cursor, limit } = getValidatedQuery(req, listTodosQuerySchema);
    const lists = await todoService.getListsByOwner(req.userId, {
      cursor,
      limit,
    });
    res.json(paginatedTodoListsResponseSchema.parse(lists));
  });

  router.get("/:id", async (req, res) => {
    assertUserId(req);
    assertParam(req, "id");
    const list = await todoService.getListById(req.params.id, req.userId);
    res.json(todoListResponseSchema.parse(list));
  });

  router.post("/:id/todos", async (req, res) => {
    assertUserId(req);
    assertParam(req, "id");
    const { text } = getValidatedBody(req, addTodoSchema);
    const todo = await todoService.addTodo(req.params.id, text, req.userId);
    res.status(201).json(todoResponseSchema.parse(todo));
  });

  return router;
}

export function createTodoRoutes(todoService: TodoService) {
  const router = Router();
  router.use(requireAuth);

  router.delete("/:id", async (req, res) => {
    assertUserId(req);
    assertParam(req, "id");
    const todo = await todoService.deleteTodo(req.params.id, req.userId);
    res.json(todoResponseSchema.parse(todo));
  });

  return router;
}
