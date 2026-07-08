// COMMANDES — command detail console. Visual ground truth: src/admin/views/Console.tsx;
// behavioral ground truth: logic.ts buildConsole()/buildAgir()/act()/devisAct()
// (status projections, band, prochaine action, devis flow, occurrences, agir, audit).
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useT, useL, type TKey } from '@/lib/i18n';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { useCommande, useCommandeAction, useDevisAction } from '../../api/commandes';
import type {
  Ball,
  Commande,
  CommandeActionInput,
  DevisActionInput,
  Occurrence,
  OccStatus,
} from '../../schemas/commande';
import {
  ApproveModal,
  AssignModal,
  ChooseModal,
  DepositModal,
  ReprogramModal,
  ViewFactureModal,
  type ViewFactureVM,
} from './ActionModals';
import { DocViewer, type DocState } from './DocViewer';

type Tr = (key: TKey) => string;

/** Prototype's static worker team (logic.ts `workers`). */
const WORKERS: readonly string[] = ['Karim B.', 'Sofiane M.', 'Yacine T.', 'Nadia R.'];

// ===================== derivation (ported from logic.ts) =====================

/** S/V progression chip shown before each status — purely cosmetic. */
const STATUS_NUM: Record<string, string> = {
  arappeler: 'S1',
  contacte: 'S2',
  devis: 'S3',
  assigne: 'S4',
  added: 'V0',
  toConfirm: 'V1',
  confirmed: 'V2',
  confirmedAssigned: 'V3',
  doneNoInvoice: 'V4',
  doneInvoiced: 'V5',
  doneDisputed: 'V5·C',
  doneApproved: 'V6',
  paid: 'V7',
  cancelled: 'V✕',
};

const BALL_COLOR: Record<Ball, string> = {
  client: '#2F7FD0',
  pro: '#2FA86A',
  de9: '#E7464E',
  done: '#9AA4B2',
};

/** UI action kinds — logic.ts act() dispatch (incl. modal openers). */
type UiKind =
  | 'callClient'
  | 'askQuotes'
  | 'addQuote'
  | 'gotoDevis'
  | 'plan'
  | 'confirmVisit'
  | 'assign'
  | 'realize'
  | 'deposit'
  | 'approve'
  | 'contest'
  | 'resolve'
  | 'settle'
  | 'reprogram'
  | 'cancel'
  | 'addOcc'
  | 'viewFacture'
  | 'reviewPres';

interface PrimVM {
  role: 'client' | 'pro' | 'de9';
  label: string;
  next: string;
  kind: UiKind;
}

interface ProjVM {
  c: string;
  d9: string;
  p: string;
  ball: Ball;
  badge: { label: string; bg: string; fg: string };
  prim: PrimVM | null;
}

const DAY_KEYS: TKey[] = [
  'commonJourDimanche',
  'commonJourLundi',
  'commonJourMardi',
  'commonJourMercredi',
  'commonJourJeudi',
  'commonJourVendredi',
  'commonJourSamedi',
];

function dayName(ddmmyyyy: string, t: Tr): string {
  const p = ddmmyyyy.split('/');
  if (p.length !== 3) return '';
  const dt = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
  if (Number.isNaN(dt.getTime())) return '';
  const key = DAY_KEYS[dt.getDay()];
  return key ? t(key) : '';
}

function withDay(s: string, t: Tr): string {
  const m = s.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (!m?.[1]) return s;
  const d = dayName(m[1], t);
  return d ? s.replace(m[1], d + ' ' + m[1]) : s;
}

function toISO(ddmmyyyy: string): string {
  const p = ddmmyyyy.split('/');
  if (p.length !== 3) return '';
  return p[2] + '-' + p[1] + '-' + p[0];
}

function fromISO(iso: string): string {
  const p = iso.split('-');
  if (p.length !== 3) return iso;
  return p[2] + '/' + p[1] + '/' + p[0];
}

const fmt = (n: number): string => n.toLocaleString('fr-FR');

/** Full occurrence projection — logic.ts occProj (3-role labels, badge, prim). */
function occProj(o: Occurrence, t: Tr): ProjVM {
  const d = withDay(o.date, t);
  const M: Record<OccStatus, ProjVM> = {
    added: {
      c: t('consoleVisitePlanifier'),
      d9: t('consoleOccurrencePlanifier'),
      p: '—',
      ball: 'de9',
      badge: { label: t('consoleBadgeAPlanifier'), bg: '#FBF4E4', fg: '#B68A2E' },
      prim: { role: 'de9', label: t('consolePlanifierOccurrence'), next: 'toConfirm', kind: 'plan' },
    },
    toConfirm: {
      c: t('consoleVisiteAConfirmerDate').replace('{n}', d),
      d9: t('consoleAttenteClient'),
      p: t('consoleAttenteConfirmationClient'),
      ball: 'client',
      badge: { label: t('consoleBadgeAConfirmer'), bg: '#EAF2FD', fg: '#2F7FD0' },
      prim: { role: 'client', label: t('consoleConfirmerVisite'), next: 'confirmed', kind: 'confirmVisit' },
    },
    confirmed: {
      c: t('consoleProchaineVisiteDate').replace('{n}', d),
      d9: t('consoleSuiviVisite'),
      p: t('consoleVisiteAVenirAffecter'),
      ball: 'pro',
      badge: { label: t('consoleBadgeConfirmee'), bg: '#E7F6EE', fg: '#2FA86A' },
      prim: { role: 'pro', label: t('titleAssign'), next: 'confirmedAssigned', kind: 'assign' },
    },
    confirmedAssigned: {
      c: t('consoleProchaineVisiteDate').replace('{n}', d),
      d9: t('consoleVisiteAMarquerRealisee'),
      p: t('consoleOuvrierAffecteAVenir'),
      ball: 'de9',
      badge: { label: t('consoleBadgeOuvrierAffecte'), bg: '#E7F6EE', fg: '#2FA86A' },
      prim: { role: 'de9', label: t('consoleMarquerVisiteRealisee'), next: 'doneNoInvoice', kind: 'realize' },
    },
    doneNoInvoice: {
      c: t('consoleAttenteFacture'),
      d9: t('consoleSuiviFacture'),
      p: t('consoleFactureADeposer'),
      ball: 'pro',
      badge: { label: t('consoleBadgeRealiseeSansFacture'), bg: '#F4EFFB', fg: '#7C57C7' },
      prim: { role: 'pro', label: t('titleDeposit'), next: 'doneInvoiced', kind: 'deposit' },
    },
    doneInvoiced: {
      c: t('consoleFactureAApprouver'),
      d9: t('consoleAttenteClient'),
      p: t('consoleAttenteApprobation'),
      ball: 'client',
      badge: { label: t('consoleBadgeFactureDeposee'), bg: '#F4EFFB', fg: '#7C57C7' },
      prim: { role: 'client', label: t('consoleApprouverFacture'), next: 'doneApproved', kind: 'approve' },
    },
    doneDisputed: {
      c: t('consoleFactureContestee'),
      d9: t('consoleLitigeAResoudre'),
      p: t('consoleFactureContestee'),
      ball: 'de9',
      badge: { label: t('consoleBadgeContestee'), bg: '#FDECEC', fg: '#E7464E' },
      prim: { role: 'de9', label: t('fcResoudre'), next: 'doneInvoiced', kind: 'resolve' },
    },
    doneApproved: {
      c: t('commonTermine'),
      d9: t('consoleFactureARegler'),
      p: t('consolePaiementEnAttente'),
      ball: 'de9',
      badge: { label: t('consoleBadgeApprouvee'), bg: '#E7F6EE', fg: '#2FA86A' },
      prim: { role: 'de9', label: t('consoleReglerPayer'), next: 'paid', kind: 'settle' },
    },
    paid: {
      c: t('commonTermine'),
      d9: t('commonTermine'),
      p: t('consolePayeTransfere'),
      ball: 'done',
      badge: { label: t('consoleBadgePayee'), bg: '#E7F6EE', fg: '#2FA86A' },
      prim: null,
    },
    cancelled: {
      c: t('consoleBadgeAnnulee'),
      d9: t('consoleBadgeAnnulee'),
      p: t('consoleBadgeAnnulee'),
      ball: 'done',
      badge: { label: t('consoleBadgeAnnulee'), bg: '#F1F4F6', fg: '#9AA4B2' },
      prim: null,
    },
  };
  return M[o.status];
}

