import { z } from 'zod';
import { paginationMetaSchema } from '@/api/pagination';
import { prestataireSearchItemSchema, zoneSchema } from './recherche';

// ============================================================================
// Contract: GET {VITE_API_URL}/prestataires/{companyId}
// Real path: /api/v1/prestataires/{companyId} (see vite.config.ts proxy)
// Source: https://api.entreprise.de9de9.dz/swagger
// ============================================================================
//
// One composite payload behind the profile overlay, in three parts:
//   fiche   — the public card, identical to a /prestataires/recherche row
//   avis    — rating résumé + a paginated page of reviews
//   dossier — the back-office file: identity, vitrine, KYC, partnership
//             contract, commandes, factures, versements, documents, avis,
//             équipe, and pre-computed stats/totals
//
// Money is in credits throughout the dossier (`*Credits`), not DZD — the fiche's
// `tarifMinDzd` / `tarifMaxDzd` are the only DZD amounts in the payload.
// Everything nullable in the live sample is widened with `nullish`, same
// convention as the recherche and worklist schemas.

/** The public card. Same shape as one `/prestataires/recherche` row. */
export const ficheSchema = prestataireSearchItemSchema;
export type Fiche = z.infer<typeof ficheSchema>;

// ---------------------------------------------------------------- avis ------

/** Rating roll-up. `ratingHistogram` is keyed '1'..'5'. */
export const avisResumeSchema = z.object({
  prestataireCompanyId: z.string().nullish(),
  reviewCount: z.number(),
  averageRating: z.number(),
  clientCount: z.number(),
  de9de9Count: z.number(),
  ratingHistogram: z.record(z.string(), z.number()).nullish(),
});
export type AvisResume = z.infer<typeof avisResumeSchema>;

/** `auteurType` is 'client' | 'de9de9'; kept open so a new author kind can't fail the parse. */
export const avisItemSchema = z.object({
  id: z.string(),
  contractId: z.string().nullish(),
  contractReference: z.string().nullish(),
  serviceLabel: z.string().nullish(),
  clientCompanyId: z.string().nullish(),
  prestataireCompanyId: z.string().nullish(),
  rating: z.number(),
  comment: z.string().nullish(),
  reply: z.string().nullish(),
  auteurType: z.string(),
  /** Null for client reviews — the client's name is not disclosed here. */
  auteurNom: z.string().nullish(),
  visibilite: z.string().nullish(),
  authorUserId: z.string().nullish(),
  createdAt: z.string(),
  updatedAt: z.string().nullish(),
});
export type AvisItem = z.infer<typeof avisItemSchema>;

export const avisSectionSchema = z.object({
  resume: avisResumeSchema,
  avis: z.object({
    meta: paginationMetaSchema,
    data: z.array(avisItemSchema),
  }),
});
export type AvisSection = z.infer<typeof avisSectionSchema>;

// ------------------------------------------------------------- dossier ------

/** Legal identity of the company. */
export const dossierInfosSchema = z.object({
  id: z.string(),
  type: z.string(), // 'Prestataire' | 'Client'
  legalName: z.string().nullish(),
  tradeName: z.string().nullish(),
  nif: z.string().nullish(),
  nis: z.string().nullish(),
  rc: z.string().nullish(),
  articleImposition: z.string().nullish(),
  wilaya: z.string().nullish(),
  commune: z.string().nullish(),
  address: z.string().nullish(),
  contactPhone: z.string().nullish(),
  contactEmail: z.string().nullish(),
  isActive: z.boolean().nullish(),
  membresActifs: z.number().nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
});
export type DossierInfos = z.infer<typeof dossierInfosSchema>;

/** Taxonomy entry as the vitrine spells it — `libelle`, not the fiche's `label`. */
export const codeLibelleSchema = z.object({
  code: z.string(),
  libelle: z.string().nullish(),
  hex: z.string().nullish(),
});
export type CodeLibelle = z.infer<typeof codeLibelleSchema>;

