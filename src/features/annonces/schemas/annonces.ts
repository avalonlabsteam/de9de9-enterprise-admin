import { z } from 'zod';

// ============================================================================
// « Annonces » — de9de9's review of the annonces the prestataire companies
// publish: B2B (one offer of the Entreprise catalogue, for client companies)
// and B2C (one category of the de9de9 app, for particuliers).
//   queue    GET  /admin/annonces?onglet=&type=&companyId=&categorie=&q=&page=&pageSize=
//   detail   GET  /admin/annonces/{annonceId}   (also the answer of the five actions)
//   actions  POST …/{id}/approuver | refuser | suspendre | retablir | marquer-revue
//   tools    POST /admin/annonces/reprendre-fiches · …/b2c/referentiel/actualiser
// Every nullable field is `.nullish()`; codes, tones and statuses stay plain
// strings — a value added on the server must not break the page.
// ============================================================================

/** A status, a publication state: the server's code, label and tone. */
export const tagSchema = z.object({
  code: z.string(),
  label: z.string(),
  /** neutre · attention · succes · info · danger */
  ton: z.string().nullish(),
});
export type Tag = z.infer<typeof tagSchema>;

const typeChipSchema = z.object({ code: z.string(), label: z.string() });

/** B2C only: « En attente de publication » while the de9de9 app receives no annonce. */
export const publicationSchema = tagSchema.extend({ raison: z.string().nullish() });

// ---------- the queue ----------

export const annonceLigneSchema = z.object({
  id: z.string(),
  /** b2b · b2c */
  type: z.string(),
  typeChip: typeChipSchema,
  titre: z.string(),
  /** A LABEL, not a code; null when the annonce has no category yet. */
  categorie: z.string().nullish(),
  /** Trade name, else legal name. */
  entreprise: z.object({ id: z.string(), nom: z.string() }),
  statut: tagSchema,
  publication: publicationSchema.nullish(),
  /** The flag of « Modifiées »: published without a review, or changed since de9de9 last read it. */
  modifieeDepuisRevue: z.boolean(),
  /** saisie · reprise_fiche */
  origine: z.string(),
  soumiseLe: z.string().nullish(),
  /** The FIRST publication. */
  publieeLe: z.string().nullish(),
  /** The last write on the annonce. */
  modifieeLe: z.string().nullish(),
  /** Absolute, no token needed: a plain <img src>. */
  couvertureUrl: z.string().nullish(),
});
export type AnnonceLigne = z.infer<typeof annonceLigneSchema>;

export const ongletSchema = z.object({ code: z.string(), label: z.string(), count: z.number() });
export type Onglet = z.infer<typeof ongletSchema>;

export const annoncesQueueSchema = z.object({
  titre: z.string().nullish(),
  /** The tab as the server understood it. */
  onglet: z.string(),
  /** Always the six, in order; the counts ignore every filter. */
  onglets: z.array(ongletSchema),
  /** Filled on « B2C — publication » only. */
  bandeaux: z.array(z.object({ code: z.string(), ton: z.string().nullish(), texte: z.string() })),
  annonces: z.array(annonceLigneSchema),
  page: z.number(),
  pageSize: z.number(),
  /** The tab's total WITH the filters. */
  total: z.number(),
});
export type AnnoncesQueue = z.infer<typeof annoncesQueueSchema>;

// ---------- one annonce ----------

const photoSchema = z.object({
  id: z.string(),
  url: z.string(),
  couverture: z.boolean().nullish(),
});

const etapeSchema = z.object({ code: z.string(), label: z.string(), complete: z.boolean() });

/** The twelve members both kinds share. `actions` is always empty for an admin. */
const annonceCommon = {
  id: z.string(),
  typeChip: typeChipSchema,
  /** Sent back with an action: a stale one answers 409 `concurrency_conflict`. */
  version: z.number(),
  statut: tagSchema,
  /** Written for the company — not drawn as if it spoke to the admin. */
  bandeau: z.object({ ton: z.string().nullish(), texte: z.string() }).nullish(),
  /** What the company reads on a refused or suspended annonce. */
  motif: z.string().nullish(),
  titre: z.string(),
  description: z.string().nullish(),
  photos: z.array(photoSchema).nullish(),
  etapes: z.array(etapeSchema).nullish(),
  actions: z.array(z.unknown()).nullish(),
};

