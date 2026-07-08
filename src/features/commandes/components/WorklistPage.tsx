// COMMANDES — worklist page. Visual ground truth: src/admin/views/Worklist.tsx;
// behavioral ground truth: the worklist section of src/admin/logic.ts renderVals()
// (urgency ranking, KPI counts, status → label/color mapping, filters).
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useT, type TKey } from '@/lib/i18n';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCommandes } from '../api/commandes';
import type { Ball, Commande, Occurrence, OccStatus } from '../schemas/commande';
import { NotesModal } from './NotesModal';

type Tr = (key: TKey) => string;

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

interface Proj {
  ball: Ball;
  badgeKey: TKey;
  badgeBg: string;
  badgeFg: string;
}

const OCC_PROJ: Record<OccStatus, Proj> = {
  added: { ball: 'de9', badgeKey: 'consoleBadgeAPlanifier', badgeBg: '#FBF4E4', badgeFg: '#B68A2E' },
  toConfirm: { ball: 'client', badgeKey: 'consoleBadgeAConfirmer', badgeBg: '#EAF2FD', badgeFg: '#2F7FD0' },
  confirmed: { ball: 'pro', badgeKey: 'consoleBadgeConfirmee', badgeBg: '#E7F6EE', badgeFg: '#2FA86A' },
  confirmedAssigned: { ball: 'de9', badgeKey: 'consoleBadgeOuvrierAffecte', badgeBg: '#E7F6EE', badgeFg: '#2FA86A' },
  doneNoInvoice: { ball: 'pro', badgeKey: 'consoleBadgeRealiseeSansFacture', badgeBg: '#F4EFFB', badgeFg: '#7C57C7' },
  doneInvoiced: { ball: 'client', badgeKey: 'consoleBadgeFactureDeposee', badgeBg: '#F4EFFB', badgeFg: '#7C57C7' },
  doneDisputed: { ball: 'de9', badgeKey: 'consoleBadgeContestee', badgeBg: '#FDECEC', badgeFg: '#E7464E' },
  doneApproved: { ball: 'de9', badgeKey: 'consoleBadgeApprouvee', badgeBg: '#E7F6EE', badgeFg: '#2FA86A' },
  paid: { ball: 'done', badgeKey: 'consoleBadgePayee', badgeBg: '#E7F6EE', badgeFg: '#2FA86A' },
  cancelled: { ball: 'done', badgeKey: 'consoleBadgeAnnulee', badgeBg: '#F1F4F6', badgeFg: '#9AA4B2' },
};

const DONE_PROJ: Proj = { ball: 'done', badgeKey: 'commonTermine', badgeBg: '#F1F4F6', badgeFg: '#9AA4B2' };

