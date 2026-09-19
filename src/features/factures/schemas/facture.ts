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
  // ---- added by the API after our last capture — nullish until they arrive ----
  /** Links « Entreprise » / « Pro » by id; names 404 as route keys. */
  clientId: z.string().nullish(),
  prestataireId: z.string().nullish(),
  /** ISO 8601. Format this, never `date`: 'Vendredi 05/06/2026' parses as US. */
  visitAt: z.string().nullish(),
  statusLabel: z.string().nullish(),
  /** Badge: V5 / V5·C / V6 / V7. */
  code: z.string().nullish(),
  /** A facture file exists — enables « Télécharger ». */
  hasFichier: z.boolean().nullish(),
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

// ============================================================================
// Contract: GET {VITE_API_URL}/factures/console/kpis — the 4 cards, with the
// list's filters (q, clientId, du, au…); the tab is ignored. Replaces the five
// PageSize=1 count requests.
// ============================================================================
const factureKpiBucketSchema = z.object({
  credits: z.number(),
  factures: z.number(),
});
export const factureKpisSchema = z.object({
  enAttenteApprobation: factureKpiBucketSchema,
  aRegler: factureKpiBucketSchema,
  litiges: factureKpiBucketSchema,
  /** Pass du/au to bound the cycle. */
  reglesCeCycle: factureKpiBucketSchema,
  totalFactures: z.number(),
});
export type FactureKpis = z.infer<typeof factureKpisSchema>;

// ============================================================================
// Contract: GET {VITE_API_URL}/factures/console/filtres?limit= — tab counts,
// sort options, and the Clients / Prestataires dropdowns.
// ============================================================================
const factureFiltreEntitySchema = z.object({ id: z.string(), nom: z.string() });
const factureFiltreListSchema = z.object({
  items: z.array(factureFiltreEntitySchema),
  /** True when cut at `limit` — prompt the user to type to narrow. */
  truncated: z.boolean().nullish(),
  limit: z.number().nullish(),
});
export const factureFiltresSchema = z.object({
  statuts: z.array(z.object({ code: z.string(), label: z.string(), count: z.number() })),
  tris: z.array(z.object({ code: z.string(), label: z.string() })),
  clients: factureFiltreListSchema,
  prestataires: factureFiltreListSchema,
});
export type FactureFiltres = z.infer<typeof factureFiltresSchema>;

// ============================================================================
// Contract: GET {VITE_API_URL}/factures/console/{invoiceId} — « Voir ».
// Every action POST answers with this same shape, so one parse serves both.
// ============================================================================

/**
 * The list never returns cancelled invoices (« tout sauf annulées »), so its
 * status enum stays at four values. A detail opened by id can be cancelled, so
 * it gets its own, wider enum — widening the list's would break the page's
 * exhaustive per-status maps for a value the list cannot carry.
 */
export const factureDetailStatusSchema = z.enum([
  'doneInvoiced',
  'doneDisputed',
  'doneApproved',
  'paid',
  'cancelled',
]);
export type FactureDetailStatus = z.infer<typeof factureDetailStatusSchema>;

const facturePartySchema = z.object({
  id: z.string().nullish(),
  nom: z.string().nullish(),
  email: z.string().nullish(),
  telephone: z.string().nullish(),
});

export const factureFichierSchema = z.object({
  id: z.string(),
  kind: z.string().nullish(),
  fileName: z.string(),
  contentType: z.string().nullish(),
  sizeBytes: z.number().nullish(),
  createdAt: z.string().nullish(),
  downloadUrl: z.string().nullish(),
  previewUrl: z.string().nullish(),
});
export type FactureFichier = z.infer<typeof factureFichierSchema>;

/** Server-computed split: 85 % floored to the prestataire, the rest is margin. */
export const factureVentilationSchema = z.object({
  prestataireCredits: z.number(),
  prestatairePourcent: z.number().nullish(),
  margeCredits: z.number(),
  margePourcent: z.number().nullish(),
  /** True once actually paid out (V7) rather than projected. */
  definitive: z.boolean().nullish(),
});
export type FactureVentilation = z.infer<typeof factureVentilationSchema>;

export const FACTURE_ACTION_CODES = ['approuver', 'contester', 'resoudre-litige', 'regler', 'ajouter-fichiers'] as const;
export type FactureActionCode = (typeof FACTURE_ACTION_CODES)[number];

/**
 * One button. `champ` names what the confirmation dialog asks for and
 * `champObligatoire` whether it may be left empty — render buttons from this
 * list, never from a hardcoded per-status table.
 */
export const factureActionSchema = z.object({
  code: z.string(),
  label: z.string(),
  route: z.string().nullish(),
  champ: z.string().nullish(),
  champObligatoire: z.boolean().nullish(),
});
export type FactureAction = z.infer<typeof factureActionSchema>;

export const factureDetailSchema = z.object({
  invoiceId: z.string(),
  ref: z.string(),
  cmdId: z.string().nullish(),
  cmdRef: z.string().nullish(),
  occId: z.string().nullish(),
  client: facturePartySchema,
  prestataire: facturePartySchema.nullish(),
  service: z.string().nullish(),
  date: z.string().nullish(),
  visitAt: z.string().nullish(),
  montantCredits: z.number(),
  montantDzd: z.number().nullish(),
  ventilation: factureVentilationSchema.nullish(),
  status: factureDetailStatusSchema,
  statusLabel: z.string().nullish(),
  code: z.string().nullish(),
  transfere: z.boolean().nullish(),
  versement: z.looseObject({ reference: z.string().nullish(), paidAt: z.string().nullish() }).nullish(),
  contestation: z
    .looseObject({
      motif: z.string().nullish(),
      contesteeLe: z.string().nullish(),
      resolution: z.string().nullish(),
      enCours: z.boolean().nullish(),
    })
    .nullish(),
  deposeeLe: z.string().nullish(),
  approuveeLe: z.string().nullish(),
  regleeLe: z.string().nullish(),
  actions: z.array(factureActionSchema).nullish(),
  /** « La » facture — the first Facture file. Null = « Aucun fichier joint ». */
  fichier: factureFichierSchema.nullish(),
  documents: z.array(factureFichierSchema).nullish(),
});
export type FactureDetail = z.infer<typeof factureDetailSchema>;

/**
 * GET …/{invoiceId}/fichiers. The doc does not give the envelope, so accept a
 * bare array or one wrapped under items / documents / fichiers.
 */
export const factureFichiersSchema = z.preprocess((v) => {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return o['items'] ?? o['documents'] ?? o['fichiers'] ?? [];
  }
  return [];
}, z.array(factureFichierSchema));