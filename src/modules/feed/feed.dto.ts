import { z } from "zod";
import { createPaginatedResponseSchema } from "@/lib/pagination.js";

export const FEED_ERROR_CODE = {
  ALREADY_FOLLOWING: "ALREADY_FOLLOWING",
  ALREADY_LIKED: "ALREADY_LIKED",
} as const;

export const activityResponseSchema = z.object({
  id: z.string(),
  listId: z.string(),
  listName: z.string(),
  todoId: z.string().nullable(),
  todoText: z.string().nullable(),
  type: z.string(),
  createdAt: z.iso.datetime(),
  likeCount: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
});

export const paginatedActivitiesResponseSchema = createPaginatedResponseSchema(
  activityResponseSchema,
);

export const commentResponseSchema = z.object({
  id: z.string(),
  activityId: z.string(),
  userId: z.string(),
  text: z.string(),
  createdAt: z.iso.datetime(),
});
