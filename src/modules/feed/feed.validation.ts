import { z } from "zod";
import { createPaginationQuerySchema } from "@/lib/pagination.js";

export const feedQuerySchema = createPaginationQuerySchema();
export type FeedQuery = z.infer<typeof feedQuerySchema>;

export const addCommentSchema = z.object({
  text: z.string().trim().min(1).max(2000),
});