function setupProj(cmd: Commande): Proj | null {
  if (cmd.setup === 'arappeler') {
    return { ball: 'de9', badgeKey: 'fSArappeler', badgeBg: '#FDECEC', badgeFg: '#E7464E' };
  }
  if (cmd.setup === 'contacte') {
    return { ball: 'de9', badgeKey: 'consoleDevisADemander', badgeBg: '#FEF3E2', badgeFg: '#D9871F' };
  }
  if (cmd.setup === 'devis') {
    const dv = cmd.devis ?? [];
    const anyRecu = dv.some((d) => d.status === 'recu');
    const anyValide = dv.some((d) => d.status === 'valide');
    if (cmd.proposedToClient && anyValide) {
      return { ball: 'client', badgeKey: 'consoleDevisTransmisAttente', badgeBg: '#EAF2FD', badgeFg: '#2F7FD0' };
    }
    if (anyRecu || anyValide) {
      return { ball: 'de9', badgeKey: 'consoleDevisAValider', badgeBg: '#FEF3E2', badgeFg: '#D9871F' };
    }
    return { ball: 'pro', badgeKey: 'consoleAttenteDevis', badgeBg: '#FEF3E2', badgeFg: '#D9871F' };
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

interface CmdState {
  kind: 'setup' | 'occ' | 'done';
  proj: Proj | null;
  occ: Occurrence | null;
}

function cmdState(cmd: Commande): CmdState {
  if (cmd.setup !== 'assigne') return { kind: 'setup', proj: setupProj(cmd), occ: null };
  const o = currentOcc(cmd);
  if (!o) return { kind: 'done', proj: null, occ: null };
  return { kind: 'occ', proj: OCC_PROJ[o.status], occ: o };
}

function urgencyRank(cmd: Commande): number {
  const st = cmdState(cmd);
  if (cmd.setup === 'arappeler') return cmd.sla.mins < 0 ? -1 : 0;
  if (st.kind === 'done') return 9;
  const ball: Ball = st.proj ? st.proj.ball : 'done';
  const k = st.occ ? st.occ.status : cmd.setup;
  if (k === 'doneDisputed') return 1;
  if (k === 'doneApproved') return 2;
  if (cmd.setup === 'contacte') return 3;
  if (k === 'added') return 4;
  return ball === 'de9' ? 5 : 6;
}

type StatutKey = 'arappeler' | 'devis' | 'litige' | 'regler' | 'actif';

function statutKey(c: Commande): StatutKey {
  if (c.setup === 'arappeler') return 'arappeler';
  if (c.setup === 'contacte' || c.setup === 'devis') return 'devis';
  if (c.occurrences.some((o) => o.status === 'doneDisputed')) return 'litige';
  if (c.occurrences.some((o) => o.status === 'doneApproved')) return 'regler';
  return 'actif';
}

const BALL_COLOR: Record<Ball, string> = {
  client: '#2F7FD0',
  pro: '#2FA86A',
  de9: '#E7464E',
  done: '#9AA4B2',
};

function ballLabel(ball: Ball, t: Tr): string {
  if (ball === 'client') return t('roleClient');
  if (ball === 'pro') return t('rolePrestataire');
  if (ball === 'de9') return 'de9de9';
  return t('commonTermine');
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

// ===================== filters =====================

interface WorklistFilter {
  needsAction: boolean;
  type: 'all' | 'recurrent' | 'ponctuel';
  prestataire: string;
  wilaya: string;
  commune: string;
  client: string;
  balle: string;
  statut: string;
  search: string;
}

const INITIAL_FILTER: WorklistFilter = {
  needsAction: false,
  type: 'all',
  prestataire: 'all',
  wilaya: 'all',
  commune: 'all',
  client: 'all',
  balle: 'all',
  statut: 'all',
  search: '',
};

type SelectField = 'prestataire' | 'wilaya' | 'commune' | 'client' | 'balle' | 'statut';

function applyFilters(cmds: Commande[], f: WorklistFilter): Commande[] {
  let list = cmds.slice().sort((a, b) => urgencyRank(a) - urgencyRank(b));
  if (f.type !== 'all') list = list.filter((c) => c.type === f.type);
  if (f.needsAction) {
    list = list.filter((c) => {
      const s = cmdState(c);
      return s.proj !== null && s.proj.ball === 'de9';
    });
  }
  if (f.prestataire !== 'all') list = list.filter((c) => (c.prestataire ? c.prestataire.name : '—') === f.prestataire);
  if (f.wilaya !== 'all') list = list.filter((c) => c.wilaya === f.wilaya);
  if (f.commune !== 'all') list = list.filter((c) => c.commune === f.commune);
  if (f.client !== 'all') list = list.filter((c) => c.client === f.client);
  if (f.balle !== 'all') {
    list = list.filter((c) => {
      const s = cmdState(c);
      return (s.proj ? s.proj.ball : 'done') === f.balle;
    });
  }
  if (f.statut !== 'all') list = list.filter((c) => statutKey(c) === f.statut);
  if (f.search.trim()) {
    const s = f.search.trim().toLowerCase();
    list = list.filter((c) => {
      const pres = c.prestataire ? c.prestataire.name.toLowerCase() : '';
      const presEmail = c.prestataire?.email?.toLowerCase() ?? '';
      const cEmail = c.clientEmail.toLowerCase();
      return (
        c.id.toLowerCase().includes(s) ||
        c.client.toLowerCase().includes(s) ||
        pres.includes(s) ||
        cEmail.includes(s) ||
        presEmail.includes(s)
      );
    });
  }
  return list;
}

const uniq = (arr: string[]): string[] => [...new Set(arr)];
const alpha = (arr: string[]): string[] => uniq(arr).sort((a, b) => a.localeCompare(b, 'fr'));

// ===================== page =====================

const ROW_GRID = 'grid min-w-[960px] grid-cols-[1.8fr_1.4fr_1.7fr_0.9fr_1.2fr_0.95fr_0.85fr_0.55fr] gap-3.5 px-[22px]';

export function WorklistPage() {
  const t = useT();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const roleView = useUiStore((s) => s.roleView);
  const { data: cmds, isPending, isError, error } = useCommandes();

  const [filter, setFilter] = useState<WorklistFilter>(INITIAL_FILTER);
  const [handled, setHandled] = useState<Record<string, boolean>>({});
  const [notesFor, setNotesFor] = useState<string | null>(null);

  const list = useMemo(() => applyFilters(cmds ?? [], filter), [cmds, filter]);

  // ===== KPIs (counts over the full dataset, not the filtered list) =====
  const all = cmds ?? [];
  const cntRappel = all.filter((c) => c.setup === 'arappeler').length;
  const cntLitige = all.filter((c) => c.occurrences.some((o) => o.status === 'doneDisputed')).length;
  const cntRegler = all.filter((c) => c.occurrences.some((o) => o.status === 'doneApproved')).length;
  const cntActives = all.filter(
    (c) => c.setup === 'assigne' && c.occurrences.some((o) => o.status !== 'paid' && o.status !== 'cancelled'),
  ).length;
  const kpis: { key: string; label: string; value: number; color: string; border: string }[] = [
    { key: 'rappeler', label: t('fSArappeler'), value: cntRappel, color: '#E7464E', border: cntRappel ? '#F6D2D4' : '#EDF1F3' },
    { key: 'litige', label: t('worklistKpiLitiges'), value: cntLitige, color: '#E7464E', border: '#EDF1F3' },
    { key: 'regler', label: t('worklistKpiFacturesARegler'), value: cntRegler, color: '#2FA86A', border: '#EDF1F3' },
    { key: 'actives', label: t('worklistKpiCommandesActives'), value: cntActives, color: '#2F7FD0', border: '#EDF1F3' },
  ];

  const kpiFilter = (key: string): void => {
    setFilter((f) => ({ ...f, needsAction: key === 'rappeler' || key === 'litige' || key === 'regler' }));
  };

  // ===== filter chips =====
  const filterChips: { key: string; val: WorklistFilter['type'] | ''; label: string; icon: string; active: boolean }[] = [
    { key: 'needsAction', val: '', label: t('worklistNecessiteDe9'), icon: '◆', active: filter.needsAction },
    { key: 'type', val: 'all', label: t('tous'), icon: '≡', active: filter.type === 'all' },
    { key: 'type', val: 'recurrent', label: t('commonRecurrent'), icon: '↻', active: filter.type === 'recurrent' },
    { key: 'type', val: 'ponctuel', label: t('commonPonctuel'), icon: '•', active: filter.type === 'ponctuel' },
  ];

  const toggleChip = (key: string, val: WorklistFilter['type'] | ''): void => {
    if (key === 'needsAction') setFilter((f) => ({ ...f, needsAction: !f.needsAction }));
    else if (val !== '') setFilter((f) => ({ ...f, type: val }));
  };

  // ===== select filters =====
  const communeOpts = alpha(
    (filter.wilaya === 'all' ? all : all.filter((c) => c.wilaya === filter.wilaya)).map((c) => c.commune),
  );
  const mkSelect = (
    field: SelectField,
    label: string,
    opts: (string | [string, string])[],
  ): { field: SelectField; value: string; options: { v: string; l: string }[] } => ({
    field,
    value: filter[field],
    options: [{ v: 'all', l: label + ' : ' + t('tous') }].concat(
      opts.map((o) => (Array.isArray(o) ? { v: o[0], l: o[1] } : { v: o, l: o })),
    ),
  });
  const selects = [
    mkSelect('prestataire', t('fPrestataire'), alpha(all.filter((c) => c.prestataire).map((c) => c.prestataire?.name ?? ''))),
    mkSelect('wilaya', t('fWilaya'), alpha(all.map((c) => c.wilaya))),
    mkSelect('commune', t('fCommune'), communeOpts),
    mkSelect('client', t('fClient'), alpha(all.map((c) => c.client))),
    mkSelect('balle', t('fBalle'), [['de9', 'de9de9'], ['client', t('fClient')], ['pro', t('fPrestataire')]]),
    mkSelect('statut', t('fStatut'), [
      ['arappeler', t('fSArappeler')],
      ['devis', t('fSDevis')],
      ['litige', t('fSLitige')],
      ['regler', t('fSRegler')],
      ['actif', t('fSActif')],
    ]),
  ];

  const setFilterField = (field: SelectField, value: string): void => {
    setFilter((f) => {
      const nf = { ...f, [field]: value };
      if (field === 'wilaya') nf.commune = 'all';
      return nf;
    });
  };

  // ===== overlay params (prestataire profile / client fiche survive navigation) =====
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

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[23px] font-extrabold">{t('fileTravail')}</div>
          <div className="mt-[2px] text-[13.5px] text-de9-gray">{t('fileSub')}</div>
        </div>
      </div>

      {/* KPI banner */}
      <div className="mt-[18px] grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.key}
            onClick={() => kpiFilter(k.key)}
            className={cn(
              'cursor-pointer rounded-2xl border-[1.5px] bg-card px-[17px] py-[15px] shadow-[0_6px_18px_rgba(38,50,69,.04)]',
              k.border === '#F6D2D4' ? 'border-[#F6D2D4] dark:border-[#E7464E]/40' : 'border-de9-line',
            )}
          >
            <div className="flex items-center gap-2">
              <div className="h-[9px] w-[9px] rounded-full" style={{ background: k.color }} />
              <div className="text-[12.5px] font-semibold text-de9-gray">{k.label}</div>
            </div>
            <div className="mt-2 text-[28px] font-extrabold" style={{ color: k.color }}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="mt-[18px] flex flex-wrap items-center gap-2.5">
        {filterChips.map((f, i) => (
          <div
            key={i}
            onClick={() => toggleChip(f.key, f.val)}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-[15px] py-[9px] text-[12.5px] font-bold',
              f.active ? 'border-[#232838] bg-[#232838] text-white' : 'border-de9-line bg-card text-de9-slate',
            )}
          >
            <span className="text-[13px]">{f.icon}</span>
            {f.label}
          </div>
        ))}
      </div>

      {/* Select filters + search */}
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <Input
          value={filter.search}
          onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
          placeholder={t('rechercher')}
          className="h-auto w-auto min-w-0 flex-1 rounded-[11px] border-[1.5px] border-de9-line bg-card px-3.5 py-2.5 text-[13px] text-de9-ink shadow-none outline-none sm:flex-[0_0_250px] md:text-[13px]"
        />
        {selects.map((sel) => (
          <Select key={sel.field} value={sel.value} onValueChange={(v) => setFilterField(sel.field, v)}>
            <SelectTrigger className="h-auto w-full cursor-pointer gap-1.5 rounded-[11px] border-[1.5px] border-de9-line bg-card px-[13px] py-2.5 text-[12.5px] font-semibold text-de9-slate shadow-none sm:w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sel.options.map((op) => (
                <SelectItem key={op.v} value={op.v} className="text-[12.5px] font-semibold text-de9-slate">
                  {op.l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>

      {/* Rows table */}
      <div className="mt-4 overflow-hidden rounded-[18px] border border-de9-line bg-card shadow-[0_10px_30px_rgba(38,50,69,.06)]">
        <div className="overflow-x-auto">
        <div
          className={cn(
            ROW_GRID,
            'border-b border-de9-line bg-secondary py-3.5 text-[11px] font-bold uppercase tracking-[.05em] text-de9-gray',
          )}
        >
          <div>{t('colCommande')}</div>
          <div>{t('colService')}</div>
          <div>{t('colProchaine')}</div>
          <div>{t('colBalle')}</div>
          <div>{t('colPrestataire')}</div>
          <div>{t('colSla')}</div>
          <div>{t('colTraite')}</div>
          <div>{t('colNote')}</div>
        </div>

        {isPending && (
          <div className="flex flex-col gap-3 p-[22px]">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[46px] animate-pulse rounded-xl bg-secondary" />
            ))}
          </div>
        )}
        {isError && (
          <div className="p-[22px] text-[13px] font-semibold text-de9-red">
            {error instanceof Error ? error.message : 'Erreur de chargement'}
          </div>
        )}

        {!isPending &&
          !isError &&
          list.map((c) => {
            const s = cmdState(c);
            const proj = s.proj ?? DONE_PROJ;
            const lastOcc = c.occurrences[c.occurrences.length - 1];
            const nextNum =
              STATUS_NUM[s.occ ? s.occ.status : s.kind === 'done' ? (lastOcc?.status ?? 'paid') : c.setup] ?? '';
            const overdue = c.setup === 'arappeler' && c.sla.mins < 0;
            let slaLabel = '—';
            let slaSub = '';
            let slaClass = 'text-de9-gray';
            if (c.setup === 'arappeler') {
              slaLabel = overdue
                ? t('worklistRetardMin').replace('{n}', String(Math.abs(c.sla.mins)))
                : c.sla.mins + ' min';
              slaClass = overdue ? 'text-[#E7464E] dark:text-[#F2848A]' : 'text-[#D9871F] dark:text-[#EBA24E]';
              slaSub = t('worklistSlaRappel');
            } else if (s.occ) {
              slaLabel = withDay(s.occ.date, t);
              slaSub = t('worklistProchaineVisite');
              slaClass = 'text-de9-slate';
            }
            const isHandled = !!handled[c.id];
            const noteCount = c.notes.length;
            const ballColor = BALL_COLOR[proj.ball];
            const ballRing =
              roleView !== 'de9' &&
              ((roleView === 'client' && proj.ball === 'client') ||
                (roleView === 'prestataire' && proj.ball === 'pro'))
                ? `0 0 0 4px ${ballColor}66`
                : 'none';
            const presName = c.prestataire ? c.prestataire.name : '—';

            return (
              <div
                key={c.id}
                onClick={() => navigate('/commandes/' + c.id)}
                className={cn(
                  ROW_GRID,
                  'cursor-pointer items-center border-b border-de9-line py-4 hover:bg-de9-row',
                  overdue && 'bg-[#FFF7F7] hover:bg-[#FFF7F7] dark:bg-[#E7464E]/10 dark:hover:bg-[#E7464E]/10',
                )}
              >
                <div>
                  <div className="text-[14.5px] font-bold">
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        openClientFiche(c.client);
                      }}
                      className="cursor-pointer underline decoration-dotted decoration-[#C7CFD7] underline-offset-[3px]"
                    >
                      {c.client}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-de9-gray">
                    {c.id} · {c.contact}
                  </div>
                </div>
                <div>
                  <div className="text-[13.5px] font-semibold">{c.service}</div>
                  <div className="flex items-center gap-[5px] text-[11.5px] text-de9-gray">
                    {c.type === 'recurrent' ? '↻' : '•'}{' '}
                    {c.type === 'recurrent' ? t('commonRecurrent') : t('commonPonctuel')} · {c.wilaya}
                  </div>
                </div>
                <div>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-[11px] py-1.5 text-xs font-bold"
                    style={{ background: proj.badgeBg, color: proj.badgeFg }}
                  >
                    <span className="inline-flex min-w-[18px] flex-none items-center justify-center rounded-md bg-[#232838] px-[5px] py-[2px] text-[9.5px] font-extrabold leading-[1.4] tracking-[.02em] text-white">
                      {nextNum}
                    </span>
                    {t(proj.badgeKey)}
                  </span>
                </div>
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: ballColor }}>
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: ballColor, boxShadow: ballRing }}
                    />
                    {ballLabel(proj.ball, t)}
                  </span>
                </div>
                <div className={cn('text-[13px] font-semibold', c.prestataire ? 'text-de9-ink' : 'text-[#C0C8D0]')}>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      openPresByName(presName);
                    }}
                    className="cursor-pointer underline decoration-dotted decoration-[#C7CFD7] underline-offset-[3px]"
                  >
                    {presName}
                  </span>
                </div>
                <div>
                  <div className={cn('text-[13px] font-bold', slaClass)}>{slaLabel}</div>
                  <div className="text-[11px] text-[#B0B8C2]">{slaSub}</div>
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setHandled((h) => ({ ...h, [c.id]: !h[c.id] }));
                  }}
                  className="flex cursor-pointer items-center gap-[7px]"
                >
                  <div
                    className={cn(
                      'flex h-5 w-5 flex-none items-center justify-center rounded-md border-[1.8px] text-xs text-white',
                      isHandled ? 'border-[#2FA86A] bg-[#2FA86A]' : 'border-[#D7DEE4] bg-card dark:border-[#3A4459]',
                    )}
                  >
                    {isHandled ? '✓' : ''}
                  </div>
                  <span
                    className={cn(
                      'text-[11.5px] font-bold',
                      isHandled ? 'text-[#2FA86A] dark:text-[#6FCF97]' : 'text-de9-gray',
                    )}
                  >
                    {isHandled ? t('worklistTraite') : t('worklistAFaire')}
                  </span>
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setNotesFor(c.id);
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-[5px] text-[13px] font-bold',
                    noteCount ? 'text-[#7C57C7] dark:text-[#A98BE8]' : 'text-[#C0C8D0]',
                  )}
                >
                  <span className="text-base">💬</span>
                  {noteCount}
                </div>
              </div>
            );
          })}

        {!isPending && !isError && list.length === 0 && (
          <div className="p-[50px] text-center text-sm text-de9-gray">{t('aucuneCommande')}</div>
        )}
        </div>
      </div>

      <NotesModal
        commandeId={notesFor}
        open={notesFor !== null}
        onOpenChange={(open) => {
          if (!open) setNotesFor(null);
        }}
      />
    </div>
  );
}
