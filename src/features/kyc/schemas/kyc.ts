import { z } from 'zod';
import { paginationMetaSchema } from '@/api/pagination';

// ============================================================================
// Contract: KYC review, admin side — « De9de9 Entreprise — KYC (RC · NIF · NIS) »
// guide, §3. Real paths under /api/v1:
//   queue      GET  /kyc?statut=&soumis=&q=&page=&pageSize=
//   counters   GET  /kyc/kpis
//   review     GET  /companies/{companyId}/kyc/revue
//   verdicts   POST /companies/{companyId}/kyc/documents/{documentId}/valider | /refuser
//   upload     POST /companies/{companyId}/kyc/documents        (multipart files + kinds)
//   submit     POST /companies/{companyId}/kyc/soumettre
//   numbers    GET + PUT /companies/{companyId}                   (rc, nif, nis)
//   history    GET  /audit/Company/{companyId}
//
// Status codes stay plain strings on purpose: every button comes from a server
// flag (peutValider / peutRefuser / blocage), so a code the app does not know
// yet only falls back to the neutral colour instead of failing the parse. The
// flags themselves are strict — a screen that silently loses its buttons would
// be worse than one that fails loudly.
// ============================================================================

/** The three pieces, always in this order. */
export const KYC_KINDS = ['KycRc', 'KycNif', 'KycNis'] as const;
export type KycKind = (typeof KYC_KINDS)[number];

/** Known document states: manquant · a_verifier · valide · refuse. */
export type KycDocStatut = 'manquant' | 'a_verifier' | 'valide' | 'refuse';

/** Known dossier states: pending · verified · rejected. */
export type KycDossierStatut = 'pending' | 'verified' | 'rejected';

/** « 2 / 3 validés » — counts of what the viewer can see (admin: real states). */
export const kycProgressionSchema = z.object({
  valides: z.number(),
  refuses: z.number(),
  aVerifier: z.number(),
  manquants: z.number(),
  total: z.number(),
  libelle: z.string().nullish(),
});
export type KycProgression = z.infer<typeof kycProgressionSchema>;

// ---------------------------------------------------------------------------
// GET /kyc — one queue row is the dossier in the admin view (real states,
// internal notes, no masking). Oldest submission first.
// ---------------------------------------------------------------------------

export const kycDossierDocumentSchema = z.object({
  documentId: z.string().nullish(),
  kind: z.string(),
  kindLabel: z.string().nullish(),
  fileName: z.string().nullish(),
  present: z.boolean().nullish(),
  statut: z.string(),
  statutLabel: z.string().nullish(),
  motif: z.string().nullish(),
  noteInterne: z.string().nullish(),
  revueLe: z.string().nullish(),
  uploadedAt: z.string().nullish(),
  contentType: z.string().nullish(),
  sizeBytes: z.number().nullish(),
});
export type KycDossierDocument = z.infer<typeof kycDossierDocumentSchema>;

export const kycDossierSchema = z.object({
  companyId: z.string(),
  nom: z.string(),
  statut: z.string(),
  statutLabel: z.string().nullish(),
  /** Submitted and the review round is open. */
  enRevue: z.boolean().nullish(),
  /** A document was already decided in this round — « Revue en cours ». */
  revueCommencee: z.boolean().nullish(),
  /** A refused document was replaced — « ↻ Renvoyé ». */
  resoumission: z.boolean().nullish(),
  progression: kycProgressionSchema.nullish(),
  motif: z.string().nullish(),
  noteInterne: z.string().nullish(),
  revueLe: z.string().nullish(),
  identifiantsComplets: z.boolean().nullish(),
  rc: z.string().nullish(),
  nif: z.string().nullish(),
  nis: z.string().nullish(),
  soumisLe: z.string().nullish(),
  documents: z.array(kycDossierDocumentSchema).nullish(),
  // Not in the guide's row example — shown when the API sends them.
  email: z.string().nullish(),
  roles: z.array(z.string()).nullish(),
});
export type KycDossier = z.infer<typeof kycDossierSchema>;

export const kycQueueSchema = z.object({
  meta: paginationMetaSchema,
  data: z.array(kycDossierSchema),
});
export type KycQueue = z.infer<typeof kycQueueSchema>;

// ---------------------------------------------------------------------------
// GET /kyc/kpis — the cards, and the red badge on the sidebar « KYC » item.
// ---------------------------------------------------------------------------

export const kycKpisSchema = z.object({
  /** Submitted, waiting — the sidebar badge. */
  aExaminer: z.number(),
  nonSoumis: z.number(),
  verifies: z.number(),
  /** Card « À corriger » — waiting for the company. */
  rejetes: z.number(),
  total: z.number(),
  /** Under review, at least one document already decided. */
  revueEnCours: z.number().nullish(),
  /** Under review, with a replaced refused document. */
  resoumis: z.number().nullish(),
  /** Documents « à vérifier » across the dossiers under review. */
  piecesAVerifier: z.number().nullish(),
});
export type KycKpis = z.infer<typeof kycKpisSchema>;

