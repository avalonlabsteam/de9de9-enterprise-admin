import { z } from 'zod';

/** Pagination envelope shared by the real API's list endpoints (snake_case). */
export const paginationMetaSchema = z.object({
  current_page: z.number(),
  per_page: z.number(),
  total: z.number(),
  total_pages: z.number(),
  has_more_pages: z.boolean(),
});
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
