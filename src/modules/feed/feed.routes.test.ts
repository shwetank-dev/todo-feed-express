import {
  createTestActivity,
  createTestComment,
  createTestFollow,
  createTestLike,
  getActivitiesForTodo,
} from "@test/feed.fixtures.js";
import { testDbClient } from "@test/setup.js";
import { createTestList, createTestTodo } from "@test/todos.fixtures.js";
import { createAuthenticatedUser } from "@test/users.fixtures.js";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "@/app.js";
import { logger } from "@/infra/logger.js";

const app = createApp(testDbClient, logger);

let owner: Awaited<ReturnType<typeof createAuthenticatedUser>>;
let follower: Awaited<ReturnType<typeof createAuthenticatedUser>>;

beforeEach(async () => {
  owner = await createAuthenticatedUser("owner", "some-password");
  follower = await createAuthenticatedUser("follower", "some-password");
});

describe("POST /api/lists/:id/follow", () => {
  it("follows a list", async () => {
    const list = await createTestList(owner.user.id, "groceries");

    const res = await request(app)
      .post(`/api/lists/${list.id}/follow`)
      .set("Authorization", `Bearer ${follower.token}`);

    expect(res.status).toBe(204);
  });

  it("returns 404 when the list doesn't exist", async () => {
    const res = await request(app)
      .post("/api/lists/00000000-0000-0000-0000-000000000000/follow")
      .set("Authorization", `Bearer ${follower.token}`);

    expect(res.status).toBe(404);
  });

  it("returns 409 when already following the list", async () => {
    const list = await createTestList(owner.user.id, "groceries");
    await createTestFollow(follower.user.id, list.id);

    const res = await request(app)
      .post(`/api/lists/${list.id}/follow`)
      .set("Authorization", `Bearer ${follower.token}`);

    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/lists/:id/follow", () => {
  it("unfollows a list", async () => {
    const list = await createTestList(owner.user.id, "groceries");
    await createTestFollow(follower.user.id, list.id);

    const res = await request(app)
      .delete(`/api/lists/${list.id}/follow`)
      .set("Authorization", `Bearer ${follower.token}`);

    expect(res.status).toBe(204);
  });

  it("returns 404 when not following the list", async () => {
    const list = await createTestList(owner.user.id, "groceries");

    const res = await request(app)
      .delete(`/api/lists/${list.id}/follow`)
      .set("Authorization", `Bearer ${follower.token}`);

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/todos/:id (activity generation)", () => {
  it("creates an activity when a todo is completed", async () => {
    const list = await createTestList(owner.user.id, "groceries");
    const todo = await createTestTodo(list.id, "buy milk");

    const res = await request(app)
      .patch(`/api/todos/${todo.id}`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body.done).toBe(true);

    const activities = await getActivitiesForTodo(todo.id);
    expect(activities).toHaveLength(1);
    expect(activities[0]?.type).toBe("todo_completed");
    expect(activities[0]?.listId).toBe(list.id);
  });

  it("does not create an activity when a todo is un-completed", async () => {
    const list = await createTestList(owner.user.id, "groceries");
    const todo = await createTestTodo(list.id, "buy milk");

    // first toggle: not done -> done
    await request(app)
      .patch(`/api/todos/${todo.id}`)
      .set("Authorization", `Bearer ${owner.token}`);

    // second toggle: done -> not done
    const res = await request(app)
      .patch(`/api/todos/${todo.id}`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(res.body.done).toBe(false);

    const activities = await getActivitiesForTodo(todo.id);
    expect(activities).toHaveLength(1);
  });
});

describe("GET /api/feed", () => {
  it("returns activities from followed lists only", async () => {
    const followedList = await createTestList(owner.user.id, "groceries");
    const otherList = await createTestList(owner.user.id, "misc");
    const followedTodo = await createTestTodo(followedList.id, "buy milk");
    const otherTodo = await createTestTodo(otherList.id, "unrelated");
    await createTestFollow(follower.user.id, followedList.id);

    await request(app)
      .patch(`/api/todos/${followedTodo.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    await request(app)
      .patch(`/api/todos/${otherTodo.id}`)
      .set("Authorization", `Bearer ${owner.token}`);

    const res = await request(app)
      .get("/api/feed")
      .set("Authorization", `Bearer ${follower.token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].listId).toBe(followedList.id);
    expect(res.body.items[0].listName).toBe("groceries");
    expect(res.body.items[0].todoText).toBe("buy milk");
    expect(res.body.items[0].type).toBe("todo_completed");
  });

  it("returns activities most-recent-first", async () => {
    const list = await createTestList(owner.user.id, "groceries");
    await createTestFollow(follower.user.id, list.id);
    const todoA = await createTestTodo(list.id, "task a");
    const todoB = await createTestTodo(list.id, "task b");

    await request(app)
      .patch(`/api/todos/${todoA.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    await request(app)
      .patch(`/api/todos/${todoB.id}`)
      .set("Authorization", `Bearer ${owner.token}`);

    const res = await request(app)
      .get("/api/feed")
      .set("Authorization", `Bearer ${follower.token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].todoId).toBe(todoB.id);
    expect(res.body.items[1].todoId).toBe(todoA.id);
  });

  it("paginates with a cursor when there are more activities than the limit", async () => {
    const list = await createTestList(owner.user.id, "groceries");
    await createTestFollow(follower.user.id, list.id);
    const todoA = await createTestTodo(list.id, "task a");
    const todoB = await createTestTodo(list.id, "task b");
    const todoC = await createTestTodo(list.id, "task c");

    for (const todo of [todoA, todoB, todoC]) {
      await request(app)
        .patch(`/api/todos/${todo.id}`)
        .set("Authorization", `Bearer ${owner.token}`);
    }

    const firstPage = await request(app)
      .get("/api/feed")
      .query({ limit: 2 })
      .set("Authorization", `Bearer ${follower.token}`);

    expect(firstPage.status).toBe(200);
    expect(firstPage.body.items).toHaveLength(2);
    expect(firstPage.body.nextCursor).not.toBeNull();

    const secondPage = await request(app)
      .get("/api/feed")
      .query({ limit: 2, cursor: firstPage.body.nextCursor })
      .set("Authorization", `Bearer ${follower.token}`);

    expect(secondPage.status).toBe(200);
    expect(secondPage.body.items).toHaveLength(1);
    expect(secondPage.body.nextCursor).toBeNull();
  });

  it("does not return activities from unfollowed lists", async () => {
    const list = await createTestList(owner.user.id, "groceries");
    const todo = await createTestTodo(list.id, "buy milk");

    await request(app)
      .patch(`/api/todos/${todo.id}`)
      .set("Authorization", `Bearer ${owner.token}`);

    const res = await request(app)
      .get("/api/feed")
      .set("Authorization", `Bearer ${follower.token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });

  it("includes like and comment counts", async () => {
    const list = await createTestList(owner.user.id, "groceries");
    const todo = await createTestTodo(list.id, "buy milk");
    const activity = await createTestActivity(list.id, todo.id);
    await createTestFollow(follower.user.id, list.id);
    await createTestLike(follower.user.id, activity.id);
    await createTestComment(follower.user.id, activity.id, "nice");

    const res = await request(app)
      .get("/api/feed")
      .set("Authorization", `Bearer ${follower.token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].likeCount).toBe(1);
    expect(res.body.items[0].commentCount).toBe(1);
  });
});

describe("POST /api/activities/:id/like", () => {
  it("likes an activity", async () => {
    const list = await createTestList(owner.user.id, "groceries");
    const todo = await createTestTodo(list.id, "buy milk");
    const activity = await createTestActivity(list.id, todo.id);

    const res = await request(app)
      .post(`/api/activities/${activity.id}/like`)
      .set("Authorization", `Bearer ${follower.token}`);

    expect(res.status).toBe(204);
  });

  it("returns 404 when the activity doesn't exist", async () => {
    const res = await request(app)
      .post("/api/activities/00000000-0000-0000-0000-000000000000/like")
      .set("Authorization", `Bearer ${follower.token}`);

    expect(res.status).toBe(404);
  });

  it("returns 409 when already liked", async () => {
    const list = await createTestList(owner.user.id, "groceries");
    const todo = await createTestTodo(list.id, "buy milk");
    const activity = await createTestActivity(list.id, todo.id);
    await createTestLike(follower.user.id, activity.id);

    const res = await request(app)
      .post(`/api/activities/${activity.id}/like`)
      .set("Authorization", `Bearer ${follower.token}`);

    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/activities/:id/like", () => {
  it("unlikes an activity", async () => {
    const list = await createTestList(owner.user.id, "groceries");
    const todo = await createTestTodo(list.id, "buy milk");
    const activity = await createTestActivity(list.id, todo.id);
    await createTestLike(follower.user.id, activity.id);

    const res = await request(app)
      .delete(`/api/activities/${activity.id}/like`)
      .set("Authorization", `Bearer ${follower.token}`);

    expect(res.status).toBe(204);
  });

  it("returns 404 when not liked", async () => {
    const list = await createTestList(owner.user.id, "groceries");
    const todo = await createTestTodo(list.id, "buy milk");
    const activity = await createTestActivity(list.id, todo.id);

    const res = await request(app)
      .delete(`/api/activities/${activity.id}/like`)
      .set("Authorization", `Bearer ${follower.token}`);

    expect(res.status).toBe(404);
  });
});

describe("POST /api/activities/:id/comments", () => {
  it("adds a comment to an activity", async () => {
    const list = await createTestList(owner.user.id, "groceries");
    const todo = await createTestTodo(list.id, "buy milk");
    const activity = await createTestActivity(list.id, todo.id);

    const res = await request(app)
      .post(`/api/activities/${activity.id}/comments`)
      .set("Authorization", `Bearer ${follower.token}`)
      .send({ text: "nice work" });

    expect(res.status).toBe(201);
    expect(res.body.text).toBe("nice work");
    expect(res.body.activityId).toBe(activity.id);
  });

  it("returns 404 when the activity doesn't exist", async () => {
    const res = await request(app)
      .post("/api/activities/00000000-0000-0000-0000-000000000000/comments")
      .set("Authorization", `Bearer ${follower.token}`)
      .send({ text: "nice work" });

    expect(res.status).toBe(404);
  });

  it("returns 400 when text is missing", async () => {
    const list = await createTestList(owner.user.id, "groceries");
    const todo = await createTestTodo(list.id, "buy milk");
    const activity = await createTestActivity(list.id, todo.id);

    const res = await request(app)
      .post(`/api/activities/${activity.id}/comments`)
      .set("Authorization", `Bearer ${follower.token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it("allows multiple comments from the same user on the same activity", async () => {
    const list = await createTestList(owner.user.id, "groceries");
    const todo = await createTestTodo(list.id, "buy milk");
    const activity = await createTestActivity(list.id, todo.id);

    const first = await request(app)
      .post(`/api/activities/${activity.id}/comments`)
      .set("Authorization", `Bearer ${follower.token}`)
      .send({ text: "first" });
    const second = await request(app)
      .post(`/api/activities/${activity.id}/comments`)
      .set("Authorization", `Bearer ${follower.token}`)
      .send({ text: "second" });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });
});

describe("DELETE /api/comments/:id", () => {
  it("deletes a comment owned by the authenticated user", async () => {
    const list = await createTestList(owner.user.id, "groceries");
    const todo = await createTestTodo(list.id, "buy milk");
    const activity = await createTestActivity(list.id, todo.id);
    const comment = await createTestComment(
      follower.user.id,
      activity.id,
      "nice",
    );

    const res = await request(app)
      .delete(`/api/comments/${comment.id}`)
      .set("Authorization", `Bearer ${follower.token}`);

    expect(res.status).toBe(200);
  });

  it("returns 404 when the comment belongs to a different user", async () => {
    const list = await createTestList(owner.user.id, "groceries");
    const todo = await createTestTodo(list.id, "buy milk");
    const activity = await createTestActivity(list.id, todo.id);
    const comment = await createTestComment(
      follower.user.id,
      activity.id,
      "nice",
    );

    const res = await request(app)
      .delete(`/api/comments/${comment.id}`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(res.status).toBe(404);
  });
});