// ---------------------------------------------------------------------------
// GET /companies/{companyId}/kyc/revue — the review screen. `pieces` always
// has 3 entries (RC, NIF, NIS); an empty slot is `manquant` with no `courante`.
// ---------------------------------------------------------------------------

/** One stored version of a piece — the current one, or a replaced one. */
export const kycVersionSchema = z.object({
  documentId: z.string(),
  /** Starts at 1 for the oldest. */
  version: z.number().nullish(),
  fileName: z.string().nullish(),
  contentType: z.string().nullish(),
  sizeBytes: z.number().nullish(),
  /** Absolute and Bearer-protected: fetch through apiClient, never a bare src. */
  url: z.string().nullish(),
  urlApercu: z.string().nullish(),
  deposeLe: z.string().nullish(),
  /** The user's name or e-mail; « de9de9 (reprise) » for taken-over documents. */
  deposeParNom: z.string().nullish(),
  statut: z.string(),
  statutLabel: z.string().nullish(),
  /** Written for the company. */
  motif: z.string().nullish(),
  /** Never shown to the company. */
  noteInterne: z.string().nullish(),
  revueLe: z.string().nullish(),
  revueParNom: z.string().nullish(),
  remplaceLe: z.string().nullish(),
});
export type KycVersion = z.infer<typeof kycVersionSchema>;

/** Why neither « Valider » nor « Refuser » is offered — print `message`. */
export const kycBlocageSchema = z.object({
  code: z.string(),
  message: z.string().nullish(),
});
export type KycBlocage = z.infer<typeof kycBlocageSchema>;

export const kycRevuePieceSchema = z.object({
  kind: z.string(),
  kindLabel: z.string().nullish(),
  /** « NIF » */
  labelCourt: z.string().nullish(),
  /** « N° NIF » */
  numeroLabel: z.string().nullish(),
  /** The typed number — validating the document validates it. */
  numero: z.string().nullish(),
  statut: z.string(),
  statutLabel: z.string().nullish(),
  peutValider: z.boolean(),
  peutRefuser: z.boolean(),
  blocage: kycBlocageSchema.nullish(),
  courante: kycVersionSchema.nullish(),
  /** Replaced versions, newest first, at most 20. */
  historique: z.array(kycVersionSchema).nullish(),
  historiqueTronque: z.boolean().nullish(),
});
export type KycRevuePiece = z.infer<typeof kycRevuePieceSchema>;

export const kycRevueSchema = z.object({
  companyId: z.string(),
  nom: z.string(),
  raisonSociale: z.string().nullish(),
  roles: z.array(z.string()).nullish(),
  statut: z.string(),
  statutLabel: z.string().nullish(),
  enRevue: z.boolean().nullish(),
  revueCommencee: z.boolean().nullish(),
  resoumission: z.boolean().nullish(),
  soumisLe: z.string().nullish(),
  revueLe: z.string().nullish(),
  /** Composed from the refused documents: « NIF : … · NIS : … ». */
  motif: z.string().nullish(),
  /** The old dossier-level note (read-only). */
  noteDossier: z.string().nullish(),
  progression: kycProgressionSchema.nullish(),
  /** Not in the guide's example — used when the API sends it. */
  peutSoumettre: z.boolean().nullish(),
  pieces: z.array(kycRevuePieceSchema),
});
export type KycRevue = z.infer<typeof kycRevueSchema>;

// ---------------------------------------------------------------------------
// POST …/valider | …/refuser — 200 answer. Redraw from `dossier`, toast `message`.
// ---------------------------------------------------------------------------

/** aucun · verifie · a_corriger · piece_acceptee */
export const kycVerdictAnswerSchema = z.object({
  dossier: kycRevueSchema,
  evenement: z.string().nullish(),
  message: z.string().nullish(),
});
export type KycVerdictAnswer = z.infer<typeof kycVerdictAnswerSchema>;

/** Refuser: `motif` 1–1 000 characters, required. Both: `note` ≤ 2 000, internal. */
export const KYC_MOTIF_MAX = 1000;
export const KYC_NOTE_MAX = 2000;

/** Per file; the request itself is capped at 20 MB. */
export const KYC_FILE_MAX_BYTES = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------
// GET /audit/Company/{companyId} — every step of the dossier, newest first.
// The guide names the actions but not the entry shape, so entries are read as
// loose records and normalized in lib/kyc.ts (auditEvents). Accepts a bare
// array or one wrapped under data / items (the page envelope included).
// ---------------------------------------------------------------------------

export const kycAuditSchema = z.preprocess((v) => {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return o['data'] ?? o['items'] ?? o['entries'] ?? [];
  }
  return [];
}, z.array(z.record(z.string(), z.unknown())));
export type KycAuditEntry = Record<string, unknown>;