/** The editable public profile. Overlaps the fiche, but prices in credits. */
export const dossierVitrineSchema = z.object({
  nomAffiche: z.string().nullish(),
  pitch: z.string().nullish(),
  logoUrl: z.string().nullish(),
  wilaya: z.string().nullish(),
  commune: z.string().nullish(),
  zones: z.array(zoneSchema).nullish(),
  familles: z.array(codeLibelleSchema).nullish(),
  categories: z.array(codeLibelleSchema).nullish(),
  sousCategories: z.array(codeLibelleSchema).nullish(),
  effectif: z.number().nullish(),
  anneeCreation: z.number().nullish(),
  ancienneteAnnees: z.number().nullish(),
  langues: z.array(z.string()).nullish(),
  certifications: z.array(z.string()).nullish(),
  tarifMinCredits: z.number().nullish(),
  tarifMaxCredits: z.number().nullish(),
  delaiReponseHeures: z.number().nullish(),
  dispoNow: z.boolean().nullish(),
  kycVerifie: z.boolean().nullish(),
  certifie: z.boolean().nullish(),
  note: z.number().nullish(),
  nombreAvis: z.number().nullish(),
  missions: z.number().nullish(),
  satisfactionPercent: z.number().nullish(),
  liste: z.boolean().nullish(),
});
export type DossierVitrine = z.infer<typeof dossierVitrineSchema>;

/** One required KYC document. `kind` is 'KycRc' | 'KycNif' | 'KycNis' so far. */
export const kycPieceSchema = z.object({
  kind: z.string(),
  fourni: z.boolean(),
  documentId: z.string().nullish(),
  fileName: z.string().nullish(),
  url: z.string().nullish(),
  uploadedAt: z.string().nullish(),
});
export type KycPiece = z.infer<typeof kycPieceSchema>;

/** `statut` is PascalCase here ('Verified'), unlike the local lowercase KycStatus. */
export const dossierKycSchema = z.object({
  statut: z.string(),
  motifRejet: z.string().nullish(),
  reviewedAt: z.string().nullish(),
  reviewedByUserId: z.string().nullish(),
  hasLegalIdentifiers: z.boolean().nullish(),
  pieces: z.array(kycPieceSchema).nullish(),
});
export type DossierKyc = z.infer<typeof dossierKycSchema>;

/** Partnership contract (de9de9 ↔ prestataire), not a client commande. */
export const dossierContratSchema = z.object({
  isSigned: z.boolean().nullish(),
  signedAt: z.string().nullish(),
  documentId: z.string().nullish(),
  fileName: z.string().nullish(),
  url: z.string().nullish(),
  uploadedAt: z.string().nullish(),
});
export type DossierContrat = z.infer<typeof dossierContratSchema>;

/** `setup` is the sourcing status code, e.g. 'S4_Contracted'. */
export const dossierCommandeSchema = z.object({
  id: z.string(),
  reference: z.string().nullish(),
  categoryCode: z.string().nullish(),
  serviceLabel: z.string().nullish(),
  setup: z.string().nullish(),
  montantCredits: z.number().nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  isClosed: z.boolean().nullish(),
  /** The other party — the client, on a prestataire's dossier. */
  contrepartieId: z.string().nullish(),
  contrepartieNom: z.string().nullish(),
  visitesCount: z.number().nullish(),
  ouvrierAffecte: z.boolean().nullish(),
  prochaineVisiteAt: z.string().nullish(),
  createdAt: z.string().nullish(),
});
export type DossierCommande = z.infer<typeof dossierCommandeSchema>;

/** `statut`: 'Deposited' | 'Approved' | 'Contested' | 'Settled' | 'Cancelled'. */
export const dossierFactureSchema = z.object({
  id: z.string(),
  reference: z.string().nullish(),
  visitOccurrenceId: z.string().nullish(),
  contractId: z.string().nullish(),
  commandeReference: z.string().nullish(),
  statut: z.string().nullish(),
  montantCredits: z.number().nullish(),
  partPrestataireCredits: z.number().nullish(),
  margeCredits: z.number().nullish(),
  isContested: z.boolean().nullish(),
  approvedAt: z.string().nullish(),
  settledAt: z.string().nullish(),
  contrepartieId: z.string().nullish(),
  contrepartieNom: z.string().nullish(),
  createdAt: z.string().nullish(),
});
export type DossierFacture = z.infer<typeof dossierFactureSchema>;

/** The prestataire's share paid out for one settled facture. */
export const dossierVersementSchema = z.object({
  id: z.string(),
  invoiceId: z.string().nullish(),
  factureReference: z.string().nullish(),
  brutCredits: z.number().nullish(),
  partPrestataireCredits: z.number().nullish(),
  margeCredits: z.number().nullish(),
  paidAt: z.string().nullish(),
  reference: z.string().nullish(),
  refAffichee: z.string().nullish(),
  statut: z.string().nullish(),
});
export type DossierVersement = z.infer<typeof dossierVersementSchema>;

