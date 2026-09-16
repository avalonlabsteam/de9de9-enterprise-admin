import { z } from 'zod';
import { paginationMetaSchema } from '@/api/pagination';
import { ballSchema, type Ball } from './commande';

export { paginationMetaSchema, type PaginationMeta } from '@/api/pagination';

// ============================================================================
// Contract: GET {VITE_API_URL}/commandes/worklist
// Real path: /api/v1/commandes/worklist (see vite.config.ts proxy)
// Source: https://api.entreprise.de9de9.dz/swagger
// ============================================================================

/**
 * The API names the ball after its audience — `de9de9` | `client` |
 * `prestataire` (verified live: 148 / 27 / 9 rows in a full listing) — while
 * `Ball` is the prototype's shorthand for the same three, plus 'done'. Without
 * this aliasing every `de9de9` row parsed straight to the 'done' fallback and
 * rendered as a grey « Terminé ».
 */
const BALL_ALIAS: Record<string, Ball> = {
  de9de9: 'de9',
  prestataire: 'pro',
  none: 'done',
};

/** Aliased, then `catch`-guarded: an unseen value is grey, never a parse error. */
export const worklistBallSchema = z.preprocess(
  (value) => (typeof value === 'string' ? (BALL_ALIAS[value] ?? value) : value),
  ballSchema.catch('done'),
);

/**
 * A pipeline step: `code` is the S/V progression code ('S1'…'S4' for an appel
 * d'offres, 'V0'…'V7' / 'V5·C' for a visit), `label` its French display name.
 */
export const worklistStatusSchema = z.object({
  code: z.string(),
  label: z.string(),
});
export type WorklistStatus = z.infer<typeof worklistStatusSchema>;

/** The step after `currentStatus`, plus the action that gets the row there. */
export const worklistNextStatusSchema = worklistStatusSchema.extend({
  action: z.string().nullish(),
});
export type WorklistNextStatus = z.infer<typeof worklistNextStatusSchema>;

/**
 * One server-computed worklist row. Fields that are semantically optional (no
 * prestataire assigned yet, no visit planned, no SLA running, no contract
 * before S4) are widened with `nullish` so a partial row doesn't turn the whole
 * page into a parse error — same convention as `authUserSchema`.
 *
 * `kind` splits the list in two: 'rfq' rows (appels d'offres, S-codes) carry
 * the client-KYC and budget fields; 'visite' rows (V-codes) carry the contract,
 * site and occurrence fields. The other side's fields are null.
 *
 * `ball` is aliased then guarded (see `worklistBallSchema`): it only drives
 * colors, never behavior, so an unknown value is grey rather than fatal.
 */
export const worklistItemSchema = z.object({
  id: z.string(),
  kind: z.string(), // 'rfq' | 'visite' live; kept open
  clientName: z.string(),
  reference: z.string().nullish(),
  clientContact: z.string().nullish(),
  /** Contact person's name, where `clientContact` is their phone. */
  contact: z.string().nullish(),
  clientPhone: z.string().nullish(),
  clientEmail: z.string().nullish(),
  clientCompanyId: z.string().nullish(),
  serviceLabel: z.string(),
  wilaya: z.string().nullish(),
  commune: z.string().nullish(),
  cadence: z.string().nullish(),
  currentStatus: worklistStatusSchema,
  /** Null only once a row has nowhere left to go. */
  nextStatus: worklistNextStatusSchema.nullish(),
  ball: worklistBallSchema,
  needsDe9de9: z.boolean(),
  prestataireCompanyId: z.string().nullish(),
  prestataireName: z.string().nullish(),
  nextVisitAt: z.string().nullish(), // ISO 8601
  statusSince: z.string().nullish(), // ISO 8601
  /**
   * Minutes past `slaDueAt` — positive when late. Live rows send null (not a
   * negative count) while the SLA is still running.
   */
  slaOverdueMinutes: z.number().nullish(),
  slaCode: z.string().nullish(), // 'rappel_client' | 'resolution_litige' | …
  slaLabel: z.string().nullish(),
  slaDueAt: z.string().nullish(), // ISO 8601
  traite: z.boolean(),
  traiteAt: z.string().nullish(),
  traiteParUserId: z.string().nullish(),
  noteCount: z.number(),
  noteIds: z.array(z.string()).nullish(),
  // ---- rfq rows ----
  budgetMinCredits: z.number().nullish(),
  budgetMaxCredits: z.number().nullish(),
  dateSouhaitee: z.string().nullish(),
  /** True when the client's KYC blocks publishing the appel d'offres. */
  clientKycBloquePublication: z.boolean().nullish(),
  clientKycStatut: z.string().nullish(), // 'verified' | 'pending' | 'rejected'
  // ---- visite rows ----
  /** The contract id `GET /commandes/{id}` resolves — rfq rows have none. */
  contractId: z.string().nullish(),
  contractStartsAt: z.string().nullish(),
  contractEndsAt: z.string().nullish(),
  visitAddress: z.string().nullish(),
  workerCount: z.number().nullish(),
  occurrenceNumber: z.number().nullish(),
  occurrenceCount: z.number().nullish(),
  createdAt: z.string(),
});
export type WorklistItem = z.infer<typeof worklistItemSchema>;

export const worklistResponseSchema = z.object({
  meta: paginationMetaSchema,
  data: z.array(worklistItemSchema),
});
export type WorklistResponse = z.infer<typeof worklistResponseSchema>;

// ---------- query params ----------
/** Every filter is optional — omitted keys are simply not sent. */
export interface WorklistParams {
  search?: string;
  clientId?: string;
  prestataireId?: string;
  wilaya?: string;
  commune?: string;
  statut?: string;
  balle?: string;
  needsDe9de9?: boolean;
  page?: number;
  pageSize?: number;
}

/** `statut` filter domain, mirrored by the KPI cards. */
export const WORKLIST_STATUTS = ['arappeler', 'devis', 'litige', 'regler', 'actif'] as const;
export type WorklistStatut = (typeof WORKLIST_STATUTS)[number];

// ============================================================================
// Contract: GET {VITE_API_URL}/commandes/worklist/kpis
// Real path: /api/v1/commandes/worklist/kpis
// ============================================================================

/**
 * The KPI-card counts, computed server-side over the whole worklist — not the
 * current page or filters. Checked against a same-day list capture: `aRappeler`
 * matched the S1 rows, `facturesARegler` the V6 rows, and `commandesActives` the
 * distinct `contractId`s (not the visit rows, which were 3× as many).
 */
export const worklistKpisSchema = z.object({
  aRappeler: z.number(),
  litigesAResoudre: z.number(),
  facturesARegler: z.number(),
  commandesActives: z.number(),
});
export type WorklistKpis = z.infer<typeof worklistKpisSchema>;
