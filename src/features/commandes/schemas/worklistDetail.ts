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

// ============================================================================
// Notes + traité — GET/POST {VITE_API_URL}/commandes/worklist/{id}/notes,
// DELETE …/notes/{noteId}, PATCH …/traite.
// ============================================================================

/** GET …/notes?limit=N — `truncated` says the list was capped by `limit`. */
export const worklistNotesResponseSchema = z.object({
  count: z.number(),
  notes: z.array(worklistNoteSchema),
  truncated: z.boolean().nullish(),
});
export type WorklistNotesResponse = z.infer<typeof worklistNotesResponseSchema>;

/**
 * POST …/notes — note the asymmetry with the response, which calls the same
 * person `authorDisplayName`: the request field really is `auteurNom`.
 */
export const worklistNoteInputSchema = z.object({
  body: z.string().min(1),
  auteurNom: z.string().optional(),
});
export type WorklistNoteInput = z.infer<typeof worklistNoteInputSchema>;

/** PATCH …/traite — answers with the flag's new value, so it is a toggle. */
export const worklistTraiteResponseSchema = z.object({
  id: z.string(),
  traite: z.boolean(),
});
export type WorklistTraiteResponse = z.infer<typeof worklistTraiteResponseSchema>;

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

// ============================================================================
// The commande's dossier — four grouped blocks the GET builds, identical for
// every status and kind of line: who asked (`client`), who receives the
// commande (`prestataires`), what was asked (`demande`) and every file
// (`fichiers`). The answers of the page's POST actions carry the four as null:
// the page refetches the GET after every action and never reads them there.
//
// Display only — no button depends on them — so everything but the ids and the
// names is widened, and a block that still does not read is dropped (`dossier`
// below) rather than failing the page: the flat members above say the same.
// ============================================================================

/** pending « En attente » · verified « Vérifié » · rejected « Rejeté » */
const dossierKycSchema = z.object({ statut: z.string(), label: z.string().nullish() });
const dossierCodeLabelSchema = z.object({ code: z.string(), label: z.string() });

/** The company that made the demande. */
export const commandeClientSchema = z.object({
  companyId: z.string(),
  /** Trade name, else legal name. */
  nom: z.string(),
  raisonSociale: z.string().nullish(),
  nomCommercial: z.string().nullish(),
  /** As stored: a document URL (needs the bearer token), a public URL or a `data:` URI. */
  logoUrl: z.string().nullish(),
  kyc: dossierKycSchema.nullish(),
  contact: z.string().nullish(),
  telephone: z.string().nullish(),
  email: z.string().nullish(),
  wilaya: z.string().nullish(),
  commune: z.string().nullish(),
  adresse: z.string().nullish(),
  rc: z.string().nullish(),
  nif: z.string().nullish(),
  nis: z.string().nullish(),
  effectif: z.number().nullish(),
  actif: z.boolean().nullish(),
  inscritLe: z.string().nullish(),
});
export type CommandeClient = z.infer<typeof commandeClientSchema>;

/**
 * One company that receives the commande. Before a contract: everyone
 * consulted. On a contract: the retained one first (`retenu`), then the others
 * consulted — the retained one alone, with no `devis`, when it was created by
 * phone.
 */
export const commandePrestataireSchema = z.object({
  companyId: z.string(),
  nom: z.string(),
  raisonSociale: z.string().nullish(),
  logoUrl: z.string().nullish(),
  /** retenu · consulte */
  role: z.string().nullish(),
  roleLabel: z.string().nullish(),
  retenu: z.boolean().nullish(),
  telephone: z.string().nullish(),
  email: z.string().nullish(),
  wilaya: z.string().nullish(),
  commune: z.string().nullish(),
  kyc: dossierKycSchema.nullish(),
  /** Null until the company has a review. */
  note: z.number().nullish(),
  nombreAvis: z.number().nullish(),
  missions: z.number().nullish(),
  effectif: z.number().nullish(),
  inviteLe: z.string().nullish(),
  /** Mirrors this company's line of `devis[]`: attente · recu · valide · refuse. */
  devis: z
    .object({
      devisId: z.string().nullish(),
      statut: z.string(),
      statutLabel: z.string().nullish(),
      montantCredits: z.number().nullish(),
    })
    .nullish(),
});
export type CommandePrestataire = z.infer<typeof commandePrestataireSchema>;

