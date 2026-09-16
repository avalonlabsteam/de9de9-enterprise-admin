import { z } from 'zod';

// ============================================================================
// Contract: GET {VITE_API_URL}/commandes/{id}
// Real path: /api/v1/commandes/{id} (see vite.config.ts proxy)
// Source: https://api.entreprise.de9de9.dz/swagger
// ============================================================================

/**
 * The detail endpoint answers a *status projection envelope*, not the console
 * payload: the same commande is described once per audience (client,
 * prestataire, admin), each with its own badge, ball and allowed actions.
 * Occurrences, devis, notes and the brief are NOT part of this response —
 * `commandeSchema` still covers those (see ../schemas/commande).
 *
 * The `{id}` is a CONTRACT id (canonical status S4, reference C-xxxx), not one
 * of the ids `GET /commandes/worklist` returns — those rows are appels d'offres
 * (`kind: 'rfq'`, S1–S3) or visits (`kind: 'visite'`, V0–V6), and both answer
 * 404 { title: 'Contract not found' } here. Until an integrated endpoint hands
 * us contract ids, this contract is exercised against the mock.
 */

export const COMMANDE_ROLES = ['client', 'prestataire', 'admin'] as const;
export type CommandeRole = (typeof COMMANDE_ROLES)[number];

/**
 * One action offered to the projected role. The swagger example only ever shows
 * an empty array, so the element type is unverified: both a bare code and a
 * `{ code, label }` object parse, and `allowedActionCode` normalizes them.
 */
export const allowedActionSchema = z.union([
  z.string(),
  z.looseObject({ code: z.string(), label: z.string().nullish() }),
]);
export type AllowedAction = z.infer<typeof allowedActionSchema>;

export function allowedActionCode(action: AllowedAction): string {
  return typeof action === 'string' ? action : action.code;
}

/**
 * Status-dependent payload bag. The keys below are the ones an S4
 * (contractualisé) commande carries; other statuses swap in their own, so
 * `looseObject` keeps whatever else arrives and every member is widened —
 * `appelOffreId` / `acceptedDevisId` / `updatedAt` are null in live data.
 */
export const commandeExtrasSchema = z.looseObject({
  contractId: z.string().nullish(),
  reference: z.string().nullish(),
  clientCompanyId: z.string().nullish(),
  prestataireCompanyId: z.string().nullish(),
  appelOffreId: z.string().nullish(),
  acceptedDevisId: z.string().nullish(),
  startDate: z.string().nullish(), // ISO 8601
  endDate: z.string().nullish(), // ISO 8601
  isClosed: z.boolean().nullish(),
  visitCount: z.number().nullish(),
  openVisitCount: z.number().nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
});
export type CommandeExtras = z.infer<typeof commandeExtrasSchema>;

/**
 * `canonicalStatus` ('S4'), `ball` and `demandeBadge` ('none' here, a role on
 * the worklist) stay open strings: they drive labels and colors, never
 * behavior, so an unseen value must not fail the parse.
 */
export const commandeProjectionSchema = z.object({
  role: z.string(),
  canonicalStatus: z.string(),
  statusLabel: z.string(),
  ball: z.string(),
  demandeBadge: z.string(),
  isActionRequired: z.boolean(),
  isTerminal: z.boolean(),
  allowedActions: z.array(allowedActionSchema),
  extras: commandeExtrasSchema.nullish(),
});
export type CommandeProjection = z.infer<typeof commandeProjectionSchema>;

/** `credits` is the DZD amount in the platform's credit unit (×10 in live data). */
export const commandeMoneySchema = z.object({
  amountDzd: z.number().nullish(),
  credits: z.number().nullish(),
  ledgerImpact: z.string().nullish(),
});
export type CommandeMoney = z.infer<typeof commandeMoneySchema>;

/**
 * `projections` is keyed by role, but read as an open record: a payload that
 * drops a role (or adds one) stays parseable. Use `projectionFor` to read it.
 */
export const commandeDetailSchema = z.object({
  id: z.string(),
  canonicalStatus: z.string(),
  statusLabel: z.string(),
  projections: z.record(z.string(), commandeProjectionSchema),
  ball: z.string(),
  demandeBadge: z.string(),
  allowedActions: z.array(allowedActionSchema),
  money: commandeMoneySchema.nullish(),
});
export type CommandeDetail = z.infer<typeof commandeDetailSchema>;

/**
 * The projection for one audience, or `null` when the payload omits that role —
 * callers fall back to the envelope's own top-level status fields.
 */
export function projectionFor(
  detail: CommandeDetail,
  role: CommandeRole,
): CommandeProjection | null {
  return detail.projections[role] ?? null;
}
