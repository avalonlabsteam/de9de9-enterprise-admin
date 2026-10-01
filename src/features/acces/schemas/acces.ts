import { z } from 'zod';
import { paginationMetaSchema } from '@/api/pagination';

// ============================================================================
// « Accès » — the two authorities de9de9 holds per company: B2C (the bridge to
// the de9de9 consumer app, OFF by default) and B2B (new activity on the
// Entreprise marketplace, ON by default).
//
// Every nullable field is `.nullish()`, and the server's vocabularies
// (`b2cEtat.code`, `b2cEtat.ton`, `kycStatut`, `resultat`, `raison`, the outbox
// `kind` / `status`) stay plain strings: a value added on the server must not
// break the page.
// ============================================================================

// ---------- the list — GET /admin/acces-entreprises ----------

/** The B2C pill, built by the server: print `label`, colour by `ton`, never re-derive it. */
export const b2cEtatSchema = z.object({
  code: z.string(),
  label: z.string().nullish(),
  ton: z.string().nullish(),
  detail: z.string().nullish(),
});
export type B2cEtat = z.infer<typeof b2cEtatSchema>;

export const accesEntrepriseSchema = z.object({
  id: z.string(),
  /** Trade name, else legal name — what the row prints in bold. */
  nom: z.string().nullish(),
  raisonSociale: z.string().nullish(),
  nomCommercial: z.string().nullish(),
  logoUrl: z.string().nullish(),
  email: z.string().nullish(),
  rc: z.string().nullish(),
  kycStatut: z.string().nullish(),
  kycStatutLabel: z.string().nullish(),
  /** The sides the company holds: 'client', 'prestataire'. */
  roles: z.array(z.string()).nullish(),
  /** false = de9de9 deactivated the company. */
  active: z.boolean().nullish(),
  b2bAcces: z.boolean(),
  /** ISO instant of the last switch; null = never switched. */
  b2bModifieLe: z.string().nullish(),
  b2bMotif: z.string().nullish(),
  b2cAcces: z.boolean(),
  b2cModifieLe: z.string().nullish(),
  b2cMotif: z.string().nullish(),
  b2cEtat: b2cEtatSchema.nullish(),
});
export type AccesEntreprise = z.infer<typeof accesEntrepriseSchema>;

export const accesListSchema = z.object({
  meta: paginationMetaSchema,
  data: z.array(accesEntrepriseSchema),
});
export type AccesList = z.infer<typeof accesListSchema>;

// ---------- the counters — GET /admin/acces-entreprises/compteurs ----------

/** Counted over ALL companies, with the list filters' own predicates. */
export const accesCompteursSchema = z.object({
  total: z.number(),
  b2cAccordes: z.number(),
  b2cNonAccordes: z.number(),
  b2cActifs: z.number(),
  b2cEnAttente: z.number(),
  b2cSuspendus: z.number(),
  b2cEchecs: z.number(),
  b2bDesactives: z.number(),
  /** The bridge's master switch: false = grants are saved, nothing is sent. */
  pontActif: z.boolean().nullish(),
});
export type AccesCompteurs = z.infer<typeof accesCompteursSchema>;

// ---------- the four bulk actions — always 200, one result per company ----------

export const accesResultatSchema = z.object({
  companyId: z.string(),
  /** Null when the id names nothing. */
  nom: z.string().nullish(),
  /** 'fait' | 'ignore' */
  resultat: z.string(),
  /** Stable code of an ignored company (`deja_accorde`, `modification_concurrente`…). */
  raison: z.string().nullish(),
  /** The ready sentence — printed as it is. */
  detail: z.string().nullish(),
  /** What was queued for the de9de9 app: provision · update · approve · catalogue · suspend. */
  enFile: z.array(z.string()).nullish(),
});
export type AccesResultat = z.infer<typeof accesResultatSchema>;

export const accesLotSchema = z.object({
  demandees: z.number(),
  faites: z.number(),
  ignorees: z.number(),
  resultats: z.array(accesResultatSchema),
});
export type AccesLot = z.infer<typeof accesLotSchema>;

// ---------- one company's sync state — GET /admin/companies/{id}/legacy-sync ----------

export const outboxRowSchema = z.object({
  id: z.string(),
  /** ProvisionAccount · UpdateAccount · ApproveAccount · SuspendAccount · ResumeAccount · SyncCatalogue */
  kind: z.string(),
  attempts: z.number().nullish(),
  nextAttemptAt: z.string().nullish(),
  lastError: z.string().nullish(),
  createdAt: z.string().nullish(),
  /** Pending · Sent · Failed · Cancelled · Superseded */
  status: z.string().nullish(),
  /** When the row left the queue; null while it is still to send. */
  doneAt: z.string().nullish(),
});
export type OutboxRow = z.infer<typeof outboxRowSchema>;

export const legacySyncSchema = z.object({
  companyId: z.string().nullish(),
  /** The company's de9de9 app account; null = not created yet. */
  legacyUserId: z.union([z.string(), z.number()]).nullish(),
  /** Pending · Provisioned · Approved · Suspended · Failed */
  status: z.string().nullish(),
  /** The last bridge error. */
  error: z.string().nullish(),
  /** « accès B2C accordé » */
  b2cEnabled: z.boolean().nullish(),
  /** Still to send, oldest first. */
  pendingOutbox: z.array(outboxRowSchema).nullish(),
  /** Plain text, one warning per line. */
  catalogueWarnings: z.string().nullish(),
  /** Refused for their content, newest first. */
  failedOutbox: z.array(outboxRowSchema).nullish(),
});
export type LegacySync = z.infer<typeof legacySyncSchema>;
