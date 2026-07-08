import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { handicapWorkerSchema, type HandicapWorker } from '../schemas/handicap';

/** GET /handicap — the waitlist of companies ready to employ persons with disabilities. */
export function useHandicapWorkers() {
  return useQuery<HandicapWorker[]>({
    queryKey: ['handicap'],
    queryFn: async () => {
      const res = await apiClient.get('/handicap');
      return handicapWorkerSchema.array().parse(res.data);
    },
  });
}
