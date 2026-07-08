import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { analyticsDataSchema, type AnalyticsData } from '../schemas/analytics';

export const analyticsQueryKey = (period: string) => ['analytics', period] as const;

/** Analytics dashboard data (KPIs, chart bars, top clients / prestataires) for a period. */
export function useAnalytics(period: string) {
  return useQuery({
    queryKey: analyticsQueryKey(period),
    queryFn: async (): Promise<AnalyticsData> => {
      const res = await apiClient.get('/analytics', { params: { period } });
      return analyticsDataSchema.parse(res.data);
    },
  });
}
