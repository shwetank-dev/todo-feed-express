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

export function paginateRows<T>(
  rows: T[],
  limit: number,
  getCursor: (row: T) => string,
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const lastItem = items.at(-1);
  const nextCursor = hasMore && lastItem ? getCursor(lastItem) : null;
  return { items, nextCursor };
}
