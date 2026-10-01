import { z } from 'zod';
import { paginationMetaSchema } from '@/api/pagination';

// ============================================================================
// Contract: « Paiements en ligne » (Comptabilité, admin) — guide 18. Real paths
// under /api/v1, AdminOnly, every company:
//   list      GET  /comptabilite/paiements?Du=&Au=&ClientId=&Statut=&Q=&Tri=&Page=&PageSize=
//   cards     GET  /comptabilite/paiements/totaux?Du=&Au=&ClientId=
//   export    GET  /comptabilite/paiements/export?<the list's filters>
//   bilan     GET  /comptabilite/bilan?Du=&Au=&ClientId=[&inline=true]
//   detail    GET  /comptabilite/paiements/{id}
//   actions   POST …/{id}/reverifier · …/{id}/revue/crediter · …/{id}/revue/rejeter
//   receipts  GET  …/{id}/recu[?inline=true] · …/{id}/recu-banque → { url }
//
// Statuses, tones, flags and action codes stay plain strings: every label is
// written by the server and every button comes from `actions`, so a value the
// panel does not know yet degrades to a neutral look instead of failing.
// ============================================================================

/** initiation · en_attente · approuve · refuse · expire · echec_initiation · a_verifier */
export type PaiementStatut = string;

/** succes · attention · danger · info · neutre */
export type PaiementTon = string;

const entrepriseRowSchema = z.object({
  id: z.string().nullish(),
  raisonSociale: z.string().nullish(),
  nif: z.string().nullish(),
  rc: z.string().nullish(),
});

const payeurRowSchema = z.object({
  nom: z.string().nullish(),
  email: z.string().nullish(),
  telephone: z.string().nullish(),
});

// ---------------------------------------------------------------------------
// GET /comptabilite/paiements — one row
// ---------------------------------------------------------------------------
export const paiementRowSchema = z.object({
  id: z.string(),
  reference: z.string(),
  statut: z.string(),
  statutLabel: z.string().nullish(),
  ton: z.string().nullish(),
  creeLe: z.string().nullish(),
  creeLeLabel: z.string().nullish(),
  payeLe: z.string().nullish(),
  payeLeLabel: z.string().nullish(),
  entreprise: entrepriseRowSchema.nullish(),
  payeur: payeurRowSchema.nullish(),
  montantDzd: z.number().nullish(),
  montantLabel: z.string().nullish(),
  credits: z.number().nullish(),
  creditsLabel: z.string().nullish(),
  orderNumber: z.string().nullish(),
  orderId: z.string().nullish(),
  approvalCode: z.string().nullish(),
  panMasque: z.string().nullish(),
  licenseEnv: z.string().nullish(),
  mouvementId: z.string().nullish(),
  /** Branch on the prefix: the code may carry details after a colon. */
  drapeau: z.string().nullish(),
  drapeauLabel: z.string().nullish(),
});
export type PaiementRow = z.infer<typeof paiementRowSchema>;

export const paiementsResponseSchema = z.object({
  meta: paginationMetaSchema,
  data: z.array(paiementRowSchema),
});
export type PaiementsResponse = z.infer<typeof paiementsResponseSchema>;

// ---------------------------------------------------------------------------
// GET /comptabilite/paiements/totaux — the KPI cards (same shape each)
// ---------------------------------------------------------------------------
const totalBucketSchema = z.object({
  nombre: z.number(),
  totalDzd: z.number().nullish(),
  totalCredits: z.number().nullish(),
  totalDzdLabel: z.string().nullish(),
  totalCreditsLabel: z.string().nullish(),
});
export type TotalBucket = z.infer<typeof totalBucketSchema>;

export const totauxSchema = z.object({
  approuves: totalBucketSchema,
  /** initiation + en_attente */
  enAttente: totalBucketSchema,
  aVerifier: totalBucketSchema,
  refuses: totalBucketSchema,
  expires: totalBucketSchema,
  echecs: totalBucketSchema,
  /** « Montants bruts, hors frais SATIM / GuiddiniPay. » — print as sent. */
  mention: z.string().nullish(),
});
export type Totaux = z.infer<typeof totauxSchema>;

