// FACTURES — console board on the /factures/console API family:
//   list          GET  /factures/console
//   cards         GET  /factures/console/kpis      (replaces five PageSize=1 counts)
//   tabs, lists   GET  /factures/console/filtres
//   « Voir »      GET  /factures/console/{invoiceId}
//   files         GET  …/telecharger[?inline=true] · POST …/fichiers
//   actions       POST …/{approuver|contester|resoudre-litige|regler}
// Every action answers the fresh detail and refreshes ['factures'], ['credits']
// and ['commandes']; the old POST /commandes/{cmdId}/actions is abandoned.
// Visual ground truth: logic.ts buildFactures.
import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useT, useL, type TKey } from '@/lib/i18n';
import { useLangStore, type Lang } from '@/stores/langStore';
import { queryClient } from '@/lib/queryClient';
import { problemMessage } from '@/api/problem';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  downloadFactureFile,
  previewFactureFile,
  useAjouterFichiersFacture,
  useFactureConsoleAction,
  useFactureDetail,
  useFacturesConsole,
  useFacturesFiltres,
  useFacturesKpis,
  type FactureConsoleActionInput,
} from '../api/factures';
import type {
  FactureConsoleItem,
  FactureConsoleParams,
  FactureDetailStatus,
  FactureKpis,
  FactureStatus,
} from '../schemas/facture';

// ===================== status + action metadata =====================

type Group = 'attente' | 'litige' | 'regler' | 'paid';
type FilterKey = 'all' | Group;
type ActionCode = FactureConsoleActionInput['code'];

interface StatusMeta {
  labelKey: TKey;
  num: string; // fallback badge when the row carries no `code`
  pill: string;
  dot: string;
  /** Row shortcuts. « Voir » renders its buttons from the server's `actions`. */
  actions: ActionCode[];
}

const STATUS_META: Record<FactureStatus, StatusMeta> = {
  doneInvoiced: {
    labelKey: 'fcReçue',
    num: 'V5',
    pill: 'bg-[#FEF6E9] text-[#C98A1E]',
    dot: 'bg-[#E6A53A]',
    actions: ['approuver', 'contester'],
  },
  doneDisputed: {
    labelKey: 'fcContestee',
    num: 'V5·C',
    pill: 'bg-[#FDECEC] text-de9-red',
    dot: 'bg-de9-red',
    actions: ['resoudre-litige'],
  },
  doneApproved: {
    labelKey: 'fcApprouvee',
    num: 'V6',
    pill: 'bg-[#E6F6EC] text-[#2E9E5B]',
    dot: 'bg-[#2E9E5B]',
    actions: ['regler'],
  },
  paid: {
    labelKey: 'fcPayee',
    num: 'V7',
    pill: 'bg-[#EEF1F4] text-[#6B7280]',
    dot: 'bg-[#9AA4B2]',
    actions: [],
  },
};

/** A detail can be cancelled; the list never is. */
const DETAIL_PILL: Record<FactureDetailStatus, string> = {
  doneInvoiced: 'bg-[#FEF6E9] text-[#C98A1E]',
  doneDisputed: 'bg-[#FDECEC] text-de9-red',
  doneApproved: 'bg-[#E6F6EC] text-[#2E9E5B]',
  paid: 'bg-[#EEF1F4] text-[#6B7280]',
  cancelled: 'bg-[#EEF1F4] text-[#9AA4B2]',
};

/** Tab → the `statut` value (the API accepts either vocabulary). */
const GROUP_STATUS: Record<Group, FactureStatus> = {
  attente: 'doneInvoiced',
  litige: 'doneDisputed',
  regler: 'doneApproved',
  paid: 'paid',
};

/** What each confirmation asks for. The server's `champ` wins when « Voir » sends one. */
const ACTION_FIELD: Record<ActionCode, { champ: string; required: boolean }> = {
  approuver: { champ: 'note', required: false },
  contester: { champ: 'motif', required: true },
  'resoudre-litige': { champ: 'resolution', required: true },
  regler: { champ: 'reference', required: false },
};

const CHAMP_LABEL: Record<string, TKey> = {
  note: 'fcChampNote',
  motif: 'fcChampMotif',
  resolution: 'fcChampResolution',
  reference: 'fcChampReference',
};

const ACTION_TITLE: Record<ActionCode, TKey> = {
  approuver: 'fcApprouver',
  contester: 'fcContester',
  'resoudre-litige': 'fcResoudre',
  regler: 'fcRegler',
};

const ACTION_INFO: Record<ActionCode, TKey> = {
  approuver: 'modalBody',
  contester: 'fcInfoContester',
  'resoudre-litige': 'fcInfoResoudre',
  regler: 'fcInfoRegler',
};

const ACTION_ICON: Record<ActionCode, string> = {
  approuver: '⚖️',
  contester: '⚠️',
  'resoudre-litige': '🤝',
  regler: '💸',
};