/** What was asked. Null on a contract created by phone: there is no demande. */
export const commandeDemandeSchema = z.object({
  id: z.string(),
  reference: z.string().nullish(),
  titre: z.string().nullish(),
  description: z.string().nullish(),
  categorie: dossierCodeLabelSchema.nullish(),
  sousCategories: z.array(dossierCodeLabelSchema).nullish(),
  wilaya: z.string().nullish(),
  commune: z.string().nullish(),
  adresseExacte: z.string().nullish(),
  superficieM2: z.number().nullish(),
  /** « Récurrent » | « Ponctuel » */
  cadence: z.string().nullish(),
  /** Null on a one-off demande. */
  frequence: z.string().nullish(),
  dateSouhaitee: z.string().nullish(),
  deadline: z.string().nullish(),
  budgetMinCredits: z.number().nullish(),
  budgetMaxCredits: z.number().nullish(),
  contraintes: z.string().nullish(),
  criteres: z.string().nullish(),
  envoyeeLe: z.string().nullish(),
  creeLe: z.string().nullish(),
  /** Set when the demande started from an annonce that still exists. */
  annonce: z.object({ id: z.string(), titre: z.string().nullish() }).nullish(),
});
export type CommandeDemande = z.infer<typeof commandeDemandeSchema>;

export const commandeFichierSchema = z.object({
  id: z.string(),
  /** Set when `source` is `document`: the id the panel's preview and download take. */
  documentId: z.string().nullish(),
  /** document (bearer-protected, opened by `documentId`) · annonce_photo (public `url`) */
  source: z.string(),
  nom: z.string(),
  contentType: z.string().nullish(),
  /** pdf · image · autre */
  type: z.string().nullish(),
  tailleOctets: z.number().nullish(),
  /** Absolute. Never followed for a document — an <a> carries no token. */
  url: z.string().nullish(),
  urlApercu: z.string().nullish(),
  ajouteLe: z.string().nullish(),
  /** The company that owns the file, when it is a party: `role` is client · prestataire. */
  ajoutePar: z.object({ companyId: z.string().nullish(), nom: z.string(), role: z.string().nullish() }).nullish(),
  nature: z.string().nullish(),
  natureLabel: z.string().nullish(),
  devisId: z.string().nullish(),
  factureId: z.string().nullish(),
  /** An `occurrences[].id`, on facture and litige files. */
  occurrenceId: z.string().nullish(),
  occurrenceNumero: z.number().nullish(),
  /** On a visit line: true only for the facture / litige files of THAT visit. Always true elsewhere. */
  deCetteLigne: z.boolean().nullish(),
});
export type CommandeFichier = z.infer<typeof commandeFichierSchema>;

/** Only the non-empty groups, in order: demande · annonce · devis · facture · litige. */
export const commandeFichiersSchema = z.object({
  total: z.number().nullish(),
  groupes: z
    .array(z.object({ code: z.string(), label: z.string().nullish(), fichiers: z.array(commandeFichierSchema) }))
    .nullish(),
});
export type CommandeFichiers = z.infer<typeof commandeFichiersSchema>;

/** A dossier block: null on the POST answers and on an older API, dropped when it does not read. */
function dossier<T extends z.ZodType>(schema: T, name: string) {
  return schema.nullish().catch((ctx) => {
    if (import.meta.env.DEV) console.warn(`[commandes] bloc « ${name} » illisible, ignoré`, ctx.issues);
    return null;
  });
}

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
  // The dossier — see above. Filled by the GET only.
  client: dossier(commandeClientSchema, 'client'),
  prestataires: dossier(z.array(commandePrestataireSchema), 'prestataires'),
  demande: dossier(commandeDemandeSchema, 'demande'),
  fichiers: dossier(commandeFichiersSchema, 'fichiers'),
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