/** Full setup projection — logic.ts setupProj. */
function setupProj(cmd: Commande, t: Tr): ProjVM | null {
  if (cmd.setup === 'arappeler') {
    return {
      c: t('commonEnAttente'),
      d9: t('fSArappeler'),
      p: '—',
      ball: 'de9',
      badge: { label: t('fSArappeler'), bg: '#FDECEC', fg: '#E7464E' },
      prim: { role: 'de9', label: t('consoleAppelerClientBtn'), next: 'contacte', kind: 'callClient' },
    };
  }
  if (cmd.setup === 'contacte') {
    return {
      c: t('consoleContacte'),
      d9: t('consoleDevisADemander'),
      p: '—',
      ball: 'de9',
      badge: { label: t('consoleDevisADemander'), bg: '#FEF3E2', fg: '#D9871F' },
      prim: { role: 'de9', label: t('consoleDemanderDevis'), next: 'devis', kind: 'askQuotes' },
    };
  }
  if (cmd.setup === 'devis') {
    const dv = cmd.devis ?? [];
    const anyRecu = dv.some((d) => d.status === 'recu');
    const anyValide = dv.some((d) => d.status === 'valide');
    if (cmd.proposedToClient && anyValide) {
      return {
        c: t('consoleDevisRecusAChoisir'),
        d9: t('consoleAttenteChoixClient'),
        p: t('consoleDevisEnvoye'),
        ball: 'client',
        badge: { label: t('consoleDevisTransmisAttente'), bg: '#EAF2FD', fg: '#2F7FD0' },
        prim: null,
      };
    }
    if (anyRecu || anyValide) {
      return {
        c: t('consoleDevisEnCours'),
        d9: t('consoleDevisAValider'),
        p: t('consoleDevisEnvoye'),
        ball: 'de9',
        badge: { label: t('consoleDevisAValider'), bg: '#FEF3E2', fg: '#D9871F' },
        prim: null,
      };
    }
    return {
      c: t('consoleDevisEnCours'),
      d9: t('consoleAttenteDevis'),
      p: t('consoleBriefRecuDevisAEnvoyer'),
      ball: 'pro',
      badge: { label: t('consoleAttenteDevis'), bg: '#FEF3E2', fg: '#D9871F' },
      prim: null,
    };
  }
  return null; // assigne → handled by occurrences
}

/** Current actionable occurrence (earliest non-terminal, by action priority). */
const OCC_ORDER: OccStatus[] = [
  'doneDisputed',
  'doneApproved',
  'doneInvoiced',
  'doneNoInvoice',
  'confirmed',
  'confirmedAssigned',
  'toConfirm',
  'added',
];

function currentOcc(cmd: Commande): Occurrence | null {
  let best: Occurrence | null = null;
  let bi = 99;
  cmd.occurrences.forEach((o) => {
    const i = OCC_ORDER.indexOf(o.status);
    if (i >= 0 && i < bi) {
      bi = i;
      best = o;
    }
  });
  return best;
}

const doneProj = (t: Tr): ProjVM => ({
  c: '—',
  d9: '—',
  p: '—',
  ball: 'done',
  badge: { label: t('commonTermine'), bg: '#F1F4F6', fg: '#9AA4B2' },
  prim: null,
});

/** Agir pour… panels — logic.ts buildAgir. */
interface AgirAction {
  label: string;
  kind: UiKind;
}

function buildAgir(cmd: Commande, occ: Occurrence | null, t: Tr) {
  let client: AgirAction[] = [];
  let pro: AgirAction[] = [];
  let de9: AgirAction[] = [];
  if (cmd.setup !== 'assigne') {
    if (cmd.setup === 'arappeler') de9 = [{ label: t('appelerClient'), kind: 'callClient' }];
    else if (cmd.setup === 'contacte') de9 = [{ label: t('consoleDemanderDevis'), kind: 'askQuotes' }];
    else if (cmd.setup === 'devis') pro = [{ label: t('saisirDevis'), kind: 'addQuote' }];
  } else if (occ) {
    const s = occ.status;
    if (s === 'added') de9 = [{ label: t('consoleAgirPlanifier'), kind: 'plan' }];
    if (s === 'toConfirm') client = [{ label: t('consoleConfirmerVisite'), kind: 'confirmVisit' }];
    if (s === 'confirmed') pro = [{ label: t('titleAssign'), kind: 'assign' }];
    if (s === 'confirmedAssigned') de9 = [{ label: t('consoleAgirMarquerRealisee'), kind: 'realize' }];
    if (s === 'doneNoInvoice') pro = [{ label: t('titleDeposit'), kind: 'deposit' }];
    if (s === 'doneInvoiced')
      client = [
        { label: t('fcApprouver'), kind: 'approve' },
        { label: t('fcContester'), kind: 'contest' },
      ];
    if (s === 'doneDisputed') de9 = [{ label: t('fcResoudre'), kind: 'resolve' }];
    if (s === 'doneApproved') de9 = [{ label: t('consoleAgirRegler'), kind: 'settle' }];
  }
  return [
    { key: 'client', title: t('consolePourClient'), color: '#2F7FD0', bg: '#F7FAFD', border: '#D8E6F5', actions: client },
    { key: 'pro', title: t('consolePourPrestataire'), color: '#2FA86A', bg: '#F6FBF8', border: '#D2EBDD', actions: pro },
    { key: 'de9', title: 'de9de9', color: '#E7464E', bg: '#FDF8F8', border: '#F3D9DB', actions: de9 },
  ];
}

