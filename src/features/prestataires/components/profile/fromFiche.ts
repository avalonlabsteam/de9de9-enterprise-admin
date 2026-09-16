// Maps the GET /prestataires/{companyId} payload onto the view-models the
// profile overlay renders. Everything the tabs display comes from this one
// response — identity, KYC, contrat, commandes, factures, versements, avis,
// équipe and stats — so the panels stay presentational.
//
// Money in the dossier is already in credits; the fiche's tarifs are the only
// DZD amounts. Dates arrive as ISO 8601 and are formatted to the prototype's
// dd/mm/yyyy here.
import type { TKey } from '@/lib/i18n';
import type { KycAuditEntry, KycDoc, KycStatus } from '../../schemas/prestataire';
import type {
  AvisItem,
  DossierCommande,
  DossierContrat,
  DossierEquipeMembre,
  DossierFacture,
  DossierKyc,
  DossierVersement,
  PrestataireFicheResponse,
} from '../../schemas/fiche';
import { fmtMoney, type StatusBadge, type Translate } from './lib';

const DASH = '—';

/** ISO 8601 → 'dd/mm/yyyy' ('—' when absent or unparseable). */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Two-letter avatar initials, as the prototype derives them. */
function initialsOf(name: string): string {
  const caps = name.replace(/[a-z ]/g, '').slice(0, 2);
  return (caps || name.slice(0, 2)).toUpperCase();
}

// ---------------------------------------------------------------- header ----

export interface ProfileVM {
  companyId: string;
  name: string;
  init: string;
  pitch: string;
  famColor: string;
  famLabel: string;
  categoryLabel: string;
  subs: string[];
  /** Coverage wilayas, deduped: the fiche's own plus every zone's. */
  zones: string[];
  rating: string;
  reviewCount: number;
  missions: number;
  satisfaction: string;
  effectif: string;
  anciennete: string;
  anneeCreation: string;
  tarif: string;
  delai: string;
  langues: string[];
  certifications: string[];
  kycVerifie: boolean;
  phone: string;
  waUrl: string;
  email: string;
  /** dossier.infos — empty strings when the dossier is absent. */
  legalName: string;
  nif: string;
  nis: string;
  rc: string;
  address: string;
}

const FAM_FALLBACK = '#232838';

export function profileVM(payload: PrestataireFicheResponse): ProfileVM {
  const f = payload.fiche;
  const infos = payload.dossier?.infos;
  const fam = f.familles[0];
  const zones = [
    ...new Set([...(f.wilaya ? [f.wilaya] : []), ...f.zones.map((z) => z.wilaya)].filter(Boolean)),
  ];
  const tarif =
    f.tarifMinDzd != null && f.tarifMaxDzd != null
      ? `${fmtMoney(f.tarifMinDzd)} – ${fmtMoney(f.tarifMaxDzd)}`
      : (f.tarifPalier?.label ?? DASH);
  const phone = f.contactPhone ?? infos?.contactPhone ?? '';

  return {
    companyId: f.companyId ?? f.id,
    name: f.nom,
    init: initialsOf(f.nom),
    pitch: f.pitch ?? '',
    famColor: fam?.hex ?? FAM_FALLBACK,
    famLabel: fam?.label ?? '',
    categoryLabel: f.categories[0]?.label ?? DASH,
    subs: f.sousCategories.map((s) => s.label),
    zones,
    rating: f.note != null ? f.note.toFixed(1) : '0.0',
    reviewCount: f.nombreAvis,
    missions: f.missions,
    satisfaction: f.satisfactionPercent != null ? f.satisfactionPercent + '%' : DASH,
    effectif: f.effectif != null ? String(f.effectif) : DASH,
    anciennete: f.ancienneteAnnees != null ? String(f.ancienneteAnnees) : DASH,
    anneeCreation: f.anneeCreation != null ? String(f.anneeCreation) : DASH,
    tarif,
    delai: f.delaiReponseHeures != null ? f.delaiReponseHeures + ' h' : DASH,
    langues: (f.langues ?? []).map((x) => x.toUpperCase()),
    certifications: f.certifications,
    kycVerifie: f.kycVerifie,
    phone,
    waUrl: f.whatsAppUrl ?? (f.whatsAppPhone ? 'https://wa.me/' + f.whatsAppPhone.replace(/\D/g, '') : ''),
    email: f.contactEmail ?? infos?.contactEmail ?? '',
    legalName: infos?.legalName ?? '',
    nif: infos?.nif ?? '',
    nis: infos?.nis ?? '',
    rc: infos?.rc ?? '',
    address: [infos?.address, infos?.commune, infos?.wilaya].filter(Boolean).join(', '),
  };
}

// -------------------------------------------------------------- missions ----