const ACTION_CLS: Record<ActionCode, string> = {
  approuver: 'border-[#2E9E5B] bg-[#2E9E5B] text-white',
  contester: 'border-[#F3C9CB] bg-white text-de9-red dark:border-[#E7464E]/40 dark:bg-[#E7464E]/15',
  'resoudre-litige': 'border-[#232838] bg-[#232838] text-white',
  regler: 'border-[#2E9E5B] bg-[#2E9E5B] text-white',
};

const TOAST_KEY: Record<ActionCode, TKey> = {
  approuver: 'consoleToastFactureApprouvee',
  contester: 'consoleToastFactureContestee',
  'resoudre-litige': 'consoleToastLitigeResolu',
  regler: 'consolePayeTransfere',
};

const isActionCode = (code: string): code is ActionCode => code in ACTION_FIELD;

const CARDS: { key: Exclude<keyof FactureKpis, 'totalFactures'>; group: Group; labelKey: TKey; colorCls: string }[] = [
  { key: 'enAttenteApprobation', group: 'attente', labelKey: 'fcTotalAttente', colorCls: 'text-[#C98A1E] dark:text-[#D9B36A]' },
  { key: 'aRegler', group: 'regler', labelKey: 'fcTotalRegler', colorCls: 'text-[#2E9E5B] dark:text-[#6FCF97]' },
  { key: 'litiges', group: 'litige', labelKey: 'fcLitige', colorCls: 'text-de9-red' },
  { key: 'reglesCeCycle', group: 'paid', labelKey: 'fcTotalPaid', colorCls: 'text-de9-ink' },
];

const FILTERS: { key: FilterKey; labelKey: TKey }[] = [
  { key: 'all', labelKey: 'fcAll' },
  { key: 'attente', labelKey: 'fcAttente' },
  { key: 'litige', labelKey: 'fcLitige' },
  { key: 'regler', labelKey: 'fcARegler' },
  { key: 'paid', labelKey: 'fcPaid' },
];

const fmt = (n: number): string => n.toLocaleString('fr-FR');

// Algeria is UTC+1 all year. A bare `au` date means midnight and would drop the
// whole last day, so the bounds are sent as full Algiers timestamps.
const ALGIERS = '+01:00';

const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function dayLabel(dt: Date, lang: Lang): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  const day = (lang === 'ar' ? DAYS_AR : DAYS_FR)[dt.getDay()];
  return `${day} ${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()}`;
}

/** ISO 8601 (visitAt, contesteeLe…) → « Samedi 20/06/2026 » in the UI language. */
function isoLabel(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '—';
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? iso : dayLabel(dt, lang);
}

/**
 * The row's pre-formatted French `date`, used only when `visitAt` is absent.
 * Built from its parts, never `new Date(date)`: « Vendredi 05/06/2026 » would
 * be read as US month/day.
 */
function legacyDateLabel(s: string, lang: Lang): string {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? dayLabel(new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])), lang) : s;
}

function problemInfo(err: unknown): { status?: number; code?: string; field?: string } {
  if (!axios.isAxiosError(err)) return {};
  const data = err.response?.data as { code?: unknown; field?: unknown } | undefined;
  return {
    status: err.response?.status,
    code: typeof data?.code === 'string' ? data.code : undefined,
    field: typeof data?.field === 'string' ? data.field : undefined,
  };
}

interface PendingAction {
  invoiceId: string;
  ref: string;
  code: ActionCode;
  champ: string | null;
  required: boolean;
  /** The server's label, when opened from « Voir ». */
  label: string | null;
}

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const SELECT_CLS =
  'rounded-[11px] border-[1.5px] border-de9-line bg-card px-3 py-2.5 text-[12.5px] font-semibold text-de9-slate outline-none';

// ===================== page =====================

