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

/**
 * One month column. The real API sends RAW credit amounts (e.g. 35 500 000),
 * not percentages — the chart normalizes against the max across all series
 * before rendering. (The mock seed's 0–100 values normalize identically.)
 */
export const chartBarSchema = z.object({
  label: z.string(), // 'Avr' … 'Sep'
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

// Contract: GET {VITE_API_URL}/analytics?period=&du=&au= (real: /api/v1/analytics)
export const analyticsDataSchema = z.object({
  kpis: z.array(analyticsKpiSchema),
  chartBars: z.array(chartBarSchema),
  topClients: z.array(topEntrySchema),
  topPrestataires: z.array(topEntrySchema),
  // Resolved ranges the server actually used (absent from the mock seed).
  periodeDebut: z.string().nullish(),
  periodeFin: z.string().nullish(),
  comparaisonDebut: z.string().nullish(),
  comparaisonFin: z.string().nullish(),
});
export type AnalyticsData = z.infer<typeof analyticsDataSchema>;

// ============================================================================
// Contract: GET {VITE_API_URL}/admin/dashboard (real: /api/v1/admin/dashboard)
// Global platform snapshot — no mock twin: the overview section simply hides
// when the query fails (e.g. offline full-mock mode).
// ============================================================================

const countsByKeySchema = z.record(z.string(), z.number());

export const adminDashboardSchema = z.object({
  generatedAt: z.string(),
  companies: z.object({
    total: z.number(),
    clients: z.number(),
    prestataires: z.number(),
    active: z.number(),
    inactive: z.number(),
    seats: z.number(),
  }),
  sourcing: z.object({
    appelsOffresTotal: z.number(),
    appelsOffresByStatus: countsByKeySchema,
    devisTotal: z.number(),
    devisAccepted: z.number(),
    devisWithdrawn: z.number(),
  }),
  execution: z.object({
    contractsTotal: z.number(),
    contractsOpen: z.number(),
    contractsClosed: z.number(),
    visitsTotal: z.number(),
    visitsByStatus: countsByKeySchema,
    visitsAwaitingClient: z.number(),
    visitsAwaitingPrestataire: z.number(),
    visitsAwaitingAdmin: z.number(),
  }),
  money: z.object({
    walletBalanceCredits: z.number(),
    walletBalanceDzd: z.number(),
    walletFrozenCredits: z.number(),
    walletFrozenDzd: z.number(),
    invoicesTotal: z.number(),
    invoicesByStatus: countsByKeySchema,
    invoicedCredits: z.number(),
    approvedCredits: z.number(),
    settledGrossCredits: z.number(),
    prestataireShareCredits: z.number(),
    platformMarginCredits: z.number(),
    contestedInvoices: z.number(),
    contestedCredits: z.number(),
  }),
  subcontracting: z.object({
    demandesTotal: z.number(),
    demandesByStatus: countsByKeySchema,
    matchesTotal: z.number(),
    currentSnapshots: z.number(),
    supersededSnapshots: z.number(),
    staleSnapshots: z.number(),
    kycLapsedSnapshots: z.number(),
  }),
  reviews: z.object({
    total: z.number(),
    averageRating: z.number().nullish(), // null until the first review lands
    withReply: z.number(),
    ratingHistogram: countsByKeySchema,
  }),
  audit: z.object({
    totalRows: z.number(),
    last24Hours: z.number(),
    mostRecentAt: z.string().nullish(),
  }),
});
export type AdminDashboard = z.infer<typeof adminDashboardSchema>;
