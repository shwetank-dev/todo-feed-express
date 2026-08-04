import { and, desc, eq, lt, sql } from "drizzle-orm";
import { ConflictError, NotFoundError } from "@/errors/app-error.js";
import type { QueryClient } from "@/infra/db-client.js";
import { isUniqueViolation } from "@/infra/postgres-errors.js";
import { paginateRows } from "@/lib/pagination.js";
import { todoLists, todos } from "@/modules/todos/todos.db-schema.js";
import { createTodoService } from "@/modules/todos/todos.service.js";
import {
  activities,
  activityComments,
  activityLikes,
  listFollows,
} from "./feed.db-schema.js";
import { FEED_ERROR_CODE } from "./feed.dto.js";
import type { FeedQuery } from "./feed.validation.js";

export function createFeedService(dbClient: QueryClient) {
  return {
    followList: async (listId: string, userId: string): Promise<void> => {
      const [list] = await dbClient
        .select()
        .from(todoLists)
        .where(eq(todoLists.id, listId));

      if (!list) {
        throw new NotFoundError("list not found");
      }

      try {
        await dbClient.insert(listFollows).values({ userId, listId });
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new ConflictError(
            FEED_ERROR_CODE.ALREADY_FOLLOWING,
            "already following this list",
          );
        }
        throw err;
      }
    },

    unfollowList: async (listId: string, userId: string): Promise<void> => {
      const [follow] = await dbClient
        .delete(listFollows)
        .where(
          and(eq(listFollows.userId, userId), eq(listFollows.listId, listId)),
        )
        .returning();

      if (!follow) {
        throw new NotFoundError("not following this list");
      }
    },
    getFeedForUser: async (userId: string, { cursor, limit }: FeedQuery) => {
      const rows = await dbClient
        .select({
          id: activities.id,
          listId: activities.listId,
          listName: todoLists.name,
          todoId: activities.todoId,
          todoText: todos.text,
          type: activities.type,
          createdAt: activities.createdAt,
          likeCount: sql<number>`(
            select count(*)::int from ${activityLikes}
            where ${activityLikes.activityId} = ${activities.id}
          )`,
          commentCount: sql<number>`(
            select count(*)::int from ${activityComments}
            where ${activityComments.activityId} = ${activities.id}
          )`,
        })
        .from(activities)
        .innerJoin(listFollows, eq(activities.listId, listFollows.listId))
        .innerJoin(todoLists, eq(activities.listId, todoLists.id))
        .leftJoin(todos, eq(activities.todoId, todos.id))
        .where(
          cursor
            ? and(
                eq(listFollows.userId, userId),
                lt(activities.createdAt, new Date(cursor)),
              )
            : eq(listFollows.userId, userId),
        )
        .orderBy(desc(activities.createdAt))
        .limit(limit + 1);

      return paginateRows(rows, limit, (row) => row.createdAt.toISOString());
    },

    likeActivity: async (activityId: string, userId: string): Promise<void> => {
      const [activity] = await dbClient
        .select()
        .from(activities)
        .where(eq(activities.id, activityId));

      if (!activity) {
        throw new NotFoundError("activity not found");
      }

      try {
        await dbClient.insert(activityLikes).values({ userId, activityId });
      } catch (err) {
        if (isUniqueViolation(err)) {
          throw new ConflictError(
            FEED_ERROR_CODE.ALREADY_LIKED,
            "already liked this activity",
          );
        }
        throw err;
      }
    },

    unlikeActivity: async (
      activityId: string,
      userId: string,
    ): Promise<void> => {
      const [like] = await dbClient
        .delete(activityLikes)
        .where(
          and(
            eq(activityLikes.userId, userId),
            eq(activityLikes.activityId, activityId),
          ),
        )
        .returning();

      if (!like) {
        throw new NotFoundError("not liked this activity");
      }
    },

    addComment: async (activityId: string, userId: string, text: string) => {
      const [activity] = await dbClient
        .select()
        .from(activities)
        .where(eq(activities.id, activityId));

      if (!activity) {
        throw new NotFoundError("activity not found");
      }

      const [comment] = await dbClient
        .insert(activityComments)
        .values({ userId, activityId, text })
        .returning();

      if (!comment) {
        throw new Error("insert returned no row");
      }

      return comment;
    },

    deleteComment: async (commentId: string, userId: string) => {
      const [comment] = await dbClient
        .delete(activityComments)
        .where(
          and(
            eq(activityComments.id, commentId),
            eq(activityComments.userId, userId),
          ),
        )
        .returning();

      if (!comment) {
        throw new NotFoundError("comment not found");
      }

      return comment;
    },

    completeTodo: async (todoId: string, ownerId: string) => {
      return dbClient.transaction(async (tx) => {
        const txTodoService = createTodoService(tx);
        const todo = await txTodoService.toggleTodo(todoId, ownerId);
        if (todo.done) {
          await tx.insert(activities).values({
            listId: todo.listId,
            todoId: todo.id,
            type: "todo_completed",
          });
        }
        return todo;
      });
    },
  };
}

export type FeedService = ReturnType<typeof createFeedService>;
