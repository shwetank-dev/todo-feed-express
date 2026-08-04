import { z } from "zod";
import { userDTO } from "@/modules/users/users.dto.js";

export const authResponseSchema = z.object({
  user: userDTO,
  token: z.string(),
});

export const AUTH_ERROR_CODE = {
  DUPLICATE_NAME: "DUPLICATE_NAME",
} as const;
