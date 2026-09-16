// GET /prestataires/:companyId — mock twin of the composite profile payload
// (fiche + avis + dossier). Everything is derived from the mock db, so the
// profile overlay renders offline exactly as it does against the real API.
//
// Money: the mock db's amounts are already the prototype's credits, so facture
// and versement totals pass through unconverted; only the fiche's DZD tarifs are
// scaled (×10) to the credits the vitrine reports, matching the live ratio.
import type { Commande, Occurrence } from '@/features/commandes/schemas/commande';
import type { Prestataire } from '@/features/prestataires/schemas/prestataire';
import type { Review } from '@/features/prestataires/schemas/review';
import type {
  AvisItem,
  DossierAvis,
  DossierCommande,
  DossierEquipeMembre,
  DossierFacture,
  DossierKyc,
  DossierVersement,
  PrestataireFicheResponse,
} from '@/features/prestataires/schemas/fiche';
import type { KycState } from '@/features/prestataires/schemas/prestataire';
import { FAM_COLOR, FAM_LABEL, catObj, famForCat, slugify } from '@/features/prestataires/lib/taxonomy';
import type { MockHandler } from './router';
import { db, kycOf, toISO } from './db';
import { toRow } from './prestatairesRecherche';

const CREDITS_PER_DZD = 10;
const PRESTATAIRE_SHARE = 0.85;

/** Mock setup codes → the API's sourcing status codes. */
const SETUP_CODE: Record<string, string> = {
  arappeler: 'S1_ToCall',
  contacte: 'S2_QuoteRequested',
  devis: 'S3_QuoteToValidate',
  assigne: 'S4_Contracted',
};

/** Occurrence status → the API's invoice status. */
const FACTURE_STATUT: Record<string, string> = {
  doneInvoiced: 'Deposited',
  doneDisputed: 'Contested',
  doneApproved: 'Approved',
  paid: 'Settled',
};

const KYC_STATUT: Record<string, string> = {
  verified: 'Verified',
  pending: 'Pending',
  rejected: 'Rejected',
};

/** dd/mm/yyyy → an ISO timestamp; '' when the date is unparseable. */
function iso(ddmmyyyy: string): string | null {
  const d = toISO(ddmmyyyy);
  return d ? d + 'T00:00:00+00:00' : null;
}

function findPrestataire(key: string): Prestataire | undefined {
  const k = key.toLowerCase();
  return (
    db.prestataires.find((p) => p.id === key) ??
    db.prestataires.find((p) => p.name.toLowerCase() === k)
  );
}

function missionsOf(p: Prestataire): Commande[] {
  return db.commandes.filter((c) => c.prestataire?.name === p.name);
}

/** The commande's contract value: the chosen devis, else the chosen quick quote. */
function montantOf(c: Commande): number | null {
  const devis = c.devis?.find((d) => d.chosen);
  if (devis) return devis.montant;
  const quote = c.quotes.find((q) => q.chosen);
  return quote ? quote.montant : null;
}

function toDossierCommande(c: Commande): DossierCommande {
  const dates = c.occurrences.map((o) => iso(o.date)).filter((d): d is string => d !== null);
  const next = c.occurrences.find((o) => o.status !== 'paid' && o.status !== 'cancelled');
  return {
    id: c.id,
    reference: c.brief?.ref ?? c.id,
    categoryCode: slugify(c.service),
    serviceLabel: c.service,
    setup: SETUP_CODE[c.setup] ?? c.setup,
    montantCredits: montantOf(c),
    startDate: dates[0] ?? null,
    endDate: dates[dates.length - 1] ?? null,
    isClosed: c.occurrences.length > 0 && c.occurrences.every((o) => o.status === 'paid' || o.status === 'cancelled'),
    contrepartieId: c.client,
    contrepartieNom: c.client,
    visitesCount: c.occurrences.length,
    ouvrierAffecte: c.occurrences.some((o) => !!o.ouvrier),
    prochaineVisiteAt: next ? iso(next.date) : null,
    createdAt: dates[0] ?? null,
  };
}

function toDossierFactures(missions: Commande[]): DossierFacture[] {
  const out: DossierFacture[] = [];
  missions.forEach((c) =>
    c.occurrences.forEach((o: Occurrence) => {
      if (!o.facture?.deposee) return;
      const montant = o.facture.montant;
      const part = Math.round(montant * PRESTATAIRE_SHARE);
      const ref = 'F-' + c.id.replace(/[^0-9]/g, '');
      out.push({
        id: c.id + ':' + o.id,
        reference: ref,
        visitOccurrenceId: o.id,
        contractId: c.id,
        commandeReference: c.brief?.ref ?? c.id,
        statut: FACTURE_STATUT[o.status] ?? 'Deposited',
        montantCredits: montant,
        partPrestataireCredits: part,
        margeCredits: montant - part,
        isContested: o.status === 'doneDisputed',
        approvedAt: o.status === 'doneApproved' || o.status === 'paid' ? iso(o.date) : null,
        settledAt: o.status === 'paid' ? iso(o.date) : null,
        contrepartieId: c.client,
        contrepartieNom: c.client,
        createdAt: iso(o.date),
      });
    }),
  );
  return out;
}