export const dossierDocumentSchema = z.object({
  id: z.string(),
  kind: z.string().nullish(),
  fileName: z.string().nullish(),
  url: z.string().nullish(),
  contentType: z.string().nullish(),
  sizeBytes: z.number().nullish(),
  contractId: z.string().nullish(),
  invoiceId: z.string().nullish(),
  rechargeId: z.string().nullish(),
  uploadedByUserId: z.string().nullish(),
  createdAt: z.string().nullish(),
});
export type DossierDocument = z.infer<typeof dossierDocumentSchema>;

/**
 * The dossier's own review rows — a different projection of the same reviews as
 * `avis.avis.data`: French keys (`note`, `commentaire`, `reponse`) and the
 * client's name disclosed as `contrepartieNom`.
 */
export const dossierAvisSchema = z.object({
  id: z.string(),
  contractId: z.string().nullish(),
  commandeReference: z.string().nullish(),
  note: z.number(),
  commentaire: z.string().nullish(),
  reponse: z.string().nullish(),
  auteurType: z.string(),
  auteurNom: z.string().nullish(),
  visibilite: z.string().nullish(),
  contrepartieId: z.string().nullish(),
  contrepartieNom: z.string().nullish(),
  createdAt: z.string(),
});
export type DossierAvis = z.infer<typeof dossierAvisSchema>;

export const dossierEquipeMembreSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  role: z.string().nullish(),
  skill: z.string().nullish(),
  phone: z.string().nullish(),
  whatsAppPhone: z.string().nullish(),
  weeklyHours: z.number().nullish(),
  hourlyRateCredits: z.number().nullish(),
  isSousTraitant: z.boolean().nullish(),
  createdAt: z.string().nullish(),
});
export type DossierEquipeMembre = z.infer<typeof dossierEquipeMembreSchema>;

/** Server-computed KPIs. Several are null for a prestataire dossier. */
export const dossierStatsSchema = z.object({
  commandesTotal: z.number().nullish(),
  commandesActives: z.number().nullish(),
  facturesTotal: z.number().nullish(),
  creditsSolde: z.number().nullish(),
  missionsRealisees: z.number().nullish(),
  noteMoyenne: z.number().nullish(),
  nombreAvis: z.number().nullish(),
  effectifEquipe: z.number().nullish(),
  versementsTotalCredits: z.number().nullish(),
  partPrestatairePourcent: z.number().nullish(),
});
export type DossierStats = z.infer<typeof dossierStatsSchema>;

/** Row counts per section — what the server would return if nothing were capped. */
export const dossierTotalsSchema = z.object({
  commandes: z.number().nullish(),
  factures: z.number().nullish(),
  versements: z.number().nullish(),
  documents: z.number().nullish(),
  avis: z.number().nullish(),
  avisClients: z.number().nullish(),
  avisDe9de9: z.number().nullish(),
  equipe: z.number().nullish(),
});
export type DossierTotals = z.infer<typeof dossierTotalsSchema>;

export const dossierSchema = z.object({
  infos: dossierInfosSchema,
  vitrine: dossierVitrineSchema.nullish(),
  kyc: dossierKycSchema.nullish(),
  contrat: dossierContratSchema.nullish(),
  commandes: z.array(dossierCommandeSchema).nullish(),
  factures: z.array(dossierFactureSchema).nullish(),
  /** Null on every prestataire dossier seen so far — shape unverified. */
  credits: z.unknown().nullish(),
  versements: z.array(dossierVersementSchema).nullish(),
  documents: z.array(dossierDocumentSchema).nullish(),
  avis: z.array(dossierAvisSchema).nullish(),
  equipe: z.array(dossierEquipeMembreSchema).nullish(),
  stats: dossierStatsSchema.nullish(),
  totals: dossierTotalsSchema.nullish(),
});
export type Dossier = z.infer<typeof dossierSchema>;

export const prestataireFicheResponseSchema = z.object({
  fiche: ficheSchema,
  avis: avisSectionSchema.nullish(),
  dossier: dossierSchema.nullish(),
});
export type PrestataireFicheResponse = z.infer<typeof prestataireFicheResponseSchema>;
