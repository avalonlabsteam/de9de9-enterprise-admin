// Pure derivation helpers for the prestataire profile — ported from
// src/admin/logic.ts (renderVals profile section: profileReviews, presStats,
// buildPresFicheExtra, cmdLineVM, factStatusMeta, buildKycVM meta, synthPres,
// famColor/famLabel/catObj, withDay).
import type { TKey } from '@/lib/i18n';
import type { Prestataire } from '../../schemas/prestataire';
import type { Review } from '../../schemas/review';
import type { KycStatus } from '../../schemas/prestataire';
import type { ProfileCommande, ProfileOccStatus } from './data';

export type Translate = (key: TKey) => string;
export type Bilingual = (fr: string, ar: string) => string;

/** fr-FR money formatting like the prototype ('15 000'). */
export const fmtMoney = (n: number): string => n.toLocaleString('fr-FR');

// ---------- taxonomy meta (logic.ts taxo() — icon/name/family only) ----------
export type FamKey = 'NOIR' | 'BLEU' | 'VERT' | 'ROUGE';

export const FAM_COLOR: Record<FamKey, string> = {
  NOIR: '#232838',
  BLEU: '#2F9BE0',
  VERT: '#2FA86A',
  ROUGE: '#E7464E',
};
export const FAM_LABEL: Record<FamKey, string> = {
  NOIR: 'Noir',
  BLEU: 'Bleu',
  VERT: 'Vert',
  ROUGE: 'Rouge',
};

export interface TaxoMeta {
  fam: FamKey;
  icon: string;
  fr: string;
  ar: string;
}

const TAXO_META: Record<number, TaxoMeta> = {
  1: { fam: 'NOIR', icon: '⚖️', fr: 'Services Juridiques & Légaux', ar: 'الخدمات القانونية' },
  2: { fam: 'NOIR', icon: '🧮', fr: 'Comptabilité, Finance & Fiscalité', ar: 'المحاسبة والمالية' },
  3: { fam: 'BLEU', icon: '👥', fr: 'Ressources Humaines & Recrutement', ar: 'الموارد البشرية' },
  4: { fam: 'BLEU', icon: '💻', fr: 'Services Informatiques & Digitaux', ar: 'خدمات المعلوماتية' },
  5: { fam: 'ROUGE', icon: '📣', fr: 'Marketing, Communication & Créatif', ar: 'التسويق والاتصال' },
  6: { fam: 'VERT', icon: '🧼', fr: 'Nettoyage & Hygiène', ar: 'النظافة والصحة' },
  7: { fam: 'NOIR', icon: '🛡️', fr: 'Sécurité & Gardiennage', ar: 'الأمن والحراسة' },
  8: { fam: 'BLEU', icon: '🚚', fr: 'Logistique, Transport & Supply Chain', ar: 'اللوجستيك والنقل' },
  9: { fam: 'VERT', icon: '🏗️', fr: 'BTP, Travaux & Aménagement', ar: 'البناء والأشغال' },
  10: { fam: 'VERT', icon: '🔧', fr: 'Maintenance Industrielle & Technique', ar: 'الصيانة الصناعية' },
  11: { fam: 'NOIR', icon: '📊', fr: "Conseil & Stratégie d'Entreprise", ar: 'الاستشارة والاستراتيجية' },
  12: { fam: 'ROUGE', icon: '📦', fr: 'Fournitures & Équipements (B2B)', ar: 'اللوازم والتجهيزات' },
  13: { fam: 'ROUGE', icon: '🍽️', fr: 'Restauration & Événementiel', ar: 'الإطعام والمناسبات' },
  14: { fam: 'BLEU', icon: '🛟', fr: 'Assurance & Gestion des Risques', ar: 'التأمين وإدارة المخاطر' },
  15: { fam: 'BLEU', icon: '🌍', fr: 'Import-Export & Commerce International', ar: 'الاستيراد والتصدير' },
  16: { fam: 'VERT', icon: '🗂️', fr: 'Services Généraux & Support', ar: 'الخدمات العامة والدعم' },
};