function toDossierVersements(p: Prestataire): DossierVersement[] {
  return db.credits
    .filter((r) => r.type === 'vers' && r.benef === p.name)
    .map((r, i) => {
      // A 'vers' ledger row is already the prestataire's 85% share, so it is the
      // part — the gross is derived back from it, not discounted again.
      const part = Math.abs(r.credits);
      const brut = Math.round(part / PRESTATAIRE_SHARE);
      return {
        id: r.ref + ':' + i,
        invoiceId: null,
        factureReference: r.cmdRef || null,
        brutCredits: brut,
        partPrestataireCredits: part,
        margeCredits: brut - part,
        paidAt: iso(r.date),
        reference: r.ref,
        refAffichee: r.ref,
        statut: 'Transfere',
      };
    });
}

function toAvisItem(r: Review, companyId: string): AvisItem {
  return {
    id: r.id,
    contractId: r.cmd || null,
    contractReference: r.cmd || null,
    serviceLabel: r.service || null,
    clientCompanyId: r.source === 'client' ? r.auteur : null,
    prestataireCompanyId: companyId,
    rating: r.note,
    comment: r.comment,
    reply: null,
    auteurType: r.source,
    // Live payload discloses the author only for de9de9 reviews.
    auteurNom: r.source === 'de9de9' ? r.auteur : null,
    visibilite: 'public',
    authorUserId: null,
    createdAt: iso(r.date) ?? r.date,
    updatedAt: null,
  };
}

function toDossierAvis(r: Review): DossierAvis {
  return {
    id: r.id,
    contractId: r.cmd || null,
    commandeReference: r.cmd || null,
    note: r.note,
    commentaire: r.comment,
    reponse: null,
    auteurType: r.source,
    auteurNom: r.auteur,
    visibilite: 'public',
    contrepartieId: null,
    contrepartieNom: r.source === 'client' ? r.auteur : null,
    createdAt: iso(r.date) ?? r.date,
  };
}

function toDossierKyc(state: KycState): DossierKyc {
  return {
    statut: KYC_STATUT[state.status] ?? state.status,
    motifRejet: state.motif || null,
    // The mock journal keeps 'dd/mm/yyyy · hh:mm' stamps, not ISO timestamps.
    reviewedAt: null,
    reviewedByUserId: null,
    hasLegalIdentifiers: false, // the mock db carries no NIF / NIS / RC
    pieces: state.docs.map((d) => ({
      kind: d.label,
      fourni: true,
      documentId: d.id,
      fileName: d.name,
      url: null,
      uploadedAt: null,
    })),
  };
}

/** Distinct ouvriers seen on the prestataire's occurrences — the mock's équipe. */
function toEquipe(missions: Commande[]): DossierEquipeMembre[] {
  const names = [
    ...new Set(missions.flatMap((c) => c.occurrences.map((o) => o.ouvrier).filter((w): w is string => !!w))),
  ];
  return names.map((name, i) => ({
    id: 'w' + i,
    fullName: name,
    role: null, // not tracked in the mock db
    skill: null,
    phone: null,
    whatsAppPhone: null,
    weeklyHours: null,
    hourlyRateCredits: null,
    isSousTraitant: false,
    createdAt: null,
  }));
}

/**
 * Mirrors the two contracts the prototype seeds client-side (contractsStore), so
 * the contrat tab shows the same thing offline as it did before this endpoint.
 */
const SEEDED_CONTRACTS: Record<string, { fileName: string; signedAt: string }> = {
  p1: { fileName: 'contrat-partenariat-electroplus-signe.pdf', signedAt: '2026-03-12T00:00:00+00:00' },
  p4: { fileName: 'contrat-partenariat-vertjardin-signe.pdf', signedAt: '2026-01-05T00:00:00+00:00' },
};

