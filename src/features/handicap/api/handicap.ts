import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { handicapListSchema, type HandicapParams } from '../schemas/handicap';

const PAGE_SIZE = 20;

/**
 * GET /handicap — paginated waitlist of companies ready to employ persons
 * with disabilities. Pages accumulate via `fetchNextPage` (the « Charger
 * plus » button); a filter change restarts at page 1.
 */
export function useHandicapList(params: HandicapParams) {
  return useInfiniteQuery({
    queryKey: ['handicap', 'list', params],
    queryFn: async ({ pageParam }) => {
      const res = await apiClient.get('/handicap', {
        params: { ...params, pageSize: params.pageSize ?? PAGE_SIZE, page: pageParam },
      });
      return handicapListSchema.parse(res.data);
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.has_more_pages ? last.meta.current_page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
}