export function catMeta(cat: number | null): TaxoMeta | null {
  return cat != null ? (TAXO_META[cat] ?? null) : null;
}

export const tarifLabel = (lvl: number): string => '€'.repeat(lvl);

// ---------- dates (logic.ts dayName / withDay) ----------
const DAY_KEYS: readonly TKey[] = [
  'commonJourDimanche',
  'commonJourLundi',
  'commonJourMardi',
  'commonJourMercredi',
  'commonJourJeudi',
  'commonJourVendredi',
  'commonJourSamedi',
];

/** Prefix the localized weekday to a dd/mm/yyyy date found in `s` (logic.ts withDay). */
export function withDay(s: string, t: Translate): string {
  const m = (s || '').match(/(\d{2}\/\d{2}\/\d{4})/);
  if (!m || !m[1]) return s;
  const p = m[1].split('/');
  const dt = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
  if (Number.isNaN(dt.getTime())) return s;
  const key = DAY_KEYS[dt.getDay()];
  if (!key) return s;
  return s.replace(m[1], t(key) + ' ' + m[1]);
}

/** 'dd/mm/yyyy · hh:mm' stamp for local KYC journal entries (logic.ts logKyc). */
export function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() +
    ' · ' + p(d.getHours()) + ':' + p(d.getMinutes())
  );
}

// ---------- profile subject (real prestataire or logic.ts synthPres) ----------
export interface ProfileSubject {
  id: string;
  name: string;
  init: string;
  cat: number | null;
  subs: string[];
  wilayas: string[];
  rating: number;
  reviews: number;
  missions: number;
  /** already formatted: '97%' or '—' */
  sat: string;
  delai: string;
  /** already formatted: '12' or '—' */
  effectif: string;
  /** already formatted: '6' or '—' */
  anc: string;
  tarif: number;
  langues: string[];
  certs: string[];
  kyc: boolean;
  phone: string;
  wa: string;
  email: string;
  refs: { client: string; service: string }[];
  synth: boolean;
}

export function subjectFromPres(p: Prestataire): ProfileSubject {
  return {
    id: p.id,
    name: p.name,
    init: p.init,
    cat: p.cat,
    subs: p.subs,
    wilayas: p.wilayas,
    rating: p.rating,
    reviews: p.reviews,
    missions: p.missions,
    sat: p.sat + '%',
    delai: p.delai,
    effectif: String(p.effectif),
    anc: String(p.anc),
    tarif: p.tarif,
    langues: p.langues,
    certs: p.certs,
    kyc: p.kyc,
    phone: p.phone,
    wa: p.wa,
    email: p.email,
    refs: p.refs,
    synth: false,
  };
}

/** External prestataire known only from its missions (logic.ts synthPres). */
export function synthSubject(name: string, missions: ProfileCommande[]): ProfileSubject {
  const pj = missions.map((c) => c.prestataire).find((x) => !!x) ?? null;
  const phone = pj?.phone ?? '0000000000';
  return {
    id: 'ext:' + name,
    name,
    init: (name.replace(/[a-z ]/g, '').slice(0, 2) || name.slice(0, 2)).toUpperCase(),
    cat: null,
    subs: [],
    wilayas: [...new Set(missions.map((c) => c.wilaya).filter(Boolean))],
    rating: 0,
    reviews: 0,
    missions: missions.length,
    sat: '—',
    delai: '—',
    effectif: '—',
    anc: '—',
    tarif: 0,
    langues: [],
    certs: [],
    kyc: false,
    phone,
    wa: phone.replace(/^0/, '213'),
    email: pj?.email ?? '',
    refs: [],
    synth: true,
  };
}

// ---------- rating stats from reviews (logic.ts presStats) ----------
export interface PresStats {
  count: number;
  avg: number;
  nClient: number;
  nDe9: number;
}

export function presStats(reviews: Review[]): PresStats {
  const count = reviews.length;
  const avg = count ? reviews.reduce((s, r) => s + r.note, 0) / count : 0;
  return {
    count,
    avg,
    nClient: reviews.filter((r) => r.source === 'client').length,
    nDe9: reviews.filter((r) => r.source === 'de9de9').length,
  };
}

