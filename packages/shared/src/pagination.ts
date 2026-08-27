import { z } from "zod";

export const CursorPageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type CursorPageQuery = z.infer<typeof CursorPageQuery>;

export function CursorPageResponse<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}
