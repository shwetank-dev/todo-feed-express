import { eq } from "drizzle-orm";
import {
  activities,
  activityComments,
  activityLikes,
  listFollows,
} from "@/modules/feed/feed.db-schema.js";
import { testDbClient } from "./setup.js";

export async function createTestFollow(userId: string, listId: string) {
  const [follow] = await testDbClient
    .insert(listFollows)
    .values({ userId, listId })
    .returning();

  if (!follow) {
    throw new Error("failed to insert test follow");
  }

  return follow;
}

export async function getActivitiesForTodo(todoId: string) {
  return testDbClient
    .select()
    .from(activities)
    .where(eq(activities.todoId, todoId));
}

export async function createTestActivity(listId: string, todoId: string) {
  const [activity] = await testDbClient
    .insert(activities)
    .values({ listId, todoId, type: "todo_completed" })
    .returning();

  if (!activity) {
    throw new Error("failed to insert test activity");
  }

  return activity;
}

export async function createTestLike(userId: string, activityId: string) {
  const [like] = await testDbClient
    .insert(activityLikes)
    .values({ userId, activityId })
    .returning();

  if (!like) {
    throw new Error("failed to insert test like");
  }

  return like;
}

export async function createTestComment(
  userId: string,
  activityId: string,
  text: string,
) {
  const [comment] = await testDbClient
    .insert(activityComments)
    .values({ userId, activityId, text })
    .returning();

  if (!comment) {
    throw new Error("failed to insert test comment");
  }

  return comment;
}