/** '★★★☆☆' star string (logic.ts profileReviews). */
export function starsOf(note: number): string {
  return '★★★★★'.slice(0, note) + '☆☆☆☆☆'.slice(0, 5 - note);
}

// ---------- status badges (logic.ts occProj/setupProj badge + cmdLineVM) ----------
export interface StatusBadge {
  label: string;
  bg: string;
  fg: string;
}

const OCC_BADGES: Record<ProfileOccStatus, [TKey, string, string]> = {
  added: ['consoleBadgeAPlanifier', '#FBF4E4', '#B68A2E'],
  toConfirm: ['consoleBadgeAConfirmer', '#EAF2FD', '#2F7FD0'],
  confirmed: ['consoleBadgeConfirmee', '#E7F6EE', '#2FA86A'],
  confirmedAssigned: ['consoleBadgeOuvrierAffecte', '#E7F6EE', '#2FA86A'],
  doneNoInvoice: ['consoleBadgeRealiseeSansFacture', '#F4EFFB', '#7C57C7'],
  doneInvoiced: ['consoleBadgeFactureDeposee', '#F4EFFB', '#7C57C7'],
  doneDisputed: ['consoleBadgeContestee', '#FDECEC', '#E7464E'],
  doneApproved: ['consoleBadgeApprouvee', '#E7F6EE', '#2FA86A'],
  paid: ['consoleBadgePayee', '#E7F6EE', '#2FA86A'],
  cancelled: ['consoleBadgeAnnulee', '#F1F4F6', '#9AA4B2'],
};

function setupBadge(cmd: ProfileCommande, t: Translate): StatusBadge | null {
  if (cmd.setup === 'arappeler') return { label: t('fSArappeler'), bg: '#FDECEC', fg: '#E7464E' };
  if (cmd.setup === 'contacte')
    return { label: t('consoleDevisADemander'), bg: '#FEF3E2', fg: '#D9871F' };
  if (cmd.setup === 'devis') {
    const dv = cmd.devis ?? [];
    const anyRecu = dv.some((d) => d.status === 'recu');
    const anyValide = dv.some((d) => d.status === 'valide');
    if (cmd.proposedToClient && anyValide)
      return { label: t('consoleDevisTransmisAttente'), bg: '#EAF2FD', fg: '#2F7FD0' };
    if (anyRecu || anyValide)
      return { label: t('consoleDevisAValider'), bg: '#FEF3E2', fg: '#D9871F' };
    return { label: t('consoleAttenteDevis'), bg: '#FEF3E2', fg: '#D9871F' };
  }
  return null; // assigne → handled by occurrences
}

/** Earliest non-terminal occurrence, by action priority (logic.ts currentOcc). */
function currentOcc(cmd: ProfileCommande): ProfileCommande['occurrences'][number] | null {
  const order: ProfileOccStatus[] = [
    'doneDisputed', 'doneApproved', 'doneInvoiced', 'doneNoInvoice',
    'confirmed', 'confirmedAssigned', 'toConfirm', 'added',
  ];
  let best: ProfileCommande['occurrences'][number] | null = null;
  let bi = 99;
  cmd.occurrences.forEach((o) => {
    const i = order.indexOf(o.status);
    if (i >= 0 && i < bi) {
      bi = i;
      best = o;
    }
  });
  return best;
}

/** Status badge of a commande row (logic.ts cmdState → cmdLineVM badge). */
function cmdBadge(cmd: ProfileCommande, t: Translate): StatusBadge {
  if (cmd.setup !== 'assigne') {
    const b = setupBadge(cmd, t);
    if (b) return b;
    return { label: t('commonStatutEnCours'), bg: '#EEF1F4', fg: '#6B7280' };
  }
  const o = currentOcc(cmd);
  if (!o) return { label: t('commonStatutTermine'), bg: '#EEF1F4', fg: '#6B7280' };
  const [key, bg, fg] = OCC_BADGES[o.status];
  return { label: t(key), bg, fg };
}

