import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(200),
});

export const loginSchema = z.object({
  name: z.string().trim().min(1),
  password: z.string().min(1),
});
