// Pure derivation helpers for the client fiche — ported from src/admin/logic.ts
// (buildClientFiche, cmdLineVM, cmdState/occProj/setupProj badges, factStatusMeta,
// buildKycVM meta, withDay, kycOf defaults).
import type { TKey } from '@/lib/i18n';
import type {
  FicheCommande,
  FicheCredit,
  FicheFacture,
  FicheKycStatus,
  FicheOccStatus,
} from '../api/clients';

export type Translate = (key: TKey) => string;
export type Bilingual = (fr: string, ar: string) => string;

export interface StatusBadge {
  label: string;
  bg: string;
  fg: string;
}

/** fr-FR money formatting like the prototype ('15 000'). */
export const fmtMoney = (n: number): string => n.toLocaleString('fr-FR');

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

/** Client initials (logic.ts buildClientFiche init). */
export function clientInit(name: string): string {
  return (name.replace(/[a-zàâçéèêëîïôûùü' ]/g, '').slice(0, 2) || name.slice(0, 2)).toUpperCase();
}

// ---------- occurrence / setup badges (logic.ts occProj + setupProj) ----------
const OCC_BADGES: Record<FicheOccStatus, [TKey, string, string]> = {
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

function setupBadge(cmd: FicheCommande, t: Translate): StatusBadge | null {
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
function currentOcc(cmd: FicheCommande): FicheCommande['occurrences'][number] | null {
  const order: FicheOccStatus[] = [
    'doneDisputed', 'doneApproved', 'doneInvoiced', 'doneNoInvoice',
    'confirmed', 'confirmedAssigned', 'toConfirm', 'added',
  ];
  let best: FicheCommande['occurrences'][number] | null = null;
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
export function cmdBadge(cmd: FicheCommande, t: Translate): StatusBadge {
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

// ---------- commandes list rows (logic.ts cmdLineVM) ----------
export interface CmdLine {
  id: string;
  service: string;
  pres: string;
  date: string;
  occLabel: string;
  status: StatusBadge;
}

export function cmdLine(cmd: FicheCommande, t: Translate): CmdLine {
  const occ = cmd.occurrences;
  const first = occ[0];
  return {
    id: cmd.id,
    service: cmd.service,
    pres: cmd.prestataire ? cmd.prestataire.name : '—',
    date: first ? withDay(first.date, t) : '—',
    occLabel: occ.length > 1 ? occ.length + ' occ.' : '',
    status: cmdBadge(cmd, t),
  };
}

// ---------- factures (logic.ts factStatusMeta + buildClientFiche facs) ----------
const FACT_META: Record<FicheFacture['status'], [TKey, string, string]> = {
  doneInvoiced: ['facturesDeposeeAApprouver', '#FEF6E9', '#C98A1E'],
  doneDisputed: ['consoleBadgeContestee', '#FDECEC', '#E7464E'],
  doneApproved: ['facturesApprouveeCourt', '#E6F6EC', '#2E9E5B'],
  paid: ['consoleBadgePayee', '#EEF1F4', '#6B7280'],
};

export function factStatusMeta(status: FicheFacture['status'], t: Translate): StatusBadge {
  const [key, bg, fg] = FACT_META[status];
  return { label: t(key), bg, fg };
}

export interface FactureLine {
  cmdId: string;
  ref: string;
  montant: string;
  date: string;
  pres: string;
  status: StatusBadge;
  title: string;
  file: string;
}

export function factureLine(f: FicheFacture, t: Translate): FactureLine {
  return {
    cmdId: f.cmdId,
    ref: f.ref,
    montant: fmtMoney(f.montant),
    date: withDay(f.date, t),
    pres: f.pres,
    status: factStatusMeta(f.status, t),
    title: t('clientFactureTitre') + ' ' + f.ref,
    file: 'facture-' + f.ref + '.pdf',
  };
}

// ---------- credits (logic.ts buildClientFiche recharges/moves/docsList) ----------
export interface RechargeLine {
  date: string;
  ref: string;
  montant: string;
  justif: boolean;
  justifName: string;
  justifTitle: string;
  facture: boolean;
  factName: string;
  factTitle: string;
  refBadge: string;
}

export function rechargeLine(r: FicheCredit, t: Translate): RechargeLine {
  const justif = r.justif ?? null;
  const facture = r.facture ?? null;
  return {
    date: withDay(r.date, t),
    ref: r.ref,
    montant: fmtMoney(r.credits),
    justif: !!justif,
    justifName: justif ? justif.name : '',
    justifTitle: t('clientJustifPaiement'),
    facture: !!facture,
    factName: facture ? facture.name : '',
    factTitle: t('clientFactureEmise'),
    refBadge: !justif || !facture ? t('clientPieceManquante') : '',
  };
}

export interface MoveLine {
  date: string;
  ref: string;
  montant: string;
  color: string;
  label: string;
}

const MOVE_LABELS: Record<FicheCredit['type'], TKey> = {
  rech: 'creditsRecharge',
  deb: 'clientDebit',
  vers: 'creditsVersement',
};

export function moveLine(r: FicheCredit, t: Translate): MoveLine {
  return {
    date: withDay(r.date, t),
    ref: r.ref,
    montant: (r.credits > 0 ? '+' : '') + fmtMoney(r.credits),
    color: r.credits > 0 ? '#2FA86A' : '#E7464E',
    label: t(MOVE_LABELS[r.type]),
  };
}

export interface DocLine {
  title: string;
  file: string;
}

/** Pieces linked to the client — derived from its recharges (logic.ts docsList). */
export function docsFromRecharges(recharges: RechargeLine[]): DocLine[] {
  const out: DocLine[] = [];
  recharges.forEach((rc) => {
    if (rc.justif) out.push({ title: rc.justifTitle + ' · ' + rc.ref, file: rc.justifName });
    if (rc.facture) out.push({ title: rc.factTitle + ' · ' + rc.ref, file: rc.factName });
  });
  return out;
}

// ---------- KYC meta (logic.ts buildKycVM) ----------
export interface KycMeta {
  label: string;
  bg: string;
  fg: string;
  icon: string;
}

const KYC_META: Record<FicheKycStatus, [TKey, string, string, string]> = {
  verified: ['commonKycVerifie', '#E7F6EE', '#178A82', '✓'],
  pending: ['commonKycEnAttente', '#FBF4E4', '#B68A2E', '⏳'],
  rejected: ['commonKycRejete', '#FDECEC', '#E7464E', '✕'],
};

export function kycMeta(status: FicheKycStatus, t: Translate): KycMeta {
  const [key, bg, fg, icon] = KYC_META[status];
  return { label: t(key), bg, fg, icon };
}

/** French status labels used verbatim in the KYC journal + toast (logic.ts setKycStatus). */
export const KYC_LABEL_FR: Record<FicheKycStatus, string> = {
  verified: 'Vérifié',
  pending: 'En attente',
  rejected: 'Rejeté',
};