// ---------- missions rows (logic.ts cmdLineVM) ----------
export interface MissionLine {
  id: string;
  service: string;
  client: string;
  date: string;
  occLabel: string;
  status: StatusBadge;
}

export function missionLine(cmd: ProfileCommande, t: Translate): MissionLine {
  const occ = cmd.occurrences;
  const first = occ[0];
  return {
    id: cmd.id,
    service: cmd.service,
    client: cmd.client,
    date: first ? withDay(first.date, t) : '—',
    occLabel: occ.length > 1 ? occ.length + ' occ.' : '',
    status: cmdBadge(cmd, t),
  };
}

// ---------- factures (logic.ts facturesForCmds + factStatusMeta) ----------
const FACT_META: Partial<Record<ProfileOccStatus, [TKey, string, string]>> = {
  doneInvoiced: ['facturesDeposeeAApprouver', '#FEF6E9', '#C98A1E'],
  doneDisputed: ['consoleBadgeContestee', '#FDECEC', '#E7464E'],
  doneApproved: ['facturesApprouveeCourt', '#E6F6EC', '#2E9E5B'],
  paid: ['consoleBadgePayee', '#EEF1F4', '#6B7280'],
};

function factStatusMeta(status: ProfileOccStatus, t: Translate): StatusBadge {
  const meta = FACT_META[status];
  if (!meta) return { label: t('commonDash'), bg: '#EEF1F4', fg: '#6B7280' };
  const [key, bg, fg] = meta;
  return { label: t(key), bg, fg };
}

export interface FactureLine {
  cmdId: string;
  ref: string;
  montantNum: number;
  montant: string;
  date: string;
  status: StatusBadge;
  title: string;
  file: string;
}

/** Deposited occurrence invoices of the profile's missions (logic.ts buildPresFicheExtra facs). */
export function facturesForMissions(missions: ProfileCommande[], t: Translate): FactureLine[] {
  const out: FactureLine[] = [];
  missions.forEach((cmd) =>
    cmd.occurrences.forEach((o) => {
      if (!o.facture || !o.facture.deposee) return;
      const ref = 'F-' + cmd.id.replace(/[^0-9]/g, '');
      out.push({
        cmdId: cmd.id,
        ref,
        montantNum: o.facture.montant,
        montant: fmtMoney(o.facture.montant),
        date: withDay(o.date, t),
        status: factStatusMeta(o.status, t),
        title: t('presFactureService') + ' ' + ref,
        file: 'facture-service-' + ref + '.pdf',
      });
    }),
  );
  return out;
}

// ---------- équipe (logic.ts buildPresFicheExtra ouvriers) ----------
export interface OuvrierLine {
  name: string;
  init: string;
}

export function ouvriersForMissions(missions: ProfileCommande[]): OuvrierLine[] {
  const names = [
    ...new Set(
      missions.flatMap((c) => c.occurrences.map((o) => o.ouvrier).filter((w): w is string => !!w)),
    ),
  ];
  return names.map((w) => ({ name: w, init: w.slice(0, 1) }));
}

// ---------- KYC status meta (logic.ts buildKycVM) ----------
export interface KycMeta {
  label: string;
  bg: string;
  fg: string;
  icon: string;
}

const KYC_META: Record<KycStatus, [TKey, string, string, string]> = {
  verified: ['commonKycVerifie', '#E7F6EE', '#178A82', '✓'],
  pending: ['commonKycEnAttente', '#FBF4E4', '#B68A2E', '⏳'],
  rejected: ['commonKycRejete', '#FDECEC', '#E7464E', '✕'],
};

export function kycMeta(status: KycStatus, t: Translate): KycMeta {
  const [key, bg, fg, icon] = KYC_META[status];
  return { label: t(key), bg, fg, icon };
}

/** French status labels used in the KYC journal entries (logic.ts setKycStatus). */
export const KYC_LABEL_FR: Record<KycStatus, string> = {
  verified: 'Vérifié',
  pending: 'En attente',
  rejected: 'Rejeté',
};
