import { z } from "zod";
import { userDTO } from "@/modules/users/users.dto.js";

export const authResponseSchema = z.object({
  user: userDTO,
  token: z.string(),
});