/** `setup` codes are 'S1_ToCall' … 'S4_Contracted'; only the S-prefix is styled. */
const SETUP_BADGE: Record<string, [TKey, string, string]> = {
  S1: ['fSArappeler', '#FDECEC', '#E7464E'],
  S2: ['consoleDevisADemander', '#FEF3E2', '#D9871F'],
  S3: ['consoleDevisAValider', '#FEF3E2', '#D9871F'],
  S4: ['presStatutContractualise', '#E7F6EE', '#2FA86A'],
};

function setupBadge(setup: string | null | undefined, t: Translate): StatusBadge {
  const code = (setup ?? '').split('_')[0] ?? '';
  const meta = SETUP_BADGE[code];
  if (!meta) return { label: setup ?? DASH, bg: '#EEF1F4', fg: '#6B7280' };
  const [key, bg, fg] = meta;
  return { label: t(key), bg, fg };
}

export interface MissionRow {
  id: string;
  title: string;
  sub: string;
  badge: StatusBadge;
}

export function missionRows(commandes: DossierCommande[], t: Translate): MissionRow[] {
  return commandes.map((c) => ({
    id: c.id,
    title: `${c.reference ?? c.id} · ${c.serviceLabel ?? DASH}`,
    sub: [
      c.contrepartieNom ?? DASH,
      fmtDate(c.startDate),
      c.visitesCount ? `${c.visitesCount} occ.` : '',
    ]
      .filter(Boolean)
      .join(' · '),
    badge: setupBadge(c.setup, t),
  }));
}

// -------------------------------------------------------------- factures ----

const FACTURE_BADGE: Record<string, [TKey, string, string]> = {
  Deposited: ['facturesDeposeeAApprouver', '#FEF6E9', '#C98A1E'],
  Approved: ['facturesApprouveeCourt', '#E6F6EC', '#2E9E5B'],
  Contested: ['consoleBadgeContestee', '#FDECEC', '#E7464E'],
  Settled: ['consoleBadgePayee', '#EEF1F4', '#6B7280'],
  Cancelled: ['consoleBadgeAnnulee', '#F1F4F6', '#9AA4B2'],
};

function factureBadge(statut: string | null | undefined, t: Translate): StatusBadge {
  const meta = FACTURE_BADGE[statut ?? ''];
  if (!meta) return { label: statut ?? DASH, bg: '#EEF1F4', fg: '#6B7280' };
  const [key, bg, fg] = meta;
  return { label: t(key), bg, fg };
}

export interface FactureRow {
  id: string;
  ref: string;
  montant: string;
  sub: string;
  badge: StatusBadge;
  fileName: string;
}

export function factureRows(factures: DossierFacture[], t: Translate): FactureRow[] {
  return factures.map((f) => ({
    id: f.id,
    ref: f.reference ?? f.id,
    montant: fmtMoney(f.montantCredits ?? 0),
    sub: [fmtDate(f.createdAt), f.contrepartieNom].filter(Boolean).join(' · '),
    badge: factureBadge(f.statut, t),
    fileName: 'facture-service-' + (f.reference ?? f.id) + '.pdf',
  }));
}

// ------------------------------------------------------------ versements ----

export interface VersementRow {
  id: string;
  montant: string;
  sub: string;
  /** Server label ('Transfere'); localized when it is the expected value. */
  statut: string;
  fileName: string;
}

export function versementRows(versements: DossierVersement[], t: Translate): VersementRow[] {
  return versements.map((v) => ({
    id: v.id,
    montant: fmtMoney(v.partPrestataireCredits ?? v.brutCredits ?? 0),
    sub: [v.refAffichee ?? v.reference, fmtDate(v.paidAt)].filter(Boolean).join(' · '),
    statut: v.statut === 'Transfere' ? t('transfere') : (v.statut ?? DASH),
    fileName: 'facture-service-' + (v.factureReference ?? v.reference ?? '') + '.pdf',
  }));
}

// ---------------------------------------------------------------- équipe ----

export interface EquipeRow {
  id: string;
  name: string;
  init: string;
  role: string;
  sub: string;
}

export function equipeRows(equipe: DossierEquipeMembre[], t: Translate): EquipeRow[] {
  return equipe.map((m) => ({
    id: m.id,
    name: m.fullName,
    init: m.fullName.slice(0, 1).toUpperCase(),
    role: m.role ?? '',
    sub: [
      m.skill,
      m.weeklyHours != null ? `${m.weeklyHours} ${t('presHeuresSemaine')}` : '',
      m.phone,
    ]
      .filter(Boolean)
      .join(' · '),
  }));
}

// ------------------------------------------------------------------- KYC ----

const KYC_STATUS: Record<string, KycStatus> = {
  Verified: 'verified',
  Pending: 'pending',
  Rejected: 'rejected',
};