export const annonceB2bSchema = z.object({
  ...annonceCommon,
  type: z.literal('b2b'),
  categorie: z
    .object({
      code: z.string(),
      libelle: z.string(),
      icone: z.string().nullish(),
      famille: z.string().nullish(),
      familleLabel: z.string().nullish(),
      hex: z.string().nullish(),
      verrouillee: z.boolean().nullish(),
    })
    .nullish(),
  sousCategories: z.array(z.object({ code: z.string(), libelle: z.string() })).nullish(),
  /** An ARRAY on a B2B annonce; `communeCode: null` = the whole wilaya. */
  zones: z
    .array(
      z.object({
        wilayaCode: z.number().nullish(),
        wilaya: z.string().nullish(),
        communeCode: z.number().nullish(),
        commune: z.string().nullish(),
      }),
    )
    .nullish(),
  zonesLabel: z.string().nullish(),
  tarif: z
    .object({
      mode: z.string().nullish(),
      minDzd: z.number().nullish(),
      maxDzd: z.number().nullish(),
      unite: z.string().nullish(),
      label: z.string().nullish(),
    })
    .nullish(),
  delaiDemarrageJours: z.number().nullish(),
  delaiLabel: z.string().nullish(),
  capacite: z.string().nullish(),
  references: z.string().nullish(),
  certifications: z.array(z.string()).nullish(),
  demandesIssues: z.object({ count: z.number(), label: z.string().nullish() }).nullish(),
  origine: z.string().nullish(),
  soumiseLe: z.string().nullish(),
  publieeLe: z.string().nullish(),
});
export type AnnonceB2b = z.infer<typeof annonceB2bSchema>;

export const annonceB2cSchema = z.object({
  ...annonceCommon,
  type: z.literal('b2c'),
  /** « {groupe} · {catégorie} » */
  sousTitre: z.string().nullish(),
  publication: publicationSchema.nullish(),
  categorie: z
    .object({
      legacyCategoryId: z.number().nullish(),
      libelle: z.string(),
      libelleAr: z.string().nullish(),
      groupeId: z.number().nullish(),
      groupe: z.string().nullish(),
      photoUrl: z.string().nullish(),
    })
    .nullish(),
  uniteDefaut: z.number().nullish(),
  uniteDefautLabel: z.string().nullish(),
  /** A whole percentage, 0..100. */
  remise: z.number().nullish(),
  lignes: z
    .array(
      z.object({
        id: z.string(),
        legacyCategoryServiceId: z.number().nullish(),
        legacyServiceTaskId: z.number().nullish(),
        estLibre: z.boolean().nullish(),
        libelle: z.string(),
        libelleAr: z.string().nullish(),
        prixDzd: z.number().nullish(),
        unite: z.number().nullish(),
        uniteLabel: z.string().nullish(),
        uniteDifferente: z.boolean().nullish(),
        prixLabel: z.string().nullish(),
      }),
    )
    .nullish(),
  reponseIds: z.array(z.string()).nullish(),
  questionnaire: z.array(z.object({ question: z.string(), reponses: z.array(z.string()) })).nullish(),
  disponibilites: z
    .array(
      z.object({
        jour: z.number(),
        jourLabel: z.string().nullish(),
        debut: z.string().nullish(),
        fin: z.string().nullish(),
      }),
    )
    .nullish(),
  /** An OBJECT on a B2C annonce. `note` speaks to the company. */
  zones: z
    .object({
      resume: z.string().nullish(),
      communesCouvertes: z.number().nullish(),
      note: z.string().nullish(),
    })
    .nullish(),
});
export type AnnonceB2c = z.infer<typeof annonceB2cSchema>;

/**
 * A kind the panel does not know — or one whose own members do not read: the
 * common members only, so the page still shows the annonce and its buttons.
 */
export const annonceAutreSchema = z
  .looseObject({ ...annonceCommon, type: z.string() })
  .transform(({ type, ...rest }) => ({ ...rest, type: 'autre' as const, typeOrigine: type }));
export type AnnonceAutre = z.infer<typeof annonceAutreSchema>;

/** `zones` is an array on B2B and an object on B2C: one schema per kind. */
export const annonceSchema = z.union([annonceB2bSchema, annonceB2cSchema, annonceAutreSchema]);
export type Annonce = z.infer<typeof annonceSchema>;

