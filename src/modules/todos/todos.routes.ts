import { Router } from "express";
import { NotFoundError } from "@/errors/app-error.js";
import { requireAuth } from "@/modules/auth/auth.middleware.js";
import type { TodoService } from "./todos.service.js";

export function createListRoutes(todoService: TodoService) {
  const router = Router();
  router.use(requireAuth);

  router.post("/", async (req, res) => {
    const { name } = req.body;
    const list = await todoService.createList(req.userId as string, name);
    res.status(201).json(list);
  });

  router.get("/", async (req, res) => {
    const lists = await todoService.getListsByOwner(req.userId as string);
    res.json(lists);
  });

  router.get("/:id", async (req, res) => {
    const list = await todoService.getListById(
      req.params.id as string,
      req.userId as string,
    );

    if (!list) {
      throw new NotFoundError("list not found");
    }

    res.json(list);
  });

  router.post("/:id/todos", async (req, res) => {
    const { text } = req.body;
    const todo = await todoService.addTodo(
      req.params.id as string,
      text,
      req.userId as string,
    );

    if (!todo) {
      throw new NotFoundError("list not found");
    }

    res.status(201).json(todo);
  });

  return router;
}

export function createTodoRoutes(todoService: TodoService) {
  const router = Router();
  router.use(requireAuth);

  router.patch("/:id", async (req, res) => {
    const todo = await todoService.toggleTodo(
      req.params.id as string,
      req.userId as string,
    );

    if (!todo) {
      throw new NotFoundError("todo not found");
    }

    res.json(todo);
  });

  router.delete("/:id", async (req, res) => {
    const todo = await todoService.deleteTodo(
      req.params.id as string,
      req.userId as string,
    );

    if (!todo) {
      throw new NotFoundError("todo not found");
    }

    res.json(todo);
  });

  return router;
}
