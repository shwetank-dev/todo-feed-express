import { testDbClient } from "@test/setup.js";
import {
  createAuthenticatedUser,
  createTestUser,
} from "@test/users.fixtures.js";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "@/app.js";
import { logger } from "@/infra/logger.js";

const app = createApp(testDbClient, logger);

describe("POST /api/auth/register", () => {
  it("creates a new user", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "test-user", password: "test-password" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("test-user");
  });

  it("returns 409 when the name is already taken", async () => {
    await request(app)
      .post("/api/auth/register")
      .send({ name: "dup-user", password: "secret-password" });
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "dup-user", password: "new-password" });
    expect(res.status).toBe(409);
  });
});

describe("POST /api/auth/login", () => {
  const TEST_USER = "test-user";
  const TEST_PASSWORD = "test-password";

  beforeEach(async () => {
    await createTestUser(TEST_USER, TEST_PASSWORD);
  });

  it("returns a token for correct credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ name: TEST_USER, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
  });

  it("returns 401 for wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ name: TEST_USER, password: "wrong-password" });

    expect(res.status).toBe(401);
  });

  it("returns 401 for unknown username", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ name: "nobody", password: "whatever" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("returns the authenticated user for a valid token", async () => {
    const { token } = await createAuthenticatedUser("me-user", "some-password");

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("me-user");
    expect(res.body.passwordHash).toBeUndefined();
  });

  it("returns 401 with no token", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
  });

  it("returns 401 with an invalid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer garbage");

    expect(res.status).toBe(401);
  });
});