// ---------------------------------------------------------------------------
// GET /comptabilite/paiements/{id} — the detail; also what every action answers
// ---------------------------------------------------------------------------
export const paiementActionSchema = z.object({
  /** reverifier · revue_crediter · revue_rejeter */
  code: z.string(),
  label: z.string(),
  method: z.string().nullish(),
  /** Host path (/api/v1/…): strip the prefix before calling it through apiClient. */
  href: z.string(),
  motifRequis: z.boolean().nullish(),
});
export type PaiementAction = z.infer<typeof paiementActionSchema>;

export const paiementDetailSchema = z.object({
  id: z.string(),
  reference: z.string(),
  numero: z.number().nullish(),
  statut: z.string(),
  statutLabel: z.string().nullish(),
  ton: z.string().nullish(),
  langue: z.string().nullish(),
  montantDzd: z.number().nullish(),
  montantLabel: z.string().nullish(),
  credits: z.number().nullish(),
  creditsLabel: z.string().nullish(),
  /** Frozen at payment time. */
  entreprise: z
    .object({
      id: z.string().nullish(),
      raisonSociale: z.string().nullish(),
      nomCommercial: z.string().nullish(),
      nif: z.string().nullish(),
      nis: z.string().nullish(),
      rc: z.string().nullish(),
      articleImposition: z.string().nullish(),
      adresse: z.string().nullish(),
      commune: z.string().nullish(),
      wilaya: z.string().nullish(),
    })
    .nullish(),
  /** Frozen at payment time. */
  payeur: z
    .object({
      userId: z.string().nullish(),
      nom: z.string().nullish(),
      email: z.string().nullish(),
      telephone: z.string().nullish(),
      /** EnterpriseClientAdmin · EnterpriseClientStaff */
      role: z.string().nullish(),
      ip: z.string().nullish(),
      conditionsVersion: z.string().nullish(),
      conditionsAccepteesAt: z.string().nullish(),
    })
    .nullish(),
  /** Every raw GuiddiniPay / SATIM value stored — printed as sent. */
  passerelle: z
    .object({
      orderNumber: z.string().nullish(),
      orderId: z.string().nullish(),
      formUrl: z.string().nullish(),
      status: z.string().nullish(),
      confirmationStatus: z.string().nullish(),
      actionCode: z.string().nullish(),
      actionCodeDescription: z.string().nullish(),
      errorCode: z.string().nullish(),
      errorMessage: z.string().nullish(),
      approvalCode: z.string().nullish(),
      panMasque: z.string().nullish(),
      amount: z.string().nullish(),
      depositAmount: z.string().nullish(),
      ip: z.string().nullish(),
      licenseEnv: z.string().nullish(),
      svfeResponse: z.string().nullish(),
      updatedAt: z.string().nullish(),
    })
    .nullish(),
  chronologie: z
    .object({
      creeLe: z.string().nullish(),
      expireLe: z.string().nullish(),
      derniereVerification: z.string().nullish(),
      nbVerifications: z.number().nullish(),
      prochaineVerification: z.string().nullish(),
      /** Our code: timeout, passerelle_injoignable, passerelle_refus, cles_invalides, … */
      derniereErreur: z.string().nullish(),
      finaliseLe: z.string().nullish(),
      payeLe: z.string().nullish(),
      crediteLe: z.string().nullish(),
    })
    .nullish(),
  rechargeId: z.string().nullish(),
  mouvementId: z.string().nullish(),
  mouvementHref: z.string().nullish(),
  /** Null when there was never a review reason nor a review. */
  revue: z
    .object({
      motif: z.string().nullish(),
      motifLabel: z.string().nullish(),
      parUserId: z.string().nullish(),
      le: z.string().nullish(),
      commentaire: z.string().nullish(),
      /** a_verifier only: why « Créditer après revue » is not offered. */
      creditImpossible: z.string().nullish(),
    })
    .nullish(),
  drapeau: z.string().nullish(),
  drapeauLabel: z.string().nullish(),
  /** Render exactly these, never work them out. */
  actions: z.array(paiementActionSchema).nullish(),
  recuHref: z.string().nullish(),
  recuBanqueHref: z.string().nullish(),
  /** After « Re-vérifier »: true when the bank did not answer. */
  verificationEnCours: z.boolean().nullish(),
});
export type PaiementDetail = z.infer<typeof paiementDetailSchema>;

/** GET …/{id}/recu-banque — fetched now, never stored: open at once. */
export const recuBanqueSchema = z.object({ url: z.string() });