/** Localized label for the required-piece kinds the API sends. */
const PIECE_LABEL: Record<string, TKey> = {
  KycRc: 'presPieceRc',
  KycNif: 'presPieceNif',
  KycNis: 'presPieceNis',
};

export interface KycView {
  status: KycStatus;
  motif: string;
  docs: KycDoc[];
  audit: KycAuditEntry[];
}

/**
 * The payload has no journal, so the audit trail holds at most the server's own
 * review event; the overlay layers its local entries on top.
 */
export function kycView(kyc: DossierKyc | null | undefined, t: Translate): KycView {
  if (!kyc) return { status: 'pending', motif: '', docs: [], audit: [] };
  const audit: KycAuditEntry[] = [];
  if (kyc.reviewedAt) {
    audit.push({
      who: 'de9de9',
      action: t('presKycRevu') + ' · ' + (KYC_STATUS[kyc.statut] ?? kyc.statut),
      date: fmtDate(kyc.reviewedAt),
    });
  }
  return {
    status: KYC_STATUS[kyc.statut] ?? 'pending',
    motif: kyc.motifRejet ?? '',
    docs: (kyc.pieces ?? []).map((p) => {
      const key = PIECE_LABEL[p.kind];
      return {
        id: p.documentId ?? p.kind,
        label: key ? t(key) : p.kind,
        name: p.fileName ?? t('presPieceNonFournie'),
      };
    }),
    audit,
  };
}

// --------------------------------------------------------------- contrat ----

export interface ContratView {
  fileName: string;
  signedDate: string;
  signed: boolean;
  url: string;
}

export function contratView(contrat: DossierContrat | null | undefined): ContratView | null {
  if (!contrat?.fileName) return null;
  return {
    fileName: contrat.fileName,
    signedDate: fmtDate(contrat.signedAt ?? contrat.uploadedAt),
    signed: contrat.isSigned === true,
    url: contrat.url ?? '',
  };
}

// ------------------------------------------------------------------ avis ----

export interface AvisRow {
  id: string;
  source: 'client' | 'de9de9';
  auteur: string;
  note: number;
  comment: string;
  sub: string;
}

export interface AvisView {
  rows: AvisRow[];
  count: number;
  avg: number;
  nClient: number;
  nDe9: number;
}

/**
 * Prefers `dossier.avis`, which names the client (`contrepartieNom`) where the
 * public `avis.avis.data` leaves `auteurNom` null.
 */
export function avisView(payload: PrestataireFicheResponse, t: Translate): AvisView {
  const dossierAvis = payload.dossier?.avis ?? [];
  const rows: AvisRow[] = dossierAvis.length
    ? dossierAvis.map((a) => ({
        id: a.id,
        source: a.auteurType === 'de9de9' ? 'de9de9' : 'client',
        auteur: a.auteurNom ?? a.contrepartieNom ?? t('sourceClient'),
        note: a.note,
        comment: a.commentaire ?? '',
        sub: [a.commandeReference, fmtDate(a.createdAt)].filter(Boolean).join(' · '),
      }))
    : (payload.avis?.avis.data ?? []).map((a: AvisItem) => ({
        id: a.id,
        source: a.auteurType === 'de9de9' ? 'de9de9' : 'client',
        auteur: a.auteurNom ?? t('sourceClient'),
        note: a.rating,
        comment: a.comment ?? '',
        sub: [a.contractReference ?? a.serviceLabel, fmtDate(a.createdAt)].filter(Boolean).join(' · '),
      }));

  const resume = payload.avis?.resume;
  return {
    rows,
    count: resume?.reviewCount ?? rows.length,
    avg: resume?.averageRating ?? (rows.length ? rows.reduce((s, r) => s + r.note, 0) / rows.length : 0),
    nClient: resume?.clientCount ?? rows.filter((r) => r.source === 'client').length,
    nDe9: resume?.de9de9Count ?? rows.filter((r) => r.source === 'de9de9').length,
  };
}

// ----------------------------------------------------------------- stats ----

export interface StatCard {
  value: string;
  label: string;
  accent?: boolean;
}

export function statCards(payload: PrestataireFicheResponse, vm: ProfileVM, t: Translate): StatCard[] {
  const s = payload.dossier?.stats;
  const totals = payload.dossier?.totals;
  return [
    { value: fmtMoney(s?.versementsTotalCredits ?? 0), label: t('statCA') },
    { value: String(s?.missionsRealisees ?? totals?.commandes ?? vm.missions), label: t('statMissionsL') },
    { value: vm.satisfaction, label: t('statSatL'), accent: true },
    { value: vm.delai, label: t('statDelaiL') },
    { value: String(s?.effectifEquipe ?? totals?.equipe ?? 0), label: t('presTabEquipe') },
    {
      value: s?.partPrestatairePourcent != null ? s.partPrestatairePourcent + '%' : DASH,
      label: t('presPartPrestataire'),
    },
  ];
}