export function FacturesPage() {
  const t = useT();
  const l = useL();
  const lang = useLangStore((s) => s.lang);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filter, setFilter] = useState<FilterKey>('all');
  const [searchInput, setSearchInput] = useState(() => searchParams.get('client') ?? '');
  const [q, setQ] = useState(searchInput);
  const [page, setPage] = useState(1);
  const [tri, setTri] = useState('');
  const [clientId, setClientId] = useState('');
  const [prestataireId, setPrestataireId] = useState('');
  const [du, setDu] = useState('');
  const [au, setAu] = useState('');

  useEffect(() => {
    const id = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  const params = useMemo<FactureConsoleParams>(() => {
    const p: FactureConsoleParams = { page, pageSize: PAGE_SIZE };
    if (q) p.q = q;
    if (filter !== 'all') p.statut = GROUP_STATUS[filter];
    if (tri) p.tri = tri;
    if (clientId) p.clientId = clientId;
    if (prestataireId) p.prestataireId = prestataireId;
    if (du) p.du = du + 'T00:00:00' + ALGIERS;
    if (au) p.au = au + 'T23:59:59' + ALGIERS;
    return p;
  }, [q, filter, page, tri, clientId, prestataireId, du, au]);

  const consoleQ = useFacturesConsole(params);
  const kpisQ = useFacturesKpis(params);
  const filtresQ = useFacturesFiltres(params);
  const action = useFactureConsoleAction();
  const ajouter = useAjouterFichiersFacture();
  const rows = consoleQ.data?.data ?? [];
  const meta = consoleQ.data?.meta;
  const kpis = kpisQ.data;
  const filtres = filtresQ.data;
  const countOf = (code: FilterKey): number | undefined => filtres?.statuts.find((s) => s.code === code)?.count;

  const setFilterKey = (key: FilterKey): void => {
    setFilter(key);
    setPage(1);
  };
  const resetPage = <T,>(set: (v: T) => void) => (v: T): void => {
    set(v);
    setPage(1);
  };

  // ---- « Voir » is addressable (?invoice=<id>) so the credits ledger can deep-link it ----
  const viewId = searchParams.get('invoice');
  const detailQ = useFactureDetail(viewId);
  const detail = detailQ.data;
  const openView = (invoiceId: string): void => {
    const sp = new URLSearchParams(searchParams);
    sp.set('invoice', invoiceId);
    setSearchParams(sp);
  };
  const closeView = (): void => {
    const sp = new URLSearchParams(searchParams);
    sp.delete('invoice');
    setSearchParams(sp);
  };

  // ---- overlays (client fiche by name; prestataire profile keyed by company id) ----
  const openClientFiche = (name: string | null | undefined): void => {
    if (!name || name === '—') return;
    const sp = new URLSearchParams(searchParams);
    sp.set('client', name);
    sp.delete('pres');
    setSearchParams(sp);
  };
  const openPres = (id: string | null | undefined, name: string | null | undefined): void => {
    const key = id || name;
    if (!key || key === '—') return;
    const sp = new URLSearchParams(searchParams);
    sp.set('pres', key);
    sp.delete('client');
    setSearchParams(sp);
  };

  // ---- inline preview: a direct <iframe src> would get a 401, so go through a blob ----
  const previewInvoice = detail?.invoiceId;
  const previewFile = detail?.fichier?.id;
  const [preview, setPreview] = useState<{ forId: string; url: string; contentType: string } | null>(null);
  const [previewFailed, setPreviewFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!previewInvoice || !previewFile) return;
    let cancelled = false;
    let url: string | null = null;
    previewFactureFile(previewInvoice, { documentId: previewFile })
      .then((res) => {
        if (cancelled) {
          URL.revokeObjectURL(res.url);
          return;
        }
        url = res.url;
        setPreview({ forId: previewFile, url: res.url, contentType: res.contentType });
      })
      .catch(() => {
        if (!cancelled) setPreviewFailed(previewFile);
      });
    return () => {
      cancelled = true;
      // The object URL holds the whole file in memory until revoked.
      if (url) URL.revokeObjectURL(url);
      setPreview(null);
    };
  }, [previewInvoice, previewFile]);
  const shownPreview = preview && preview.forId === previewFile ? preview : null;
  const previewLoading = !!previewFile && !shownPreview && previewFailed !== previewFile;

  // ---- downloads ----
  const [downloading, setDownloading] = useState<string | null>(null);
  const download = (invoiceId: string, fileName?: string, documentId?: string): void => {
    const key = invoiceId + (documentId ?? '');
    setDownloading(key);
    downloadFactureFile(invoiceId, { documentId, fileName, fallbackMessage: t('docTelechargementErreur') })
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : t('docTelechargementErreur')))
      .finally(() => setDownloading(null));
  };

  const onAddFiles = (e: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!detail || files.length === 0) return;
    ajouter.mutate(
      { invoiceId: detail.invoiceId, files },
      {
        onSuccess: () => toast.success(t('fcFichiersAjoutes')),
        onError: (err) => toast.error(problemMessage(err)),
      },
    );
  };

  // ---- actions: one confirmation dialog for the row shortcuts and « Voir » ----
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [champValue, setChampValue] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const openAction = (next: PendingAction): void => {
    setPending(next);
    setChampValue('');
    setFieldError(null);
  };
  const closeAction = (): void => {
    setPending(null);
    setChampValue('');
    setFieldError(null);
  };

  const openRowAction = (f: FactureConsoleItem, code: ActionCode): void => {
    const def = ACTION_FIELD[code];
    openAction({ invoiceId: f.invoiceId, ref: f.ref, code, champ: def.champ, required: def.required, label: null });
  };

  const onActionError = (err: unknown): void => {
    const info = problemInfo(err);
    const message = problemMessage(err);
    // A refused field belongs under the field, not in a toast.
    if (info.status === 400 && info.field && info.field === pending?.champ) {
      setFieldError(message);
      return;
    }
    if (info.code === 'insufficient_balance') {
      toast.error(message, { action: { label: t('nouvelleRecharge'), onClick: () => navigate('/credits') } });
      return;
    }
    toast.error(message);
    // The invoice moved under us (double click, another admin, already paid):
    // what we show is stale, so reload it rather than retry.
    if (info.status === 409 || info.status === 404) {
      void queryClient.invalidateQueries({ queryKey: ['factures'] });
      closeAction();
    }
  };

  const runAction = (): void => {
    if (!pending) return;
    const value = champValue.trim();
    if (pending.required && !value) {
      setFieldError(t('fcChampRequis'));
      return;
    }
    const current = pending;
    action.mutate(
      {
        invoiceId: current.invoiceId,
        code: current.code,
        body: current.champ && value ? { [current.champ]: value } : undefined,
      },
      {
        onSuccess: () => {
          toast.success(t(TOAST_KEY[current.code]));
          closeAction();
        },
        onError: onActionError,
      },
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-[23px] font-extrabold">{t('facturesTitle')}</div>
          <div className="mt-[2px] text-[13.5px] text-de9-gray">{t('facturesSub')}</div>
        </div>
      </div>

      {consoleQ.isPending ? (
        <div className="mt-4 animate-pulse">
          <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[104px] rounded-2xl border border-de9-line bg-card" />
            ))}
          </div>
          <div className="mt-3.5 h-64 rounded-[18px] border border-de9-line bg-card" />
        </div>
      ) : consoleQ.isError ? (
        <div className="mt-4 rounded-xl border border-[#F3C9CB] bg-[#FDECEC] px-4 py-3 text-[12.5px] font-semibold text-de9-red dark:border-[#E7464E]/40 dark:bg-[#E7464E]/15">
          {l('Erreur de chargement des factures', 'خطأ في تحميل الفواتير')} — {problemMessage(consoleQ.error)}
        </div>
      ) : (
        <>
          {/* cards — credits + count, from /kpis with the list's filters */}
          <div className="mt-4 grid grid-cols-2 gap-3.5 md:grid-cols-4">
            {CARDS.map((c) => {
              const bucket = kpis?.[c.key];
              return (
                <div
                  key={c.key}
                  onClick={() => setFilterKey(filter === c.group ? 'all' : c.group)}
                  className={cn(
                    'cursor-pointer rounded-2xl border bg-card px-[18px] py-4 shadow-[0_6px_18px_rgba(38,50,69,.04)]',
                    filter === c.group ? 'border-[#232838]' : 'border-de9-line',
                  )}
                >
                  <div className="text-xs font-semibold text-de9-gray">{t(c.labelKey)}</div>
                  <div className={cn('mt-1.5 text-[22px] font-extrabold', c.colorCls)}>
                    {bucket ? fmt(bucket.credits) : '—'}
                  </div>
                  <div className="text-[11px] text-de9-gray">
                    {t('credits')} · {bucket ? bucket.factures : '—'} {t('fcCount')}
                  </div>
                </div>
              );
            })}
          </div>

          {/* search + tabs (counts from /filtres) */}
          <div className="mt-4 flex flex-wrap items-center gap-[9px]">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('facSearch')}
              className="min-w-0 flex-1 rounded-[11px] border-[1.5px] border-de9-line bg-card px-[15px] py-2.5 text-[12.5px] text-de9-ink outline-none sm:flex-[0_0_300px]"
            />
            {FILTERS.map((ff) => {
              const active = filter === ff.key;
              return (
                <button
                  key={ff.key}
                  type="button"
                  onClick={() => setFilterKey(ff.key)}
                  className={cn(
                    'cursor-pointer rounded-full border-[1.5px] px-[15px] py-[9px] text-[12.5px] font-bold',
                    active ? 'border-[#232838] bg-[#232838] text-white' : 'border-de9-line bg-card text-de9-slate',
                  )}
                >
                  {t(ff.labelKey)} · {countOf(ff.key) ?? '—'}
                </button>
              );
            })}
          </div>

          {/* sort, client, prestataire, visit-date range */}
          <div className="mt-2.5 flex flex-wrap items-center gap-[9px]">
            <select value={tri} onChange={(e) => resetPage(setTri)(e.target.value)} className={SELECT_CLS}>
              <option value="">{t('fcTri')}</option>
              {(filtres?.tris ?? []).map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
            <select value={clientId} onChange={(e) => resetPage(setClientId)(e.target.value)} className={SELECT_CLS}>
              <option value="">
                {t('fClient')} : {t('tous')}
              </option>
              {(filtres?.clients.items ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nom}
                </option>
              ))}
            </select>
            <select
              value={prestataireId}
              onChange={(e) => resetPage(setPrestataireId)(e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">
                {t('fPrestataire')} : {t('tous')}
              </option>
              {(filtres?.prestataires.items ?? []).map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nom}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-de9-gray">
              {t('fcDu')}
              <input
                type="date"
                value={du}
                max={au || undefined}
                onChange={(e) => resetPage(setDu)(e.target.value)}
                className={SELECT_CLS}
              />
            </label>
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-de9-gray">
              {t('fcAu')}
              <input
                type="date"
                value={au}
                min={du || undefined}
                onChange={(e) => resetPage(setAu)(e.target.value)}
                className={SELECT_CLS}
              />
            </label>
            {(filtres?.clients.truncated || filtres?.prestataires.truncated) && (
              <span className="text-[11px] font-semibold text-de9-gray">{t('worklistFiltresTronques')}</span>
            )}
          </div>

          {/* table */}
          <div className="mt-3.5 overflow-hidden rounded-[18px] border border-de9-line bg-card shadow-[0_10px_30px_rgba(38,50,69,.06)]">
            <div className={cn('overflow-x-auto transition-opacity', consoleQ.isPlaceholderData && 'opacity-60')}>
              <div className="min-w-[920px]">
                <div className="grid grid-cols-[1.3fr_1.7fr_1.3fr_1.3fr_1fr_1.2fr_2fr] gap-3 border-b border-de9-line bg-secondary px-[22px] py-[13px] text-[10.5px] font-bold tracking-[.04em] text-de9-gray uppercase">
                  <div>{t('fcRef')}</div>
                  <div>{t('fcEnt')}</div>
                  <div>{t('fcPro')}</div>
                  <div>{t('fcDate')}</div>
                  <div className="text-end">{t('fcMontant')}</div>
                  <div>{t('fcStatut')}</div>
                  <div className="text-end">{t('fcActions')}</div>
                </div>

                {rows.map((f) => {
                  const st = STATUS_META[f.status];
                  // Unknown (field not sent yet) → allow, and let a 404 explain itself.
                  const canDownload = f.hasFichier !== false;
                  return (
                    <div
                      key={f.invoiceId}
                      className="grid grid-cols-[1.3fr_1.7fr_1.3fr_1.3fr_1fr_1.2fr_2fr] items-center gap-3 border-b border-de9-line px-[22px] py-3.5"
                    >
                      <div>
                        <div className="text-[13px] font-extrabold">{f.ref}</div>
                        <div className="text-[11px] text-de9-gray">
                          {f.cmdRef ?? f.cmdId} · {f.service ?? '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold">
                          <span
                            onClick={() => openClientFiche(f.client)}
                            className="cursor-pointer underline decoration-[#C7CFD7] decoration-dotted underline-offset-[3px]"
                          >
                            {f.client}
                          </span>
                        </div>
                        <div className="text-[11px] text-de9-gray">{f.email ?? '—'}</div>
                      </div>
                      <div className="text-[12.5px] font-semibold text-de9-slate">
                        <span
                          onClick={() => openPres(f.prestataireId, f.pres)}
                          className="cursor-pointer underline decoration-[#C7CFD7] decoration-dotted underline-offset-[3px]"
                        >
                          {f.pres ?? '—'}
                        </span>
                      </div>
                      <div className="text-xs text-de9-slate">
                        {f.visitAt ? isoLabel(f.visitAt, lang) : legacyDateLabel(f.date, lang)}
                      </div>
                      <div className="text-end">
                        <span className="text-[13.5px] font-extrabold text-de9-ink">{fmt(f.montant)}</span>
                        <div className="text-[10px] text-de9-gray">{t('credits')}</div>
                      </div>
                      <div>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-[11px] font-bold',
                            st.pill,
                          )}
                        >
                          <span className="inline-flex min-w-[18px] flex-none items-center justify-center rounded-md bg-[#232838] px-[5px] py-[2px] text-[9.5px] leading-[1.4] font-extrabold tracking-[.02em] text-white">
                            {f.code ?? st.num}
                          </span>
                          <span className={cn('h-[7px] w-[7px] rounded-full', st.dot)} />
                          {f.statusLabel ?? t(st.labelKey)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-[7px]">
                        {st.actions.map((code) => (
                          <button
                            key={code}
                            type="button"
                            disabled={action.isPending}
                            onClick={() => openRowAction(f, code)}
                            className={cn(
                              'cursor-pointer rounded-[10px] border-[1.5px] px-[13px] py-2 text-[11.5px] font-bold disabled:opacity-60',
                              ACTION_CLS[code],
                            )}
                          >
                            {t(ACTION_TITLE[code])}
                          </button>
                        ))}
                        {canDownload && (
                          <button
                            type="button"
                            title={t('telecharger')}
                            aria-label={t('telecharger')}
                            disabled={downloading === f.invoiceId}
                            onClick={() => download(f.invoiceId, `facture-${f.ref}.pdf`)}
                            className="cursor-pointer rounded-[10px] border-[1.5px] border-de9-line bg-card px-2.5 py-2 text-[11.5px] font-bold text-de9-slate disabled:opacity-50"
                          >
                            ⤓
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openView(f.invoiceId)}
                          className="cursor-pointer rounded-[10px] border-[1.5px] border-de9-line bg-secondary px-[13px] py-2 text-[11.5px] font-bold text-de9-slate"
                        >
                          {t('fcVoir')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {rows.length === 0 && <div className="p-11 text-center text-sm text-de9-gray">{t('fcEmpty')}</div>}

            {meta && meta.total_pages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-de9-line px-[22px] py-3">
                <div className="text-[12.5px] font-semibold text-de9-gray">
                  {t('worklistPageInfo')
                    .replace('{n}', String(meta.current_page))
                    .replace('{m}', String(meta.total_pages))}
                  {' · '}
                  {meta.total} {t('fcCount')}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((n) => Math.max(1, n - 1))}
                    className="cursor-pointer rounded-[11px] border-[1.5px] border-de9-line bg-card px-[13px] py-2 text-[12.5px] font-bold text-de9-slate disabled:cursor-default disabled:opacity-40"
                  >
                    {t('pagePrecedent')}
                  </button>
                  <button
                    type="button"
                    disabled={!meta.has_more_pages}
                    onClick={() => setPage((n) => n + 1)}
                    className="cursor-pointer rounded-[11px] border-[1.5px] border-de9-line bg-card px-[13px] py-2 text-[12.5px] font-bold text-de9-slate disabled:cursor-default disabled:opacity-40"
                  >
                    {t('pageSuivant')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== action confirmation ===== */}
      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) closeAction();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="block max-h-[90vh] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-[22px] bg-card p-7 sm:max-w-[460px]"
        >
          {pending && (
            <>
              <div className="flex h-[54px] w-[54px] items-center justify-center rounded-[15px] bg-[#EAF2FD] text-[26px] dark:bg-[#2F7FD0]/15">
                {ACTION_ICON[pending.code]}
              </div>
              <DialogTitle className="mt-4 text-[19px] leading-normal font-extrabold text-de9-ink">
                {pending.label ?? t(ACTION_TITLE[pending.code])} · {pending.ref}
              </DialogTitle>
              <DialogDescription className="mt-[9px] text-[13.5px] leading-[1.55] text-de9-slate">
                {t(ACTION_INFO[pending.code])}
              </DialogDescription>
              {pending.code === 'approuver' && (
                <div className="mt-4 rounded-xl border border-[#F0E2C0] bg-[#FBF4E4] px-[15px] py-[13px] text-[12.5px] leading-[1.5] text-[#92702A] dark:border-[#92702A]/40 dark:bg-[#92702A]/15 dark:text-[#D9B36A]">
                  {t('modalWarn')}
                </div>
              )}
              {pending.champ && (
                <div className="mt-4">
                  <div className="mb-1.5 text-xs font-semibold text-de9-slate">
                    {t(CHAMP_LABEL[pending.champ] ?? 'fcChampNote')}
                    {pending.required ? ' *' : ''}
                  </div>
                  <textarea
                    value={champValue}
                    onChange={(e) => {
                      setChampValue(e.target.value);
                      setFieldError(null);
                    }}
                    maxLength={2000}
                    rows={3}
                    aria-invalid={!!fieldError}
                    className={cn(
                      'w-full resize-y rounded-xl border-[1.5px] bg-card px-3.5 py-3 text-[13.5px] text-de9-ink outline-none',
                      fieldError ? 'border-de9-red' : 'border-de9-line',
                    )}
                  />
                  {fieldError && <p className="pt-1 text-[11.5px] font-semibold text-de9-red">{fieldError}</p>}
                </div>
              )}
              <div className="mt-[22px] flex gap-[11px]">
                <button
                  type="button"
                  onClick={closeAction}
                  className="flex-1 cursor-pointer rounded-[13px] bg-secondary p-3.5 text-center text-sm font-bold text-de9-slate"
                >
                  {t('annuler')}
                </button>
                <button
                  type="button"
                  disabled={action.isPending}
                  onClick={runAction}
                  className="flex-1 cursor-pointer rounded-[13px] bg-[#2F7FD0] p-3.5 text-center text-sm font-bold text-white shadow-[0_10px_22px_rgba(47,127,208,.4)] disabled:opacity-60"
                >
                  {action.isPending
                    ? t('docTelechargementEnCours')
                    : pending.code === 'approuver'
                      ? t('confirmerAuNom')
                      : t('fcConfirmer')}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== « Voir » ===== */}
      <Dialog
        open={viewId !== null}
        onOpenChange={(open) => {
          if (!open) closeView();
        }}
      >
        <DialogContent
          showCloseButton={false}
          aria-describedby={undefined}
          className="block max-h-[90vh] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-[22px] bg-card p-7 sm:max-w-[580px]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DialogTitle className="text-[19px] leading-normal font-extrabold text-de9-ink">
              {detail ? detail.ref : t('titleView')}
            </DialogTitle>
            {detail && (
              <span className="text-xs text-de9-gray">
                {detail.visitAt
                  ? isoLabel(detail.visitAt, lang)
                  : detail.date
                    ? legacyDateLabel(detail.date, lang)
                    : '—'}
              </span>
            )}
          </div>

          {detailQ.isPending && <div className="mt-4 h-48 animate-pulse rounded-[14px] bg-secondary" />}
          {detailQ.isError && (
            <div className="mt-4 rounded-xl border border-[#F3C9CB] bg-[#FDECEC] px-4 py-3 text-[12.5px] font-semibold text-de9-red dark:border-[#E7464E]/40 dark:bg-[#E7464E]/15">
              {problemInfo(detailQ.error).status === 404 ? t('fcIntrouvable') : problemMessage(detailQ.error)}
            </div>
          )}

          {detail && (
            <>
              <div className="mt-1 text-[12px] text-de9-gray">
                {[detail.service, detail.cmdRef].filter(Boolean).join(' · ') || '—'}
              </div>

              {/* parties */}
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-secondary px-3.5 py-2.5">
                  <div className="text-[10.5px] font-bold tracking-[.04em] text-de9-gray uppercase">{t('fcEnt')}</div>
                  <div
                    onClick={() => openClientFiche(detail.client.nom)}
                    className="cursor-pointer truncate text-[13px] font-bold text-de9-ink underline decoration-[#C7CFD7] decoration-dotted underline-offset-[3px]"
                  >
                    {detail.client.nom ?? '—'}
                  </div>
                  <div className="truncate text-[11px] text-de9-gray">
                    {[detail.client.email, detail.client.telephone].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="rounded-xl bg-secondary px-3.5 py-2.5">
                  <div className="text-[10.5px] font-bold tracking-[.04em] text-de9-gray uppercase">{t('fcPro')}</div>
                  <div
                    onClick={() => openPres(detail.prestataire?.id, detail.prestataire?.nom)}
                    className="cursor-pointer truncate text-[13px] font-bold text-de9-ink underline decoration-[#C7CFD7] decoration-dotted underline-offset-[3px]"
                  >
                    {detail.prestataire?.nom ?? '—'}
                  </div>
                  <div className="truncate text-[11px] text-de9-gray">
                    {[detail.prestataire?.email, detail.prestataire?.telephone].filter(Boolean).join(' · ')}
                  </div>
                </div>
              </div>

              <div className="mt-3.5 overflow-hidden rounded-[14px] border-[1.5px] border-de9-line">
                {/* file preview */}
                <div className="border-b border-de9-line bg-secondary">
                  {!detail.fichier ? (
                    <div className="p-7 text-center">
                      <div className="text-[42px]">📭</div>
                      <div className="mt-2 text-[13px] font-bold text-de9-slate">{t('fcAucunFichier')}</div>
                    </div>
                  ) : shownPreview ? (
                    shownPreview.contentType.startsWith('image/') ? (
                      <img
                        src={shownPreview.url}
                        alt={detail.fichier.fileName}
                        className="mx-auto max-h-[360px] w-auto"
                      />
                    ) : (
                      <iframe src={shownPreview.url} title={detail.fichier.fileName} className="h-[360px] w-full bg-white" />
                    )
                  ) : (
                    <div className="p-7 text-center">
                      <div className="text-[42px]">📄</div>
                      <div className="mt-2 text-[13px] font-bold text-de9-slate">{detail.fichier.fileName}</div>
                      <div className="text-[11px] text-de9-gray">
                        {previewLoading ? t('fcApercuChargement') : t('fcApercuIndispo')}
                      </div>
                    </div>
                  )}
                  {detail.fichier && (
                    <div className="flex items-center justify-between gap-2 border-t border-de9-line px-3.5 py-2.5">
                      <span className="truncate text-[12px] font-semibold text-de9-slate">{detail.fichier.fileName}</span>
                      <button
                        type="button"
                        disabled={downloading === detail.invoiceId}
                        onClick={() => download(detail.invoiceId, detail.fichier?.fileName)}
                        className="flex-none cursor-pointer rounded-[10px] bg-de9-ink px-3 py-1.5 text-[11.5px] font-bold text-white disabled:opacity-50 dark:text-[#151923]"
                      >
                        ⤓ {downloading === detail.invoiceId ? t('docTelechargementEnCours') : t('telecharger')}
                      </button>
                    </div>
                  )}
                </div>

                <div className="px-[18px] py-4">
                  <div className="mb-2.5 flex justify-between text-sm">
                    <span className="text-de9-gray">{t('montantLabel')}</span>
                    <b className="text-base">
                      {fmt(detail.montantCredits)} cr
                      {detail.montantDzd != null && (
                        <span className="ms-1.5 text-[11px] font-semibold text-de9-gray">
                          ≈ {fmt(detail.montantDzd)} DZD
                        </span>
                      )}
                    </b>
                  </div>

                  {/* The server applies the payout rule (85 % floored, margin = the rest). */}
                  {detail.ventilation && (
                    <div className="rounded-[10px] bg-secondary px-[13px] py-[11px] text-xs leading-[1.6] text-de9-slate">
                      {t('ventilation')} (
                      {detail.ventilation.definitive ? t('fcVentilationDefinitive') : t('fcVentilationPrevue')}) :{' '}
                      <b>{fmt(detail.montantCredits)}</b> {t('client')} →{' '}
                      <b className="text-[#2FA86A] dark:text-[#6FCF97]">{fmt(detail.ventilation.prestataireCredits)}</b>{' '}
                      {t('pro')}
                      {detail.ventilation.prestatairePourcent != null && ` (${detail.ventilation.prestatairePourcent}%)`}{' '}
                      · <b className="text-de9-red">{fmt(detail.ventilation.margeCredits)}</b> de9de9
                      {detail.ventilation.margePourcent != null && ` (${detail.ventilation.margePourcent}%)`}
                    </div>
                  )}

                  <div className="mt-[13px] flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-[11px] py-[5px] text-[11px] font-bold',
                        DETAIL_PILL[detail.status],
                      )}
                    >
                      {detail.code && (
                        <span className="inline-flex min-w-[18px] items-center justify-center rounded-md bg-[#232838] px-[5px] py-[2px] text-[9.5px] font-extrabold text-white">
                          {detail.code}
                        </span>
                      )}
                      {detail.statusLabel ?? detail.status}
                    </span>
                    {detail.transfere && (
                      <span className="rounded-full bg-[#2FA86A] px-[11px] py-[5px] text-[11px] font-extrabold text-white">
                        {t('transfere')}
                      </span>
                    )}
                    {detail.versement?.reference && (
                      <span className="text-[11px] text-de9-gray">
                        {t('fcVersementRef')} {detail.versement.reference}
                        {detail.versement.paidAt ? ' · ' + isoLabel(detail.versement.paidAt, lang) : ''}
                      </span>
                    )}
                  </div>

                  {detail.contestation && (
                    <div className="mt-3 rounded-[10px] border border-[#F3C9CB] bg-[#FDECEC] px-3.5 py-3 text-[12px] text-de9-red dark:border-[#E7464E]/40 dark:bg-[#E7464E]/15">
                      <div className="font-extrabold">
                        {t('fcBlocLitige')}
                        {detail.contestation.enCours ? ' · ' + t('fcLitigeEnCours') : ''}
                      </div>
                      {detail.contestation.motif && <div className="mt-1">{detail.contestation.motif}</div>}
                      {detail.contestation.contesteeLe && (
                        <div className="mt-1 text-[11px] opacity-80">
                          {t('fcContesteeLe')} {isoLabel(detail.contestation.contesteeLe, lang)}
                        </div>
                      )}
                      {detail.contestation.resolution && (
                        <div className="mt-2 text-de9-slate">
                          <b>{t('fcResolutionLabel')} :</b> {detail.contestation.resolution}
                        </div>
                      )}
                    </div>
                  )}

                  {(detail.documents ?? []).filter((d) => d.id !== detail.fichier?.id).length > 0 && (
                    <div className="mt-3">
                      <div className="text-[10.5px] font-bold tracking-[.04em] text-de9-gray uppercase">
                        {t('fcAutresFichiers')}
                      </div>
                      {(detail.documents ?? [])
                        .filter((d) => d.id !== detail.fichier?.id)
                        .map((d) => (
                          <div
                            key={d.id}
                            className="mt-1.5 flex items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2"
                          >
                            <span className="truncate text-[12px] text-de9-slate">📎 {d.fileName}</span>
                            <button
                              type="button"
                              aria-label={t('telecharger')}
                              disabled={downloading === detail.invoiceId + d.id}
                              onClick={() => download(detail.invoiceId, d.fileName, d.id)}
                              className="flex-none cursor-pointer text-[12px] font-bold text-de9-slate disabled:opacity-50"
                            >
                              ⤓
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* buttons — from the server's `actions`, never a hardcoded table */}
              {(detail.actions ?? []).length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {(detail.actions ?? []).map((a) => {
                    const code = a.code;
                    if (code === 'ajouter-fichiers') {
                      return (
                        <label
                          key={code}
                          className={cn(
                            'cursor-pointer rounded-[10px] border-[1.5px] border-de9-line bg-card px-[13px] py-2 text-[11.5px] font-bold text-de9-slate',
                            ajouter.isPending && 'pointer-events-none opacity-60',
                          )}
                        >
                          📎 {ajouter.isPending ? t('docTelechargementEnCours') : a.label}
                          <input
                            type="file"
                            multiple
                            accept="image/*,application/pdf"
                            onChange={onAddFiles}
                            className="hidden"
                          />
                        </label>
                      );
                    }
                    if (!isActionCode(code)) return null;
                    const def = ACTION_FIELD[code];
                    return (
                      <button
                        key={code}
                        type="button"
                        disabled={action.isPending}
                        onClick={() =>
                          openAction({
                            invoiceId: detail.invoiceId,
                            ref: detail.ref,
                            code,
                            champ: a.champ ?? def.champ,
                            required: a.champObligatoire ?? def.required,
                            label: a.label,
                          })
                        }
                        className={cn(
                          'cursor-pointer rounded-[10px] border-[1.5px] px-[13px] py-2 text-[11.5px] font-bold disabled:opacity-60',
                          ACTION_CLS[code],
                        )}
                      >
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          <button
            type="button"
            onClick={closeView}
            className="mt-5 w-full cursor-pointer rounded-[13px] bg-[#232838] p-3.5 text-center text-sm font-bold text-white"
          >
            {t('btnClose')}
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
