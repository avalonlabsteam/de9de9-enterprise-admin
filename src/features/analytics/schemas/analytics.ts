import { z } from 'zod';

// KPI codes for the analytics dashboard — labels are resolved client-side (i18n).
export const analyticsKpiKeySchema = z.enum([
  'vendus',
  'depenses',
  'verses',
  'marge',
  'circulation',
]);
export type AnalyticsKpiKey = z.infer<typeof analyticsKpiKeySchema>;

export const analyticsKpiSchema = z.object({
  key: analyticsKpiKeySchema,
  value: z.string(), // e.g. '250 K'
  delta: z.string(), // e.g. '+12,4%'
  positive: z.boolean(), // delta direction (drives the delta color)
});
export type AnalyticsKpi = z.infer<typeof analyticsKpiSchema>;

// One month column — bar heights in % (logic.ts buildAnalytics `bars`).
export const chartBarSchema = z.object({
  label: z.string(), // 'Jan' … 'Juin'
  vendus: z.number(),
  depenses: z.number(),
  verses: z.number(),
});
export type ChartBar = z.infer<typeof chartBarSchema>;

export const topEntrySchema = z.object({
  init: z.string(),
  name: z.string(),
  value: z.string(), // e.g. '120 K'
  color: z.string(),
});
export type TopEntry = z.infer<typeof topEntrySchema>;

export const analyticsDataSchema = z.object({
  kpis: z.array(analyticsKpiSchema),
  chartBars: z.array(chartBarSchema),
  topClients: z.array(topEntrySchema),
  topPrestataires: z.array(topEntrySchema),
});
export type AnalyticsData = z.infer<typeof analyticsDataSchema>;
