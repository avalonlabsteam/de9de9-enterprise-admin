import { z } from 'zod';
import { worklistBallSchema, worklistStatusSchema } from './worklist';

// ============================================================================
// Contract: GET  {VITE_API_URL}/commandes/worklist/{id}
//           POST {VITE_API_URL}/commandes/worklist/{id}/next-action  (+ `newId`)
// Real path: /api/v1/commandes/worklist/{id}[/next-action]
// Source: https://api.entreprise.de9de9.dz/swagger
// ============================================================================
//
// Keyed by the commande id — the `id` the worklist returns for each row, appel
// d'offres ('rfq') and visit ('visite') alike; this GET and POST …/next-action
// both take it. GET /commandes/{id} can't: that one wants a contract id. Same
// row as the list, plus each party's side of the status, the next action, the
// devis, notes, occurrences and journal.
//
// Field-name drift from the list row: `service` here vs `serviceLabel`, and
// `statusEnteredAt` alongside `statusSince`.

/** One party's side of the status. `code` is 'action_required' | 'waiting' so far. */
export const worklistPartyStateSchema = z.object({
  code: z.string(),
  text: z.string().nullish(),
});
export type WorklistPartyState = z.infer<typeof worklistPartyStateSchema>;

export const worklistPartiesSchema = z.object({
  client: worklistPartyStateSchema.nullish(),
  prestataire: worklistPartyStateSchema.nullish(),
  de9de9: worklistPartyStateSchema.nullish(),
});
export type WorklistParties = z.infer<typeof worklistPartiesSchema>;

/**
 * The step that moves the row forward. `actor` uses the ball's vocabulary
 * ('client' | 'prestataire' | 'de9de9'), so it is aliased the same way.
 *
 * `form` names the input an action needs ('choisir-prestataire'). POST
 * …/next-action takes no request body, so only actions with no `form` can run
 * through it — the server refuses the others with 422.
 */
export const worklistNextActionSchema = z.object({
  action: z.string(),
  actor: worklistBallSchema.nullish(),
  from: worklistStatusSchema.nullish(),
  to: worklistStatusSchema.nullish(),
  form: z.string().nullish(),
  route: z.string().nullish(),
});
export type WorklistNextAction = z.infer<typeof worklistNextActionSchema>;

/** A quote on an appel d'offres. `statut` is 'attente' | 'recu' | 'valide' | 'refuse'. */
export const worklistDevisSchema = z.object({
  quoteIndex: z.number(),
  /**
   * The id POST /devis/{devisId}/valider and /refuser take. Nullish so a row
   * from a deployment that doesn't send it still parses — its buttons stay hidden.
   */
  devisId: z.string().nullish(),
  prestataireCompanyId: z.string().nullish(),
  raison: z.string(),
  phone: z.string().nullish(),
  statut: z.string(),
  montantCredits: z.number().nullish(),
  chosen: z.boolean(),
  closure: z.string().nullish(), // 'none' so far
  closureLabel: z.string().nullish(),
  choosable: z.boolean().nullish(),
});
export type WorklistDevis = z.infer<typeof worklistDevisSchema>;

export const worklistDetailPrestataireSchema = z.object({
  companyId: z.string().nullish(),
  name: z.string().nullish(),
  phone: z.string().nullish(),
});
export type WorklistDetailPrestataire = z.infer<typeof worklistDetailPrestataireSchema>;

/** An internal note. `aFaire` flags it as a to-do (with who / when). */
export const worklistNoteSchema = z.object({
  id: z.string(),
  body: z.string(),
  authorUserId: z.string().nullish(),
  authorDisplayName: z.string().nullish(),
  createdAt: z.string(),
  aFaire: z.boolean().nullish(),
  aFaireAt: z.string().nullish(),
  aFaireParUserId: z.string().nullish(),
});
export type WorklistNote = z.infer<typeof worklistNoteSchema>;

export const worklistOccurrenceFactureSchema = z.object({
  id: z.string().nullish(),
  reference: z.string().nullish(),
  montantCredits: z.number().nullish(),
  transfere: z.boolean().nullish(),
  fileName: z.string().nullish(),
});
export type WorklistOccurrenceFacture = z.infer<typeof worklistOccurrenceFactureSchema>;

/** One visit of a contract, with its own V-status and optional invoice. */
export const worklistOccurrenceSchema = z.object({
  id: z.string(),
  number: z.number().nullish(),
  date: z.string().nullish(),
  status: worklistStatusSchema.nullish(),
  worker: z.string().nullish(),
  facture: worklistOccurrenceFactureSchema.nullish(),
});
export type WorklistOccurrence = z.infer<typeof worklistOccurrenceSchema>;

/** One audit-trail line. `role` is who acted. */
export const worklistJournalEntrySchema = z.object({
  at: z.string(),
  text: z.string(),
  role: z.string().nullish(),
});
export type WorklistJournalEntry = z.infer<typeof worklistJournalEntrySchema>;

export const worklistDetailSchema = z.object({
  id: z.string(),
  kind: z.string(), // 'rfq' | 'visite'
  reference: z.string().nullish(),
  clientName: z.string(),
  clientCompanyId: z.string().nullish(),
  contact: z.string().nullish(),
  clientPhone: z.string().nullish(),
  clientEmail: z.string().nullish(),
  service: z.string().nullish(),
  cadence: z.string().nullish(),
  wilaya: z.string().nullish(),
  commune: z.string().nullish(),
  prestataire: worklistDetailPrestataireSchema.nullish(),
  currentStatus: worklistStatusSchema,
  statusEnteredAt: z.string().nullish(),
  ball: worklistBallSchema,
  parties: worklistPartiesSchema.nullish(),
  nextAction: worklistNextActionSchema.nullish(),
  statusSince: z.string().nullish(),
  slaOverdueMinutes: z.number().nullish(),
  slaCode: z.string().nullish(),
  slaLabel: z.string().nullish(),
  slaDueAt: z.string().nullish(),
  traite: z.boolean(),
  traiteAt: z.string().nullish(),
  traiteParUserId: z.string().nullish(),
  noteCount: z.number(),
  noteIds: z.array(z.string()).nullish(),
  notes: z.array(worklistNoteSchema).nullish(),
  contractId: z.string().nullish(),
  executionRowId: z.string().nullish(),
  nextVisitAt: z.string().nullish(),
  occurrences: z.array(worklistOccurrenceSchema).nullish(),
  devis: z.array(worklistDevisSchema).nullish(),
  journal: z.array(worklistJournalEntrySchema).nullish(),
  createdAt: z.string(),
  /**
   * POST …/next-action only: the commande id after the action. The console
   * follows it when it differs from the id it posted, instead of reopening a
   * stale one.
   */
  newId: z.string().nullish(),
});
export type WorklistDetail = z.infer<typeof worklistDetailSchema>;
/** Wire shape — `ball` / `actor` before aliasing (what the mock twin emits). */
export type WorklistDetailInput = z.input<typeof worklistDetailSchema>;
