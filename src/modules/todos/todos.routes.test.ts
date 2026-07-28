import { testDbClient } from "@test/setup.js";
import { createTestList, createTestTodo } from "@test/todos.fixtures.js";
import { createAuthenticatedUser } from "@test/users.fixtures.js";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "@/app.js";
import { logger } from "@/infra/logger.js";

const app = createApp(testDbClient, logger);

let auth: Awaited<ReturnType<typeof createAuthenticatedUser>>;

beforeEach(async () => {
  auth = await createAuthenticatedUser("owner", "some-password");
});

describe("POST /api/lists", () => {
  it("creates a list owned by the authenticated user", async () => {
    const res = await request(app)
      .post("/api/lists")
      .set("Authorization", `Bearer ${auth.token}`)
      .send({ name: "groceries" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("groceries");
    expect(res.body.ownerId).toBe(auth.user.id);
  });
});

describe("GET /api/lists", () => {
  it("returns the authenticated user's own lists", async () => {
    await createTestList(auth.user.id, "groceries");

    const res = await request(app)
      .get("/api/lists")
      .set("Authorization", `Bearer ${auth.token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.nextCursor).toBeNull();
  });

  it("does not return another user's lists", async () => {
    const intruder = await createAuthenticatedUser("intruder", "some-password");
    await createTestList(auth.user.id, "groceries");

    const res = await request(app)
      .get("/api/lists")
      .set("Authorization", `Bearer ${intruder.token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
    expect(res.body.nextCursor).toBeNull();
  });

  it("paginates with a cursor when there are more lists than the limit", async () => {
    await createTestList(auth.user.id, "list-a");
    await createTestList(auth.user.id, "list-b");
    await createTestList(auth.user.id, "list-c");

    const firstPage = await request(app)
      .get("/api/lists?limit=2")
      .set("Authorization", `Bearer ${auth.token}`);

    expect(firstPage.status).toBe(200);
    expect(firstPage.body.items).toHaveLength(2);
    expect(firstPage.body.nextCursor).not.toBeNull();

    const secondPage = await request(app)
      .get(`/api/lists?limit=2&cursor=${firstPage.body.nextCursor}`)
      .set("Authorization", `Bearer ${auth.token}`);

    expect(secondPage.status).toBe(200);
    expect(secondPage.body.items).toHaveLength(1);
    expect(secondPage.body.nextCursor).toBeNull();
  });
});

describe("GET /api/lists/:id", () => {
  it("returns the list when it belongs to the authenticated user", async () => {
    const list = await createTestList(auth.user.id, "groceries");

    const res = await request(app)
      .get(`/api/lists/${list.id}`)
      .set("Authorization", `Bearer ${auth.token}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("groceries");
  });

  it("returns 404 when the list belongs to a different user", async () => {
    const intruder = await createAuthenticatedUser("intruder", "some-password");
    const list = await createTestList(auth.user.id, "groceries");

    const res = await request(app)
      .get(`/api/lists/${list.id}`)
      .set("Authorization", `Bearer ${intruder.token}`);

    expect(res.status).toBe(404);
  });
});

describe("POST /api/lists/:id/todos", () => {
  it("adds a todo to a list owned by the authenticated user", async () => {
    const list = await createTestList(auth.user.id, "groceries");

    const res = await request(app)
      .post(`/api/lists/${list.id}/todos`)
      .set("Authorization", `Bearer ${auth.token}`)
      .send({ text: "buy milk" });

    expect(res.status).toBe(201);
    expect(res.body.text).toBe("buy milk");
  });

  it("returns 404 when the list belongs to a different user", async () => {
    const intruder = await createAuthenticatedUser("intruder", "some-password");
    const list = await createTestList(auth.user.id, "groceries");

    const res = await request(app)
      .post(`/api/lists/${list.id}/todos`)
      .set("Authorization", `Bearer ${intruder.token}`)
      .send({ text: "buy milk" });

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/todos/:id", () => {
  it("toggles a todo owned by the authenticated user", async () => {
    const list = await createTestList(auth.user.id, "groceries");
    const todo = await createTestTodo(list.id, "buy milk");

    const res = await request(app)
      .patch(`/api/todos/${todo.id}`)
      .set("Authorization", `Bearer ${auth.token}`);

    expect(res.status).toBe(200);
    expect(res.body.done).toBe(true);
  });

  it("returns 404 when the todo belongs to a different user", async () => {
    const intruder = await createAuthenticatedUser("intruder", "some-password");
    const list = await createTestList(auth.user.id, "groceries");
    const todo = await createTestTodo(list.id, "buy milk");

    const res = await request(app)
      .patch(`/api/todos/${todo.id}`)
      .set("Authorization", `Bearer ${intruder.token}`);

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/todos/:id", () => {
  it("deletes a todo owned by the authenticated user", async () => {
    const list = await createTestList(auth.user.id, "groceries");
    const todo = await createTestTodo(list.id, "buy milk");

    const res = await request(app)
      .delete(`/api/todos/${todo.id}`)
      .set("Authorization", `Bearer ${auth.token}`);

    expect(res.status).toBe(200);
  });

  it("returns 404 when the todo belongs to a different user", async () => {
    const intruder = await createAuthenticatedUser("intruder", "some-password");
    const list = await createTestList(auth.user.id, "groceries");
    const todo = await createTestTodo(list.id, "buy milk");

    const res = await request(app)
      .delete(`/api/todos/${todo.id}`)
      .set("Authorization", `Bearer ${intruder.token}`);

    expect(res.status).toBe(404);
  });
});
