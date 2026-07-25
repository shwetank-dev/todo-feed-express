import { Router } from "express";
import { UnauthenticatedError } from "@/errors/app-error.js";
import { requireAuth } from "./auth.middleware.js";
import type { AuthService } from "./auth.service.js";

export function createAuthRoutes(authService: AuthService) {
  const router = Router();

  router.post("/register", async (req, res) => {
    const { name, password } = req.body;
    const user = await authService.register(name, password);
    const { passwordHash, ...safeUser } = user;
    res.status(201).json(safeUser);
  });

  router.post("/login", async (req, res) => {
    const { name, password } = req.body;
    const token = await authService.login(name, password);

    if (!token) {
      throw new UnauthenticatedError("invalid credentials");
    }

    res.json({ token });
  });

  router.get("/me", requireAuth, async (req, res) => {
    const user = await authService.me(req.userId as string);

    if (!user) {
      throw new UnauthenticatedError("user not found");
    }

    const { passwordHash, ...safeUser } = user;
    res.json(safeUser);
  });

  return router;
}
