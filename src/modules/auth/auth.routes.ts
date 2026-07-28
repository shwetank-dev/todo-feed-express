import { Router } from "express";
import { UnauthenticatedError } from "@/errors/app-error.js";
import { getValidatedBody } from "@/lib/validate-request.js";
import { userDTO } from "@/modules/users/users.dto.js";
import { authResponseSchema } from "./auth.dto.js";
import { assertUserId, requireAuth } from "./auth.middleware.js";
import type { AuthService } from "./auth.service.js";
import { createToken } from "./auth.service.js";
import { loginSchema, registerSchema } from "./auth.validation.js";

export function createAuthRoutes(authService: AuthService) {
  const router = Router();

  router.post("/register", async (req, res) => {
    const { name, password } = getValidatedBody(req, registerSchema);
    const user = await authService.register(name, password);
    const token = createToken(user.id);
    res.status(201).json(authResponseSchema.parse({ user, token }));
  });

  router.post("/login", async (req, res) => {
    const { name, password } = getValidatedBody(req, loginSchema);
    const user = await authService.login(name, password);

    if (!user) {
      throw new UnauthenticatedError("invalid credentials");
    }

    const token = createToken(user.id);
    res.json(authResponseSchema.parse({ user, token }));
  });

  router.get("/me", requireAuth, async (req, res) => {
    assertUserId(req);
    const user = await authService.me(req.userId);

    if (!user) {
      throw new UnauthenticatedError("user not found");
    }

    res.json(userDTO.parse(user));
  });

  return router;
}