// ===================== small view atoms =====================

function NumChip({ num }: { num: string }) {
  return (
    <span className="inline-flex min-w-[18px] flex-none items-center justify-center rounded-md bg-[#232838] px-[5px] py-[2px] text-[9.5px] font-extrabold leading-[1.4] tracking-[.02em] text-white">
      {num}
    </span>
  );
}

const CARD =
  'rounded-[20px] border border-de9-line bg-card px-6 py-[22px] shadow-[0_10px_30px_rgba(38,50,69,.06)]';

const CONTACT_LINK =
  'rounded-[10px] border-[1.5px] border-de9-line bg-card px-3 py-2 text-[11.5px] font-bold text-de9-slate no-underline';

// ===================== modal state =====================

type ModalState =
  | { type: 'approve'; occId: string }
  | { type: 'reprogram'; occId: string; date: string }
  | { type: 'assign'; occId: string; worker: string }
  | { type: 'choose'; quoteIdx: number }
  | { type: 'deposit'; occId: string; montant: number }
  | { type: 'viewFacture'; occId: string };

// ===================== page =====================

export function ConsolePage() {
  const { id = '' } = useParams<'id'>();
  const t = useT();
  const l = useL();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const roleView = useUiStore((s) => s.roleView);

  const { data: cmd, isPending, isError, error } = useCommande(id);
  const action = useCommandeAction(id);
  const devisAction = useDevisAction(id);

  const [auditOpen, setAuditOpen] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [doc, setDoc] = useState<DocState | null>(null);

  const errMsg = (err: unknown): string => (err instanceof Error ? err.message : l('Erreur', 'خطأ'));

  const runAction = (input: CommandeActionInput, msg: string): void => {
    action.mutate(input, {
      onSuccess: () => {
        toast.success(msg);
        setModal(null);
      },
      onError: (err) => toast.error(errMsg(err)),
    });
  };

  const runDevis = (input: DevisActionInput, msg: string | null): void => {
    devisAction.mutate(input, {
      onSuccess: () => {
        if (msg) toast.success(msg);
      },
      onError: (err) => toast.error(errMsg(err)),
    });
  };

  // ---- overlays that survive navigation (blueprint convention) ----
  const openClientFiche = (name: string): void => {
    if (!name || name === 'de9de9' || name === '—') return;
    const sp = new URLSearchParams(searchParams);
    sp.set('client', name);
    sp.delete('pres');
    setSearchParams(sp);
  };
  const openPresByName = (name: string): void => {
    if (!name || name === '—') return;
    const sp = new URLSearchParams(searchParams);
    sp.set('pres', name);
    sp.delete('client');
    setSearchParams(sp);
  };

  // ---- act dispatch (logic.ts act) ----
  const act = (kind: UiKind, occ: Occurrence | null): void => {
    if (!cmd) return;
    const occId = occ ? { occId: occ.id } : {};
    switch (kind) {
      case 'callClient':
        runAction({ kind: 'callClient' }, t('consoleToastClientContacte'));
        break;
      case 'askQuotes':
        navigate('/prestataires?ctx=' + cmd.id);
        break;
      case 'addQuote':
        runAction({ kind: 'addQuote' }, t('consoleToastDevisAjoute'));
        break;
      case 'gotoDevis': {
        const qi0 = cmd.quotes.findIndex((q) => q.chosen);
        setModal({ type: 'choose', quoteIdx: qi0 >= 0 ? qi0 : cmd.quotes.length ? 0 : -1 });
        break;
      }
      case 'plan':
        runAction({ kind: 'plan', ...occId }, t('consoleToastOccPlanifiee'));
        break;
      case 'confirmVisit':
        runAction({ kind: 'confirmVisit', ...occId }, t('consoleToastVisiteConfirmee'));
        break;
      case 'assign':
        if (occ) setModal({ type: 'assign', occId: occ.id, worker: occ.ouvrier ?? WORKERS[0] ?? '' });
        break;
      case 'realize':
        runAction({ kind: 'realize', ...occId }, t('consoleToastVisiteRealisee'));
        break;
      case 'deposit':
        if (occ) {
          const ch = cmd.quotes.find((q) => q.chosen);
          setModal({ type: 'deposit', occId: occ.id, montant: ch ? ch.montant : 15000 });
        }
        break;
      case 'approve':
        if (occ) setModal({ type: 'approve', occId: occ.id });
        break;
      case 'contest':
        runAction({ kind: 'contest', ...occId }, t('consoleToastFactureContestee'));
        break;
      case 'resolve':
        runAction({ kind: 'resolve', ...occId }, t('consoleToastLitigeResolu'));
        break;
      case 'settle':
        runAction({ kind: 'settle', ...occId }, t('consolePayeTransfere'));
        break;
      case 'reprogram':
        if (occ) setModal({ type: 'reprogram', occId: occ.id, date: toISO(occ.date) });
        break;
      case 'cancel':
        runAction({ kind: 'cancelOcc', ...occId }, t('consoleToastOccAnnulee'));
        break;
      case 'addOcc':
        runAction({ kind: 'addOcc' }, t('consoleToastOccAjoutee'));
        break;
      case 'viewFacture':
        if (occ) setModal({ type: 'viewFacture', occId: occ.id });
        break;
      case 'reviewPres':
        if (cmd.prestataire) openPresByName(cmd.prestataire.name);
        break;
    }
  };

  // ===================== loading / error =====================
  const backLink = (
    <div
      onClick={() => navigate('/commandes')}
      className="mb-4 inline-flex cursor-pointer items-center gap-2 text-[13px] font-bold text-de9-slate"
    >
      <span className="text-base">‹</span>
      {t('retourFile')}
    </div>
  );

  if (isPending) {
    return (
      <div className="mx-auto max-w-[980px]">
        {backLink}
        <div className="flex flex-col gap-4">
          <div className="h-[150px] animate-pulse rounded-[20px] bg-secondary" />
          <div className="h-[110px] animate-pulse rounded-[20px] bg-secondary" />
          <div className="h-[220px] animate-pulse rounded-[20px] bg-secondary" />
        </div>
      </div>
    );
  }

  if (isError || !cmd) {
    return (
      <div className="mx-auto max-w-[980px]">
        {backLink}
        <div className={cn(CARD, 'text-[13px] font-semibold text-de9-red')}>
          {isError ? errMsg(error) : t('aucuneCommande')}
        </div>
      </div>
    );
  }

  // ===================== console view-model (logic.ts buildConsole) =====================
  const stOcc = cmd.setup === 'assigne' ? currentOcc(cmd) : null;
  const stProj = cmd.setup !== 'assigne' ? setupProj(cmd, t) : stOcc ? occProj(stOcc, t) : null;
  const cur = stProj ?? doneProj(t);
  const bandNum = STATUS_NUM[stOcc ? stOcc.status : cmd.setup] ?? '';

  // 3-role band
  const bandDef: [Ball, string, string, string, string, string][] = [
    ['client', t('roleClient'), '#2F7FD0', '#EAF2FD', '#BFD9F2', cur.c],
    ['pro', t('rolePrestataire'), '#2FA86A', '#E7F6EE', '#BEE6CE', cur.p],
    ['de9', 'de9de9', '#E7464E', '#FDECEC', '#F6D2D4', cur.d9],
  ];
  const band = bandDef.map(([k, title, color, bg, border, label]) => {
    const active = cur.ball === k;
    const sel =
      roleView !== 'de9' &&
      ((roleView === 'client' && k === 'client') || (roleView === 'prestataire' && k === 'pro'));
    let bbg = active ? bg : '#F9FAFB';
    let bborder = active ? border : '#EDF1F3';
    let lcolor = active ? '#232838' : '#8A94A0';
    let ring = 'none';
    if (sel) {
      bbg = color + '1A';
      bborder = color;
      lcolor = '#232838';
      ring = '0 0 0 4px ' + color + '40';
    }
    return {
      title: sel ? '👁 ' + title : title,
      dot: color,
      titleColor: color,
      bg: bbg,
      border: bborder,
      labelColor: lcolor,
      label,
      ring,
    };
  });

  // prochaine action
  const prim = cur.prim;
  const proColor = prim ? BALL_COLOR[prim.role === 'pro' ? 'pro' : prim.role === 'client' ? 'client' : 'de9'] : '';
  const proBg = proColor === '#E7464E' ? '#FDF1F1' : proColor === '#2F7FD0' ? '#F0F6FD' : '#EDF8F1';
  const proSub = prim
    ? prim.role === 'de9'
      ? t('consoleActionDe9')
      : prim.role === 'client'
        ? t('consoleAuNomClient')
        : t('consoleAuNomPrestataire')
    : '';

  // header status
  const statusMap: Record<Commande['setup'], [string, string, string]> = {
    arappeler: [t('fSArappeler'), '#FDECEC', '#E7464E'],
    contacte: [t('consoleContacte'), '#FEF3E2', '#D9871F'],
    devis: [t('consoleStatutDevisEnCours'), '#FEF3E2', '#D9871F'],
    assigne: [t('fSActif'), '#E7F6EE', '#2FA86A'],
  };
  const sb = statusMap[cmd.setup];

  // devis (demande de devis détaillée)
  const dv = cmd.devis ?? [];
  const showDevis = dv.length > 0;
  const devisMeta: Record<string, [string, string, string, string]> = {
    attente: [t('commonEnAttente'), '#FEF3E2', '#D9871F', '#F0E2C0'],
    recu: [t('consoleBadgeDevisRecu'), '#EAF2FD', '#2F7FD0', '#BFD9F2'],
    valide: [t('commonValide'), '#E7F6EE', '#2FA86A', '#BEE6CE'],
    refuse: [t('commonRefuse'), '#FDECEC', '#E7464E', '#F6D2D4'],
  };
  const proposed = !!cmd.proposedToClient;
  const nAttente = dv.filter((d) => d.status === 'attente').length;
  const nRecu = dv.filter((d) => d.status === 'recu').length;
  const nValide = dv.filter((d) => d.status === 'valide').length;
  const canPropose = nValide > 0 && !proposed;
  const brief = cmd.brief;
  const briefBudget =
    brief && (brief.budgetMin || brief.budgetMax)
      ? (brief.budgetMin || '?') + ' – ' + (brief.budgetMax || '?') + ' ' + t('commonCreditsAbbr')
      : t('briefNonPrecise');
  const briefLoc = brief
    ? [brief.adresse, brief.commune, brief.wilaya].filter(Boolean).join(', ') || cmd.wilaya
    : cmd.wilaya;

  // audit
  const auditEntries = cmd.audit.map((e) => ({
    text:
      e.role !== 'sys' && e.role !== 'de9'
        ? t('consoleAuditPourCompteDe') +
          (e.role === 'client' ? t('commonRoleLeClient') : t('commonRoleLePrestataire')) +
          ' — ' +
          e.txt
        : e.txt,
    date: withDay(e.date, t),
    dot: BALL_COLOR[e.role === 'client' ? 'client' : e.role === 'pro' ? 'pro' : 'de9'],
  }));

  const agir = buildAgir(cmd, stOcc, t);

  const viewOcc = modal?.type === 'viewFacture' ? cmd.occurrences.find((o) => o.id === modal.occId) : undefined;
  const viewFact: ViewFactureVM | null = viewOcc
    ? (() => {
        const f = viewOcc.facture;
        const pj = occProj(viewOcc, t);
        const m = f?.montant ?? 0;
        return {
          dateLabel: withDay(viewOcc.date, t),
          fileName: f?.fileName ?? 'facture-' + viewOcc.id + '.pdf',
          montantLabel: fmt(m),
          proLabel: fmt(Math.round(m * 0.85)),
          margeLabel: fmt(Math.round(m * 0.15)),
          transfere: !!f?.transfere,
          statusLabel: pj.badge.label,
          statusBg: pj.badge.bg,
          statusFg: pj.badge.fg,
        };
      })()
    : null;

  const closeModal = (open: boolean): void => {
    if (!open) setModal(null);
  };

  return (
    <div className="mx-auto max-w-[980px]">
      {backLink}

      {/* ===== header ===== */}
      <div className={CARD}>
        <div className="flex flex-wrap items-start justify-between gap-[18px]">
          <div>
            <div className="flex flex-wrap items-center gap-[11px]">
              <div className="text-[21px] font-extrabold">
                <span
                  onClick={() => openClientFiche(cmd.client)}
                  className="cursor-pointer underline decoration-dotted decoration-[#C7CFD7] underline-offset-4"
                >
                  {cmd.client}
                </span>
              </div>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-[11px] py-[5px] text-[11.5px] font-bold"
                style={{ background: sb[1], color: sb[2] }}
              >
                <NumChip num={STATUS_NUM[cmd.setup] ?? ''} />
                {sb[0]}
              </span>
            </div>
            <div className="mt-[5px] text-[13px] text-de9-gray">
              {cmd.id} · {cmd.contact} · {cmd.service}
            </div>
            <div className="mt-[3px] flex items-center gap-1.5 text-[12.5px] text-de9-gray">
              {cmd.type === 'recurrent' ? '↻' : '•'} {cmd.pattern} · {cmd.wilaya}
            </div>
          </div>
          <div className="flex flex-none flex-wrap gap-2.5">
            <a
              href="tel:+213000000000"
              className="flex items-center gap-2 rounded-[13px] border-[1.5px] border-de9-line bg-card px-4 py-3 text-[13px] font-bold text-de9-slate no-underline"
            >
              <span className="text-[15px]">📞</span>
              {t('appelerClient')}
            </a>
            {cmd.prestataire && (
              <a
                href="tel:+213000000000"
                className="flex items-center gap-2 rounded-[13px] border-[1.5px] border-de9-line bg-card px-4 py-3 text-[13px] font-bold text-de9-slate no-underline"
              >
                <span className="text-[15px]">📞</span>
                {t('appelerPrestataire')}
              </a>
            )}
          </div>
        </div>

        {/* 3-role band */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {band.map((b, i) => (
            <div
              key={i}
              className="rounded-[14px] border-[1.5px] px-[15px] py-[13px]"
              style={{ borderColor: b.border, background: b.bg, boxShadow: b.ring }}
            >
              <div
                className="flex items-center gap-[7px] text-[11px] font-extrabold uppercase tracking-[.04em]"
                style={{ color: b.titleColor }}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: b.dot }} />
                {b.title}
              </div>
              <div className="mt-2 flex items-center gap-[7px]">
                <NumChip num={bandNum} />
                <span className="text-[13.5px] font-bold" style={{ color: b.labelColor }}>
                  {b.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== prochaine action ===== */}
      {prim && (
        <div
          className="mt-4 rounded-[20px] border-[1.8px] px-6 py-[22px]"
          style={{ background: proBg, borderColor: proColor + '55' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-[18px]">
            <div>
              <div
                className="flex items-center gap-[7px] text-[11px] font-extrabold uppercase tracking-[.08em]"
                style={{ color: proColor }}
              >
                <span className="text-[13px]">●</span>
                {t('prochaineAction')}
                <NumChip num={bandNum} />
              </div>
              <div className="mt-[7px] text-lg font-extrabold text-[#232838]">{prim.label}</div>
              <div className="mt-[3px] text-[12.5px] text-[#6B7280]">{proSub}</div>
            </div>
            <div
              onClick={() => act(prim.kind, stOcc)}
              className="flex max-w-full flex-none flex-wrap animate-pulse-ring cursor-pointer items-center rounded-[14px] px-6 py-[15px] text-[14.5px] font-bold text-white"
              style={{ background: proColor, boxShadow: '0 12px 26px ' + proColor + '55' }}
            >
              {prim.label}
              {prim.next && (
                <span className="ms-2 inline-flex items-center rounded-md bg-white/25 px-2 py-[2px] text-xs font-extrabold leading-[1.4] text-white">
                  → {STATUS_NUM[prim.next] ?? ''}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== devis — demande de devis détaillée ===== */}
      {showDevis && (
        <div className={cn(CARD, 'mt-4')}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-base font-extrabold">{t('devisSection')}</div>
            {!proposed && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F0E2C0] bg-[#FBF4E4] px-[11px] py-1.5 text-[11px] font-extrabold text-[#92702A] dark:border-[#92702A]/40 dark:bg-[#92702A]/15 dark:text-[#D9B36A]">
                🔒 {t('visibleAdmin')}
              </span>
            )}
            {proposed && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#BFD9F2] bg-[#EAF2FD] px-[11px] py-1.5 text-[11px] font-extrabold text-[#2F7FD0] dark:border-[#2F7FD0]/40 dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]">
                👁 {t('transmisClient')}
              </span>
            )}
          </div>
          <div className="mt-1 text-[12.5px] text-de9-gray">{t('devisHintNew')}</div>

          {/* brief recap */}
          {brief && (
            <div className="mt-3.5 rounded-[15px] border-[1.5px] border-de9-line bg-secondary px-[17px] py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-[11px]">
                  <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-[#232838] text-lg text-white">
                    📋
                  </div>
                  <div>
                    <div className="text-sm font-extrabold">
                      {t('briefTitle')} <span className="font-semibold text-[#B6BEC8]">· {brief.ref}</span>
                    </div>
                    <div className="text-[11.5px] text-de9-gray">
                      {t('envoyeLe')} {withDay(brief.sentAt, t)} · {dv.length} {t('prestatairesContactes')}
                    </div>
                  </div>
                </div>
                <div className="flex flex-none gap-2">
                  <div
                    onClick={() => setDoc({ kind: 'brief' })}
                    className="flex cursor-pointer items-center gap-1.5 rounded-[10px] border-[1.5px] border-de9-line bg-card px-[13px] py-[9px] text-xs font-bold text-de9-slate"
                  >
                    👁 {t('voir')}
                  </div>
                  <div
                    onClick={() => toast.success(t('docToastTelechargement'))}
                    className="flex cursor-pointer items-center gap-1.5 rounded-[10px] border-[1.5px] border-de9-line bg-card px-[13px] py-[9px] text-xs font-bold text-de9-slate"
                  >
                    ⤓ {t('telecharger')}
                  </div>
                </div>
              </div>
              <div className="mt-[13px] grid grid-cols-1 gap-x-3.5 gap-y-2.5 sm:grid-cols-2 md:grid-cols-3">
                {(
                  [
                    [t('bService'), brief.service || cmd.service],
                    [t('bSuperficie'), brief.superficie ? brief.superficie + ' m²' : '—'],
                    [t('bBudget'), briefBudget],
                    [t('bLoc'), briefLoc],
                    [t('bFreq'), brief.frequence || '—'],
                    [t('bPhotos'), '📷 ' + brief.photos.length + ' · 📎 ' + brief.docs.length],
                  ] as [string, string][]
                ).map(([lab, val], i) => (
                  <div key={i}>
                    <div className="text-[10px] font-extrabold uppercase tracking-[.03em] text-de9-gray">{lab}</div>
                    <div className="mt-[2px] text-[12.5px] font-semibold">{val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* status summary */}
          <div className="mt-3.5 flex flex-wrap items-center gap-[9px]">
            <span className="rounded-full bg-[#FEF3E2] px-3 py-1.5 text-[11.5px] font-bold text-[#D9871F] dark:bg-[#D9871F]/15 dark:text-[#E9A962]">
              ⏳ {nAttente} {t('enAttente')}
            </span>
            <span className="rounded-full bg-[#EAF2FD] px-3 py-1.5 text-[11.5px] font-bold text-[#2F7FD0] dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]">
              📨 {nRecu} {t('recus')}
            </span>
            <span className="rounded-full bg-[#E7F6EE] px-3 py-1.5 text-[11.5px] font-bold text-[#2FA86A] dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]">
              ✓ {nValide} {t('valides')}
            </span>
          </div>

          {/* prestataire devis list */}
          <div className="mt-3.5 flex flex-col gap-[11px]">
            {dv.map((d, i) => {
              const sm = devisMeta[d.status] ?? ['', '#F1F4F6', '#9AA4B2', '#EDF1F3'];
              const hasDevis = d.status === 'recu' || d.status === 'valide';
              const clientVisible = proposed && d.status === 'valide';
              return (
                <div
                  key={d.presId}
                  className="rounded-[14px] border-[1.5px] px-[17px] py-[15px]"
                  style={{ borderColor: d.status === 'attente' ? '#EDF1F3' : sm[3] }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        onClick={() => openPresByName(d.raison)}
                        className="cursor-pointer text-[14.5px] font-extrabold underline decoration-dotted decoration-[#C7CFD7] underline-offset-[3px]"
                      >
                        {d.raison}
                      </span>
                      <span
                        className="rounded-full px-2.5 py-1 text-[10.5px] font-extrabold"
                        style={{ background: sm[1], color: sm[2] }}
                      >
                        {sm[0]}
                      </span>
                      {clientVisible && (
                        <span className="rounded-full bg-[#EAF2FD] px-[9px] py-1 text-[10px] font-extrabold text-[#2F7FD0] dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]">
                          👁 {t('vuClient')}
                        </span>
                      )}
                    </div>
                    {hasDevis && (
                      <div className="text-end">
                        <div className="text-base font-extrabold">
                          {d.montant ? fmt(d.montant) : '—'}{' '}
                          <span className="text-[11px] font-semibold text-[#B0B8C2]">{t('credits')}</span>
                        </div>
                        <div className="text-[11px] text-de9-gray">⏱ {d.delai || '—'}</div>
                      </div>
                    )}
                  </div>

                  {hasDevis && (
                    <>
                      <div className="mt-2.5 text-[12.5px] leading-[1.5] text-de9-slate">{d.details}</div>
                      <div className="mt-[11px] flex items-center gap-[9px] rounded-[11px] bg-secondary px-[13px] py-2.5">
                        <span className="text-lg">📄</span>
                        <span className="flex-1 truncate text-xs font-semibold text-de9-slate">{d.docName}</span>
                        <div
                          onClick={() => setDoc({ kind: 'devis', presId: d.presId })}
                          className="cursor-pointer text-[11.5px] font-bold text-[#2F7FD0] dark:text-[#7EB5EC]"
                        >
                          👁 {t('voir')}
                        </div>
                        <div
                          onClick={() => toast.success(t('docToastTelechargement'))}
                          className="cursor-pointer text-[11.5px] font-bold text-de9-slate"
                        >
                          ⤓ {t('telecharger')}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <a href={'tel:+213' + d.phone.replace(/^0/, '')} className={CONTACT_LINK}>
                      📞 {t('tel')}
                    </a>
                    <a href={'https://wa.me/' + d.wa} target="_blank" rel="noreferrer" className={CONTACT_LINK}>
                      💬 WhatsApp
                    </a>
                    <a href={'mailto:' + d.email} className={CONTACT_LINK}>
                      ✉️ Email
                    </a>
                    <div className="flex-1" />
                    {d.status === 'attente' && (
                      <div
                        onClick={() =>
                          runDevis(
                            { action: 'simReceive', quoteIndex: i },
                            t('consoleToastDevisRecu').replace('{n}', d.raison),
                          )
                        }
                        className="cursor-pointer rounded-[10px] border-[1.5px] border-dashed border-de9-line bg-card px-[13px] py-2 text-[11.5px] font-bold text-de9-slate"
                      >
                        ⊕ {t('simReception')}
                      </div>
                    )}
                    {d.status === 'recu' && (
                      <>
                        <div
                          onClick={() =>
                            runDevis(
                              { action: 'refuse', quoteIndex: i },
                              t('consoleToastDevisRefuse').replace('{n}', d.raison),
                            )
                          }
                          className="cursor-pointer rounded-[10px] bg-[#FDECEC] px-3.5 py-[9px] text-[11.5px] font-bold text-de9-red dark:bg-[#E7464E]/15"
                        >
                          {t('refuser')}
                        </div>
                        <div
                          onClick={() =>
                            runDevis(
                              { action: 'valide', quoteIndex: i },
                              t('consoleToastDevisValide').replace('{n}', d.raison),
                            )
                          }
                          className="cursor-pointer rounded-[10px] bg-[#2FA86A] px-4 py-[9px] text-[11.5px] font-bold text-white shadow-[0_6px_14px_rgba(47,168,106,.35)]"
                        >
                          ✓ {t('valider')}
                        </div>
                      </>
                    )}
                    {d.status === 'valide' && (
                      <>
                        <div
                          onClick={() => runDevis({ action: 'devalider', quoteIndex: i }, null)}
                          className="cursor-pointer rounded-[10px] bg-secondary px-3.5 py-[9px] text-[11.5px] font-bold text-de9-slate"
                        >
                          ↺ {t('devalider')}
                        </div>
                        {proposed && (
                          <div
                            onClick={() =>
                              runDevis(
                                { action: 'choose', quoteIndex: i },
                                t('consoleToastPrestataireAssigneNom').replace('{n}', d.raison),
                              )
                            }
                            className="cursor-pointer rounded-[10px] bg-de9-teal px-4 py-[9px] text-[11.5px] font-bold text-white shadow-[0_6px_14px_rgba(101,203,196,.4)]"
                          >
                            {t('choisirNom')}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* propose footer */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-de9-line pt-4">
            <div className="min-w-[220px] flex-1 text-xs text-de9-gray">{t('proposeHint')}</div>
            {proposed && (
              <span className="rounded-xl border-[1.5px] border-[#BFD9F2] bg-[#EAF2FD] px-[18px] py-[11px] text-[12.5px] font-extrabold text-[#2F7FD0] dark:border-[#2F7FD0]/40 dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]">
                ✓ {t('transmisClient')}
              </span>
            )}
            {canPropose && (
              <div
                onClick={() => runDevis({ action: 'propose' }, t('consoleToastDevisTransmis'))}
                className="cursor-pointer rounded-[13px] bg-[#2F7FD0] px-[22px] py-[13px] text-[13px] font-bold text-white shadow-[0_10px_22px_rgba(47,127,208,.38)]"
              >
                {t('proposerClient')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== occurrences timeline ===== */}
      {cmd.setup === 'assigne' && (
        <div className={cn(CARD, 'mt-4')}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-base font-extrabold">
              {t('occurrences')} <span className="font-semibold text-[#B6BEC8]">· {cmd.occurrences.length}</span>
            </div>
            <div
              onClick={() => act('addOcc', null)}
              className="cursor-pointer rounded-[10px] bg-[#EAF2FD] px-3.5 py-[9px] text-[12.5px] font-bold text-[#2F7FD0] dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]"
            >
              + {t('ajouterOccurrence')}
            </div>
          </div>

          <div className="mt-4 flex flex-col">
            {cmd.occurrences.map((o) => {
              const p = occProj(o, t);
              const done = o.status === 'paid' || o.status === 'cancelled';
              const roleBadges = (
                [
                  [t('fClient'), p.c, '#2F7FD0', 'client'],
                  [t('consolePro'), p.p, '#2FA86A', 'pro'],
                  ['de9de9', p.d9, '#E7464E', 'de9'],
                ] as [string, string, string, Ball][]
              ).map(([title, label, color, key]) => {
                const active = p.ball === key;
                return {
                  title,
                  label,
                  titleColor: color,
                  bg: active ? color + '14' : '#F7F9FA',
                  border: active ? color + '40' : '#EDF1F3',
                  labelColor: active ? '#232838' : '#9AA4B2',
                };
              });

              const secondary: { label: string; kind: UiKind; cls: string }[] = [];
              if (['toConfirm', 'confirmed', 'confirmedAssigned', 'added'].includes(o.status)) {
                secondary.push({ label: t('consoleReprogrammer'), kind: 'reprogram', cls: 'text-de9-slate' });
                secondary.push({ label: t('annuler'), kind: 'cancel', cls: 'text-de9-red' });
              }
              if (o.status === 'doneInvoiced') {
                secondary.push({ label: t('fcContester'), kind: 'contest', cls: 'text-de9-red' });
              }
              if (o.facture)
                secondary.push({
                  label: t('voirFacture'),
                  kind: 'viewFacture',
                  cls: 'text-[#2F7FD0] dark:text-[#7EB5EC]',
                });
              if ((o.status === 'doneApproved' || o.status === 'paid') && cmd.prestataire) {
                secondary.push({
                  label: t('evaluerPrestataire'),
                  kind: 'reviewPres',
                  cls: 'text-[#7C57C7] dark:text-[#A98BE8]',
                });
              }

              const fact = o.facture;
              const prim2 = p.prim;
              const primColor = prim2
                ? BALL_COLOR[prim2.role === 'pro' ? 'pro' : prim2.role === 'client' ? 'client' : 'de9']
                : '#999';

              return (
                <div key={o.id} className="flex gap-3.5">
                  {/* rail */}
                  <div className="flex w-[18px] flex-none flex-col items-center">
                    <div
                      className="mt-1 h-3.5 w-3.5 rounded-full border-[3px] border-card"
                      style={{ background: done ? '#2FA86A' : BALL_COLOR[p.ball] }}
                    />
                    <div className="w-[2px] flex-1 bg-de9-line" />
                  </div>
                  {/* card */}
                  <div
                    className={cn(
                      'mb-3.5 flex-1 rounded-[15px] border-[1.5px] px-[17px] py-4',
                      o.status === 'doneDisputed'
                        ? 'border-[#F6D2D4] bg-[#FFF7F7] dark:border-[#E7464E]/40 dark:bg-[#E7464E]/10'
                        : 'border-de9-line bg-card',
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-[11px]">
                        <span className="text-[15px] font-extrabold">{withDay(o.date, t)}</span>
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-[11px] font-bold"
                          style={{ background: p.badge.bg, color: p.badge.fg }}
                        >
                          <NumChip num={STATUS_NUM[o.status] ?? ''} />
                          {p.badge.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-de9-gray">
                        <span>👷 {o.ouvrier ?? '—'}</span>
                        <span>
                          🧾 {fact ? fmt(fact.montant) + ' ' + t('commonCreditsAbbr') : t('consoleFactureAucune')}
                        </span>
                      </div>
                    </div>

                    {/* 3 role mini badges */}
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {roleBadges.map((rb, j) => (
                        <div
                          key={j}
                          className="rounded-[9px] border px-[9px] py-[7px]"
                          style={{ background: rb.bg, borderColor: rb.border }}
                        >
                          <div
                            className="text-[9.5px] font-extrabold uppercase tracking-[.03em]"
                            style={{ color: rb.titleColor }}
                          >
                            {rb.title}
                          </div>
                          <div
                            className="mt-[2px] text-[11.5px] font-semibold leading-[1.25]"
                            style={{ color: rb.labelColor }}
                          >
                            {rb.label}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* actions */}
                    <div className="mt-[13px] flex flex-wrap items-center gap-[9px]">
                      {prim2 && (
                        <div
                          onClick={() => act(prim2.kind, o)}
                          className="flex cursor-pointer items-center rounded-[11px] px-[17px] py-[11px] text-[12.5px] font-bold text-white"
                          style={{ background: primColor }}
                        >
                          {prim2.label}
                          {prim2.next && (
                            <span className="ms-[7px] inline-flex items-center rounded-md bg-white/25 px-[7px] py-[2px] text-[10.5px] font-extrabold leading-[1.4] text-white">
                              → {STATUS_NUM[prim2.next] ?? ''}
                            </span>
                          )}
                        </div>
                      )}
                      {secondary.map((s2, j) => (
                        <div
                          key={j}
                          onClick={() => act(s2.kind, o)}
                          className={cn('cursor-pointer rounded-[11px] bg-secondary px-3.5 py-2.5 text-xs font-bold', s2.cls)}
                        >
                          {s2.label}
                        </div>
                      ))}
                    </div>

                    {/* facture detail */}
                    {fact && (
                      <div className="mt-[13px] flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-de9-line pt-[13px]">
                        <div className="text-xs text-de9-slate">
                          {t('ventilation')} : <b>{fmt(fact.montant)}</b> {t('client')} →{' '}
                          <b className="text-[#2FA86A] dark:text-[#6FCF97]">{fmt(Math.round(fact.montant * 0.85))}</b> {t('pro')} ·{' '}
                          <b className="text-de9-red">{fmt(Math.round(fact.montant * 0.15))}</b> de9de9
                        </div>
                        {fact.transfere && (
                          <span className="rounded-full bg-[#2FA86A] px-[11px] py-[5px] text-[11px] font-extrabold text-white">
                            {t('transfere')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== agir pour ===== */}
      {cmd.setup === 'assigne' && (
        <div className={cn(CARD, 'mt-4')}>
          <div className="text-base font-extrabold">{t('agirPour')}</div>
          <div className="mt-1 text-[12.5px] text-de9-gray">{t('agirSub')}</div>
          <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {agir.map((g) => (
              <div
                key={g.key}
                className="rounded-[14px] border-[1.5px] p-3.5"
                style={{ borderColor: g.border, background: g.bg }}
              >
                <div
                  className="flex items-center gap-1.5 text-[11.5px] font-extrabold uppercase tracking-[.03em]"
                  style={{ color: g.color }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: g.color }} />
                  {g.title}
                </div>
                <div className="mt-[11px] flex flex-col gap-2">
                  {g.actions.map((a, j) => (
                    <div
                      key={j}
                      onClick={() => act(a.kind, stOcc)}
                      className="cursor-pointer rounded-[10px] border-[1.5px] bg-white px-[13px] py-[11px] text-center text-[12.5px] font-bold text-[#232838]"
                      style={{ borderColor: g.border }}
                    >
                      {a.label}
                    </div>
                  ))}
                  {g.actions.length === 0 && (
                    <div className="p-1.5 text-center text-[11.5px] text-[#B6BEC8]">{t('aucuneAction')}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== journal d'audit ===== */}
      <div className="mt-4 rounded-[20px] border border-de9-line bg-card px-6 py-1.5 shadow-[0_10px_30px_rgba(38,50,69,.06)]">
        <div onClick={() => setAuditOpen((v) => !v)} className="flex cursor-pointer items-center justify-between py-4">
          <div className="text-[15px] font-extrabold">
            {t('journalAudit')} <span className="font-semibold text-[#B6BEC8]">· {cmd.audit.length}</span>
          </div>
          <span className={cn('text-[13px] text-de9-gray transition-transform', auditOpen && 'rotate-180')}>▾</span>
        </div>
        {auditOpen && (
          <div className="flex flex-col gap-2.5 pb-[18px]">
            {auditEntries.map((e, i) => (
              <div key={i} className="flex items-start gap-[11px]">
                <div className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ background: e.dot }} />
                <div className="flex-1">
                  <div className="text-[13px] leading-[1.45] text-de9-ink">{e.text}</div>
                  <div className="mt-[1px] text-[11px] text-[#B0B8C2]">{e.date}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== modal suite ===== */}
      {modal?.type === 'approve' && (
        <ApproveModal
          open
          onOpenChange={closeModal}
          pending={action.isPending}
          onConfirm={() => runAction({ kind: 'approve', occId: modal.occId }, t('consoleToastFactureApprouvee'))}
        />
      )}
      {modal?.type === 'reprogram' && (
        <ReprogramModal
          open
          onOpenChange={closeModal}
          defaultDate={modal.date}
          onSubmit={async (v) => {
            try {
              await action.mutateAsync({ kind: 'reprogram', occId: modal.occId, date: v.date, time: v.time });
              toast.success(t('consoleToastReprogrammee').replace('{n}', fromISO(v.date)));
              setModal(null);
            } catch (err) {
              toast.error(errMsg(err));
            }
          }}
        />
      )}
      {modal?.type === 'assign' && (
        <AssignModal
          open
          onOpenChange={closeModal}
          workers={WORKERS}
          initialWorker={modal.worker}
          pending={action.isPending}
          onConfirm={(w) =>
            runAction(
              { kind: 'assign', occId: modal.occId, worker: w },
              t('consoleToastOuvrierAffecte').replace('{n}', w),
            )
          }
        />
      )}
      {modal?.type === 'choose' && (
        <ChooseModal
          open
          onOpenChange={closeModal}
          quotes={cmd.quotes.map((q) => ({
            raison: q.raison,
            montantLabel: fmt(q.montant),
            delai: q.delai,
            note: q.note,
          }))}
          defaultIndex={modal.quoteIdx}
          pending={action.isPending}
          onConfirm={(qi) => runAction({ kind: 'choose', quoteIndex: qi }, t('consoleToastPrestataireAssigne'))}
        />
      )}
      {modal?.type === 'deposit' && (
        <DepositModal
          open
          onOpenChange={closeModal}
          defaultMontant={modal.montant}
          onSubmit={async (v) => {
            try {
              await action.mutateAsync({
                kind: 'deposit',
                occId: modal.occId,
                montant: v.montant,
                fileName: v.fileName || 'facture-' + modal.occId + '.pdf',
                note: v.note,
              });
              toast.success(t('consoleToastFactureDeposee'));
              setModal(null);
            } catch (err) {
              toast.error(errMsg(err));
            }
          }}
        />
      )}
      {viewFact && <ViewFactureModal open onOpenChange={closeModal} fact={viewFact} />}

      <DocViewer
        commande={cmd}
        doc={doc}
        onOpenChange={(open) => {
          if (!open) setDoc(null);
        }}
      />
    </div>
  );
}
