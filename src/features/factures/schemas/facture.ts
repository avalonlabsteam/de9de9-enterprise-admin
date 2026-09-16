import { z } from 'zod';
import { paginationMetaSchema } from '@/api/pagination';

// Facture lifecycle — subset of the occurrence status codes
// (V5 doneInvoiced · V5·C doneDisputed · V6 doneApproved · V7 paid).
export const factureStatusSchema = z.enum([
  'doneInvoiced',
  'doneDisputed',
  'doneApproved',
  'paid',
]);
export type FactureStatus = z.infer<typeof factureStatusSchema>;

// Derived from commandes occurrences with a deposited facture
// (logic.ts facturesForCmds / buildFactures).
// ============================================================================
// Contract: GET {VITE_API_URL}/factures/console
// Real path: /api/v1/factures/console (meta/data page envelope)
// Source: https://api.entreprise.de9de9.dz/swagger
// ============================================================================

/**
 * One console row. `status` stays a strict enum on purpose — it drives which
 * actions (approve/contest/resolve/settle) are offered, so an unknown value
 * should fail the parse loudly rather than act on the wrong facture state.
 * Free-text companions are widened with `nullish` (live data has taught us).
 */
export const factureConsoleItemSchema = z.object({
  cmdId: z.string(),
  occId: z.string(),
  invoiceId: z.string(),
  ref: z.string(),
  cmdRef: z.string().nullish(),
  montant: z.number(),
  date: z.string(), // dd/mm/yyyy or ISO — the page handles both
  status: factureStatusSchema,
  transfere: z.boolean(),
  client: z.string(),
  contact: z.string().nullish(),
  email: z.string().nullish(),
  pres: z.string().nullish(),
  service: z.string().nullish(),
  createdAt: z.string(),
});
export type FactureConsoleItem = z.infer<typeof factureConsoleItemSchema>;

export const factureConsoleResponseSchema = z.object({
  meta: paginationMetaSchema,
  data: z.array(factureConsoleItemSchema),
});
export type FactureConsoleResponse = z.infer<typeof factureConsoleResponseSchema>;

/** Query params (sent PascalCase: Q, Statut, Page, …). */
export interface FactureConsoleParams {
  q?: string;
  statut?: string;
  clientId?: string;
  prestataireId?: string;
  du?: string;
  au?: string;
  montantMin?: number;
  montantMax?: number;
  tri?: string;
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// Legacy full-list shape (GET /factures, still mocked) — used by the client
// fiche; derived from commandes occurrences with a deposited facture
// (logic.ts facturesForCmds / buildFactures).
// ---------------------------------------------------------------------------
export const factureSchema = z.object({
  cmdId: z.string(),
  occId: z.string(),
  ref: z.string(), // 'F-' + digits of the commande id
  montant: z.number(), // credits; prestataire gets 85%, de9de9 keeps 15%
  date: z.string(), // visit date dd/mm/yyyy
  status: factureStatusSchema,
  transfere: z.boolean(),
  client: z.string(),
  contact: z.string(),
  email: z.string(),
  pres: z.string(), // prestataire name or '—'
  service: z.string(),
});
export type Facture = z.infer<typeof factureSchema>;
