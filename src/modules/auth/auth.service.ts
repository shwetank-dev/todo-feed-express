import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { ConflictError } from "@/errors/app-error.js";
import { config } from "@/infra/config.js";
import type { DbClient } from "@/infra/db-client.js";
import { users } from "../users/users.db-schema.js";

const SALT_ROUNDS = 10;
const POSTGRES_UNIQUE_VIOLATION = "23505";

export function createToken(userId: string) {
  return jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: "1h" });
}

export function createAuthService(dbClient: DbClient) {
  return {
    register: async (name: string, password: string) => {
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      try {
        const [user] = await dbClient
          .insert(users)
          .values({ name, passwordHash })
          .returning();

        if (!user) {
          throw new Error("insert returned no row");
        }

        return user;
      } catch (err) {
        const cause = err instanceof Error ? err.cause : undefined;

        if (
          cause &&
          typeof cause === "object" &&
          "code" in cause &&
          cause.code === POSTGRES_UNIQUE_VIOLATION
        ) {
          throw new ConflictError(
            "DUPLICATE_NAME",
            `name "${name}" is already taken`,
          );
        }
        throw err;
      }
    },

    login: async (name: string, password: string) => {
      const [user] = await dbClient
        .select()
        .from(users)
        .where(eq(users.name, name));

      if (!user) {
        return null;
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);

      if (!isValid) {
        return null;
      }

      return user;
    },

    me: async (userId: string) => {
      const [user] = await dbClient
        .select()
        .from(users)
        .where(eq(users.id, userId));

      return user ?? null;
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