export const annonceEntrepriseSchema = z.object({
  id: z.string(),
  nom: z.string(),
  /** pending · verified · rejected */
  kycStatut: z.string().nullish(),
  kycVerifie: z.boolean().nullish(),
  estPrestataire: z.boolean().nullish(),
  /** null = the company has no directory card. */
  ficheListee: z.boolean().nullish(),
  /** manuelle · annonces; null = no directory card. */
  couvertureSource: z.string().nullish(),
  /** The B2B access (guide 21). */
  b2bOuvert: z.boolean().nullish(),
  b2c: z.object({ accorde: z.boolean().nullish(), statut: z.string().nullish() }).nullish(),
});
export type AnnonceEntreprise = z.infer<typeof annonceEntrepriseSchema>;

export const annonceRevueSchema = z.object({
  soumiseLe: z.string().nullish(),
  /** Stamped by a direct publication too: read it with `revueParUserId`. */
  revueLe: z.string().nullish(),
  /** The admin who approved, refused or suspended; null = nobody. */
  revueParUserId: z.string().nullish(),
  motif: z.string().nullish(),
  premierePublicationLe: z.string().nullish(),
  /** Not null = the flag of « Modifiées » is set. */
  modifieeDepuisRevueLe: z.string().nullish(),
  statutAvantSoumission: z.string().nullish(),
  statutAvantSuspension: z.string().nullish(),
  origine: z.string().nullish(),
});
export type AnnonceRevue = z.infer<typeof annonceRevueSchema>;

/** de9de9's buttons for this status, in the order to draw. */
export const annonceActionSchema = z.object({
  /** approuver · refuser · suspendre · retablir · marquer_revue */
  code: z.string(),
  label: z.string(),
  /** contour · danger */
  style: z.string().nullish(),
  method: z.string().nullish(),
  /** The full API path (/api/v1/…). */
  href: z.string().nullish(),
  motifRequis: z.boolean().nullish(),
});
export type AnnonceAction = z.infer<typeof annonceActionSchema>;

export const historiqueRowSchema = z.object({
  at: z.string(),
  action: z.string(),
  label: z.string(),
  acteurUserId: z.string().nullish(),
  acteurRole: z.string().nullish(),
  /** Written by de9de9 staff. */
  pourLeCompteDe: z.boolean().nullish(),
  avant: z.string().nullish(),
  apres: z.string().nullish(),
  motif: z.string().nullish(),
});
export type HistoriqueRow = z.infer<typeof historiqueRowSchema>;

export const annonceDetailSchema = z.object({
  annonce: annonceSchema,
  entreprise: annonceEntrepriseSchema,
  revue: annonceRevueSchema,
  /** B2C only: « En attente de publication » and its note. */
  synchronisation: z.object({ code: z.string(), label: z.string(), note: z.string().nullish() }).nullish(),
  actions: z.array(annonceActionSchema),
  /** Newest first, 100 rows at most. */
  historique: z.array(historiqueRowSchema),
});
export type AnnonceDetail = z.infer<typeof annonceDetailSchema>;

// ---------- the two tools ----------

export const repriseResultatSchema = z.object({
  companyId: z.string(),
  nom: z.string().nullish(),
  /** reprise · ignoree */
  resultat: z.string(),
  /** deja_reprise · sans_couverture · pas_prestataire · modification_concurrente */
  raison: z.string().nullish(),
  annoncesCreees: z.number(),
  /** Category CODES that leave the card until the company's own annonce is published. */
  categoriesNonReprises: z.array(z.string()),
});
export type RepriseResultat = z.infer<typeof repriseResultatSchema>;

export const repriseSchema = z.object({
  simulation: z.boolean(),
  fichesExaminees: z.number(),
  fichesReprises: z.number(),
  annoncesCreees: z.number(),
  fichesIgnorees: z.number(),
  /** One row per card examined, oldest first — 200 at most; the counters cover them all. */
  resultats: z.array(repriseResultatSchema),
});
export type Reprise = z.infer<typeof repriseSchema>;

export const referentielSchema = z.object({
  lueLe: z.string(),
  groupes: z.number(),
  categories: z.number(),
  services: z.number(),
});
export type Referentiel = z.infer<typeof referentielSchema>;
