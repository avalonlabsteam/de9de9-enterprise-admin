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
/**
 * The `statut` filter domain — exactly the codes the API accepts. An unknown
 * value is refused with 400 « statut inconnu » rather than returning an empty
 * list, so this must not drift: the KPI cards used to send their own vocabulary
 * ('arappeler', 'litige', 'regler', 'actif', 'devis') and every one of those
 * requests failed.
 *
 * `V5·C` carries a middle dot (U+00B7) — axios encodes it to `V5%C2%B7C`.
 * `V5.C` and `V5C` are rejected.
 *
 * `V7` (réglée) and `VX` (annulée) are accepted but always answer an empty
 * list: a finished row leaves the file and is reachable only by id.
 */
export const WORKLIST_STATUTS = [
  'S1',
  'S2',
  'S3',
  'S4',
  'S5',
  'V0',
  'V1',
  'V2',
  'V3',
  'V4',
  'V5',
  'V5·C',
  'V6',
  'V7',
  'VX',
] as const;
export type WorklistStatut = (typeof WORKLIST_STATUTS)[number];

/** `balle` filter domain — the API's own vocabulary, not the internal `Ball`. */
export const WORKLIST_BALLES = ['de9de9', 'client', 'prestataire'] as const;
export type WorklistBalle = (typeof WORKLIST_BALLES)[number];

/**
 * Internal ball → wire value. `worklistBallSchema` aliases the API's names to
 * short ones on the way in; sending those back ('de9', 'pro') is a 400, so the
 * mapping has to be reversed on the way out.
 */
export const BALL_TO_PARAM: Record<'de9' | 'client' | 'pro', WorklistBalle> = {
  de9: 'de9de9',
  client: 'client',
  pro: 'prestataire',
};

export const WORKLIST_CADENCES = ['ponctuel', 'recurrent'] as const;
export type WorklistCadence = (typeof WORKLIST_CADENCES)[number];

/** Every filter is optional and they combine with AND. */
export interface WorklistParams {
  search?: string;
  statut?: WorklistStatut;
  balle?: WorklistBalle;
  /** Shorthand for `balle=de9de9`; only meaningful as true. */
  needsDe9de9?: boolean;
  /** Rows past their SLA due date; only meaningful as true. */
  enRetard?: boolean;
  /** The one boolean that is also sent as false — « reste à traiter ». */
  traite?: boolean;
  cadence?: WorklistCadence;
  clientId?: string;
  prestataireId?: string;
  wilaya?: string;
  commune?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Serializes the filters for axios. Booleans other than `traite` only ever
 * narrow the list, so false is omitted rather than sent — `traite=false`
 * genuinely means « not yet handled » and must survive.
 */
export function worklistQuery(params: WorklistParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'boolean') {
      if (key === 'traite') out[key] = String(value);
      else if (value) out[key] = 'true';
      continue;
    }
    out[key] = String(value);
  }
  return out;
}

// ============================================================================
// Contract: GET {VITE_API_URL}/commandes/worklist/filters?q=&limit=
// Real path: /api/v1/commandes/worklist/filters
// Fills the dropdowns. `q` filters company names only (not wilayas); `limit`
// defaults to 100, max 500, and applies per list.
// ============================================================================

export const worklistFilterOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});
export type WorklistFilterOption = z.infer<typeof worklistFilterOptionSchema>;

/** The SLA legend: how long each status is allowed before it counts as late. */
export const worklistSlaTargetSchema = z.object({
  status: worklistStatusSchema,
  code: z.string().nullish(),
  label: z.string().nullish(),
  minutes: z.number().nullish(),
});
export type WorklistSlaTarget = z.infer<typeof worklistSlaTargetSchema>;

export const worklistFiltersResponseSchema = z.object({
  filters: z.object({
    clients: z.array(worklistFilterOptionSchema).nullish(),
    prestataires: z.array(worklistFilterOptionSchema).nullish(),
    wilayas: z.array(z.string()).nullish(),
    communes: z.array(z.string()).nullish(),
    statuts: z.array(worklistFilterOptionSchema).nullish(),
    balles: z.array(z.string()).nullish(),
    cadences: z.array(worklistFilterOptionSchema).nullish(),
    slaTargets: z.array(worklistSlaTargetSchema).nullish(),
  }),
  gaps: z.array(z.unknown()).nullish(),
  /** True when a list was cut at `limit` — prompt the user to type to narrow. */
  truncated: z.boolean().nullish(),
  limit: z.number().nullish(),
});
export type WorklistFiltersResponse = z.infer<typeof worklistFiltersResponseSchema>;

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
