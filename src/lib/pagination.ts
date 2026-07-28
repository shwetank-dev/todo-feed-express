import { z } from "zod";

export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

export function createPaginationQuerySchema(defaultLimit = 20) {
  return z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().default(defaultLimit),
  });
}

export function paginateRows<T extends { id: string }>(
  rows: T[],
  limit: number,
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (items.at(-1)?.id ?? null) : null;
  return { items, nextCursor };
}
