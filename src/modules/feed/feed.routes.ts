import { Router } from "express";
import { assertParam } from "@/lib/assert-param.js";
import { getValidatedBody, getValidatedQuery } from "@/lib/validate-request.js";
import { assertUserId, requireAuth } from "@/modules/auth/auth.middleware.js";
import { todoResponseSchema } from "@/modules/todos/todos.dto.js";
import {
  commentResponseSchema,
  paginatedActivitiesResponseSchema,
} from "./feed.dto.js";
import type { FeedService } from "./feed.service.js";
import { addCommentSchema, feedQuerySchema } from "./feed.validation.js";

export function createFeedRoutes(feedService: FeedService) {
  const router = Router();
  router.use(requireAuth);

  router.post("/:id/follow", async (req, res) => {
    assertUserId(req);
    assertParam(req, "id");
    await feedService.followList(req.params.id, req.userId);
    res.status(204).send();
  });

  router.delete("/:id/follow", async (req, res) => {
    assertUserId(req);
    assertParam(req, "id");
    await feedService.unfollowList(req.params.id, req.userId);
    res.status(204).send();
  });

  return router;
}

export function createFeedReadRoutes(feedService: FeedService) {
  const router = Router();
  router.use(requireAuth);

  router.get("/", async (req, res) => {
    assertUserId(req);
    const { cursor, limit } = getValidatedQuery(req, feedQuerySchema);
    const feed = await feedService.getFeedForUser(req.userId, {
      cursor,
      limit,
    });
    res.json(
      paginatedActivitiesResponseSchema.parse({
        ...feed,
        items: feed.items.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
        })),
      }),
    );
  });

  return router;
}

export function createActivityRoutes(feedService: FeedService) {
  const router = Router();
  router.use(requireAuth);

  router.post("/:id/like", async (req, res) => {
    assertUserId(req);
    assertParam(req, "id");
    await feedService.likeActivity(req.params.id, req.userId);
    res.status(204).send();
  });

  router.delete("/:id/like", async (req, res) => {
    assertUserId(req);
    assertParam(req, "id");
    await feedService.unlikeActivity(req.params.id, req.userId);
    res.status(204).send();
  });

  router.post("/:id/comments", async (req, res) => {
    assertUserId(req);
    assertParam(req, "id");
    const { text } = getValidatedBody(req, addCommentSchema);
    const comment = await feedService.addComment(
      req.params.id,
      req.userId,
      text,
    );
    res.status(201).json(
      commentResponseSchema.parse({
        ...comment,
        createdAt: comment.createdAt.toISOString(),
      }),
    );
  });

  return router;
}

export function createCommentRoutes(feedService: FeedService) {
  const router = Router();
  router.use(requireAuth);

  router.delete("/:id", async (req, res) => {
    assertUserId(req);
    assertParam(req, "id");
    const comment = await feedService.deleteComment(req.params.id, req.userId);
    res.json(
      commentResponseSchema.parse({
        ...comment,
        createdAt: comment.createdAt.toISOString(),
      }),
    );
  });

  return router;
}

export function createFeedTodoRoutes(feedService: FeedService) {
  const router = Router();
  router.use(requireAuth);

  router.patch("/:id", async (req, res) => {
    assertUserId(req);
    assertParam(req, "id");
    const todo = await feedService.completeTodo(req.params.id, req.userId);
    res.json(todoResponseSchema.parse(todo));
  });

  return router;
}
