export function paginateByCreatedAt<T extends { id: string; createdAt: number }>(
  items: T[],
  options: { limit: number; cursor?: string }
): { items: T[]; nextCursor: string | null } {
  const sorted = [...items].sort((a, b) => {
    if (a.createdAt !== b.createdAt) {
      return a.createdAt - b.createdAt;
    }
    return a.id.localeCompare(b.id);
  });
  const limit = Math.min(Math.max(options.limit, 1), 100);
  let start = 0;
  if (options.cursor) {
    const idx = sorted.findIndex((item) => item.id === options.cursor);
    start = idx >= 0 ? idx + 1 : sorted.length;
  }
  const page = sorted.slice(start, start + limit);
  const nextCursor = start + page.length < sorted.length ? (page[page.length - 1]?.id ?? null) : null;
  return { items: page, nextCursor };
}
