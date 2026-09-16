import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import {
  adminDashboardSchema,
  analyticsDataSchema,
  type AdminDashboard,
  type AnalyticsData,
} from '../schemas/analytics';

export interface AnalyticsParams {
  period: string; // 'mois' | 'annee' | 'perso'
  /** Custom range bounds (ISO dates), only meaningful with period 'perso'. */
  du?: string;
  au?: string;
}

/** GET /analytics — credits KPIs, chart bars, top clients / prestataires. */
export function useAnalytics(params: AnalyticsParams) {
  return useQuery({
    queryKey: ['analytics', params],
    queryFn: async (): Promise<AnalyticsData> => {
      const res = await apiClient.get('/analytics', { params });
      return analyticsDataSchema.parse(res.data);
    },
    placeholderData: keepPreviousData,
  });
}

/**
 * GET /admin/dashboard — global platform snapshot. Has no mock twin, so in
 * full-mock mode the query 404s; consumers render the section only when data
 * is present.
 */
export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async (): Promise<AdminDashboard> => {
      const res = await apiClient.get('/admin/dashboard');
      return adminDashboardSchema.parse(res.data);
    },
    staleTime: 60_000,
    retry: 1,
  });
}
