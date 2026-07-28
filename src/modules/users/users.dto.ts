import { z } from "zod";

export const userDTO = z.object({
  id: z.string(),
  name: z.string(),
});

export type UserDTO = z.infer<typeof userDTO>;
