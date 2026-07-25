import bcrypt from "bcrypt";
import { createToken } from "@/modules/auth/auth.service.js";
import { users } from "@/modules/users/users.db-schema.js";
import { testDbClient } from "./setup.js";

const SALT_ROUNDS = 10;

export async function createTestUser(name: string, password: string) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const [user] = await testDbClient
    .insert(users)
    .values({ name, passwordHash })
    .returning();

  if (!user) {
    throw new Error("failed to insert test user");
  }

  return user;
}

export async function createAuthenticatedUser(name: string, password: string) {
  const user = await createTestUser(name, password);
  const token = createToken(user.id);

  return { user, token };
}