export function prestataireFicheOf(p: Prestataire): PrestataireFicheResponse {
  const fiche = toRow(p);
  const missions = missionsOf(p);
  const reviews = db.reviews.filter((r) => r.presId === p.id);
  const factures = toDossierFactures(missions);
  const versements = toDossierVersements(p);
  const equipe = toEquipe(missions);
  const kyc = toDossierKyc(kycOf('pres:' + p.id));
  const seeded = SEEDED_CONTRACTS[p.id];
  const co = catObj(p.cat);
  const fam = famForCat(p.cat) ?? 'NOIR';
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.note, 0) / reviews.length : 0;
  const histogram: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  reviews.forEach((r) => {
    histogram[String(r.note)] = (histogram[String(r.note)] ?? 0) + 1;
  });

  return {
    fiche,
    avis: {
      resume: {
        prestataireCompanyId: p.id,
        reviewCount: reviews.length,
        averageRating: Number(avg.toFixed(2)),
        clientCount: reviews.filter((r) => r.source === 'client').length,
        de9de9Count: reviews.filter((r) => r.source === 'de9de9').length,
        ratingHistogram: histogram,
      },
      avis: {
        meta: {
          current_page: 1,
          per_page: Math.max(1, reviews.length),
          total: reviews.length,
          total_pages: 1,
          has_more_pages: false,
        },
        data: reviews.map((r) => toAvisItem(r, p.id)),
      },
    },
    dossier: {
      infos: {
        id: p.id,
        type: 'Prestataire',
        legalName: p.name,
        tradeName: p.name,
        nif: null, // no legal identifiers in the mock db
        nis: null,
        rc: null,
        articleImposition: null,
        wilaya: p.wilayas[0] ?? null,
        commune: fiche.commune ?? null,
        address: null,
        contactPhone: p.phone,
        contactEmail: p.email,
        isActive: true,
        membresActifs: equipe.length,
        createdAt: null,
        updatedAt: null,
      },
      vitrine: {
        nomAffiche: p.name,
        pitch: null,
        logoUrl: null,
        wilaya: p.wilayas[0] ?? null,
        commune: fiche.commune ?? null,
        zones: fiche.zones,
        familles: [{ code: fam.toLowerCase(), libelle: FAM_LABEL[fam], hex: FAM_COLOR[fam] }],
        categories: co ? [{ code: slugify(co.fr), libelle: co.fr }] : [],
        sousCategories: p.subs.map((s) => ({ code: slugify(s), libelle: s })),
        effectif: p.effectif,
        anneeCreation: new Date().getFullYear() - p.anc,
        ancienneteAnnees: p.anc,
        langues: p.langues,
        certifications: p.certs,
        tarifMinCredits: (fiche.tarifMinDzd ?? 0) * CREDITS_PER_DZD,
        tarifMaxCredits: (fiche.tarifMaxDzd ?? 0) * CREDITS_PER_DZD,
        delaiReponseHeures: fiche.delaiReponseHeures,
        dispoNow: fiche.dispoNow,
        kycVerifie: p.kyc,
        certifie: p.certs.length > 0,
        note: p.rating,
        nombreAvis: p.reviews,
        missions: p.missions,
        satisfactionPercent: p.sat,
        liste: true,
      },
      kyc,
      contrat: seeded
        ? {
            isSigned: true,
            signedAt: seeded.signedAt,
            documentId: 'doc:' + p.id,
            fileName: seeded.fileName,
            url: null,
            uploadedAt: seeded.signedAt,
          }
        : { isSigned: false, signedAt: null, documentId: null, fileName: null, url: null, uploadedAt: null },
      commandes: missions.map(toDossierCommande),
      factures,
      credits: null,
      versements,
      documents: seeded
        ? [
            {
              id: 'doc:' + p.id,
              kind: 'PartnershipContract',
              fileName: seeded.fileName,
              url: null,
              contentType: 'application/pdf',
              sizeBytes: null,
              contractId: null,
              invoiceId: null,
              rechargeId: null,
              uploadedByUserId: null,
              createdAt: seeded.signedAt,
            },
          ]
        : [],
      avis: reviews.map(toDossierAvis),
      equipe,
      stats: {
        commandesTotal: missions.length,
        commandesActives: missions.filter((c) => c.occurrences.some((o) => o.status !== 'paid' && o.status !== 'cancelled')).length,
        facturesTotal: factures.length,
        creditsSolde: null,
        missionsRealisees: p.missions,
        noteMoyenne: reviews.length ? Number(avg.toFixed(2)) : p.rating,
        nombreAvis: reviews.length,
        effectifEquipe: equipe.length,
        versementsTotalCredits: versements.reduce((s, v) => s + (v.partPrestataireCredits ?? 0), 0),
        partPrestatairePourcent: Math.round(PRESTATAIRE_SHARE * 100),
      },
      totals: {
        commandes: missions.length,
        factures: factures.length,
        versements: versements.length,
        documents: seeded ? 1 : 0,
        avis: reviews.length,
        avisClients: reviews.filter((r) => r.source === 'client').length,
        avisDe9de9: reviews.filter((r) => r.source === 'de9de9').length,
        equipe: equipe.length,
      },
    },
  };
}

/** Resolves by mock prestataire id first, then by name (console deep links). */
export const prestataireFicheHandler: MockHandler = (req) => {
  const key = req.pathParams['companyId'] ?? '';
  const p = findPrestataire(key);
  if (!p) return { status: 404, data: { message: `Prestataire introuvable : ${key}` } };
  return { data: prestataireFicheOf(p) };
};
