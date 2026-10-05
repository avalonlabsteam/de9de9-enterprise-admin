// ACCÈS — « Accès B2C / B2B »: the two authorities de9de9 holds per company.
//   B2C  the bridge to the de9de9 consumer app — OFF until granted
//   B2B  new activity on the Entreprise marketplace — ON until suspended
//   list      GET /admin/acces-entreprises        counters  GET …/compteurs
//   actions   POST …/b2c/accorder | b2c/retirer | b2b/activer | b2b/desactiver
//   one row   POST /admin/companies/{id}/legacy-sync/retry (« Relancer »)
// Every filter lives in the URL (?q=, ?b2c=, ?b2b=, ?kyc=, ?cote=, ?page=,
// ?pageSize=), so an alert or the company page can deep-link here
// (/acces?b2c=echec). The selection is client-side: it survives a page change,
// a filter change and a search, and is dropped on leaving the page.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { t as translate, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { problemMessage } from '@/api/problem';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  refreshAcces,
  useAccesCompteurs,
  useAccesEntreprises,
  useRetryLegacySync,
  type AccesFilters,
} from '../api/acces';
import { reloadPont } from '../api/pont';
import {
  ACCES_GRID,
  ACTIONS,
  B2B_FILTERS,
  B2C_FILTERS,
  CHIPS,
  COTE_FILTERS,
  DEFAULT_PAGE_SIZE,
  KYC_FILTERS,
  PAGE_SIZES,
  SELECTION_MAX,
  accesErrorMessage,
  filterOf,
  isFait,
  pageSizeOf,
  plural,
  type AccesAction,
  type ChipDef,
  type FilterOption,
} from '../lib/acces';
import type { AccesLot } from '../schemas/acces';
import {
  accesSelection,
  targetOf,
  targetsOf,
  useAccesSelection,
  type AccesTarget,
} from '../stores/selectionStore';
import { AccesConfirmDialog } from './AccesConfirmDialog';
import { AccesResultDialog } from './AccesResultDialog';
import { AccesRow, Tick } from './AccesRow';
import { AccesSelectionBar } from './AccesSelectionBar';
import { PontCard } from './PontCard';

const SEARCH_DEBOUNCE_MS = 300;
const PAGER_BTN =
  'cursor-pointer rounded-full border border-de9-line bg-card px-[13px] py-2 text-[12.5px] font-bold text-de9-slate disabled:cursor-default disabled:opacity-40';

/** A send waiting for its confirmation. */
interface Pending {
  action: AccesAction;
  targets: AccesTarget[];
  /** From the selection bar, or from one row's switch or menu (the selection is then left alone). */
  fromSelection: boolean;
}

/** A send the server answered: its summary is on screen. */
interface Outcome extends Pending {
  motif: string;
  lot: AccesLot;
}

/** « B2B : Tous » — the label rides in the value, since « Suspendu » alone could be either access. */
function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly FilterOption[];
  onChange: (v: string) => void;
}) {
  const t = useT();
  return (
    <Select value={value || 'all'} onValueChange={(v) => onChange(v === 'all' ? '' : v)}>
      <SelectTrigger
        aria-label={label}
        className="h-auto w-full cursor-pointer gap-1.5 rounded-xs border border-outline bg-card px-[13px] py-[10px] text-[12.5px] font-semibold text-de9-slate shadow-none sm:w-auto"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all" className="text-[12.5px] font-semibold text-de9-slate">
          {label} : {t('tous')}
        </SelectItem>
        {options.map((o) => (
          <SelectItem key={o.v} value={o.v} className="text-[12.5px] font-semibold text-de9-slate">
            {label} : {t(o.labelKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** red / amber: the whole card once its figure is above zero. green: the figure. */
function chipTone(c: ChipDef, n: number | undefined): { card: string; figure: string } {
  const hot = (n ?? 0) > 0;
  if (c.tone === 'red' && hot) {
    return {
      card: 'border-[#F3B5B8] bg-[#FDECEC] dark:border-[#E7464E]/50 dark:bg-[#E7464E]/10',
      figure: 'text-de9-red',
    };
  }
  if (c.tone === 'amber' && hot) {
    return {
      card: 'border-[#E6C77E] bg-[#FBF4E4] dark:border-[#B68A2E]/60 dark:bg-[#B68A2E]/10',
      figure: 'text-[#B68A2E] dark:text-[#D9B36A]',
    };
  }
  return {
    card: 'border-de9-line bg-card',
    figure: c.tone === 'green' ? 'text-[#2FA86A] dark:text-[#6FCF97]' : 'text-de9-ink',
  };
}

export function AccesPage() {
  const t = useT();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();

  // ---- filters, from the URL ----
  const q = sp.get('q') ?? '';
  const b2c = filterOf(sp.get('b2c'), B2C_FILTERS);
  const b2b = filterOf(sp.get('b2b'), B2B_FILTERS);
  const kyc = filterOf(sp.get('kyc'), KYC_FILTERS);
  const cote = filterOf(sp.get('cote'), COTE_FILTERS);
  const page = Math.max(1, Math.floor(Number(sp.get('page'))) || 1);
  const pageSize = pageSizeOf(sp.get('pageSize'));

  /** Filters replace: « back » leaves the page, not each filter. */
  const patch = (changes: Record<string, string | null>): void => {
    setSp(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  };

  // ---- search, debounced into ?q= ----
  const [searchInput, setSearchInput] = useState(q);
  useEffect(() => {
    const id = setTimeout(() => {
      const next = searchInput.trim();
      if (next !== q) patch({ q: next || null, page: null });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
    // `patch` is rebuilt each render; only the typed text drives this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const filters = useMemo<AccesFilters>(
    () => ({
      q: q.trim() || undefined,
      b2c: b2c || undefined,
      b2b: b2b || undefined,
      kyc: kyc || undefined,
      cote: cote || undefined,
      page,
      pageSize,
    }),
    [q, b2c, b2b, kyc, cote, page, pageSize],
  );

  const listQ = useAccesEntreprises(filters);
  const compteursQ = useAccesCompteurs();
  const rows = useMemo(() => listQ.data?.data ?? [], [listQ.data]);
  const meta = listQ.data?.meta;
  const compteurs = compteursQ.data;
  const fetching = listQ.isFetching || compteursQ.isFetching;

  const refresh = (): void => {
    void listQ.refetch();
    void compteursQ.refetch();
    reloadPont();
  };

  // ---- selection ----
  const selected = useAccesSelection((s) => s.selected);
  // Dropped on leaving the page: it was built against this list.
  useEffect(() => () => accesSelection.clear(), []);

  const full = selected.size >= SELECTION_MAX;
  const onPage = rows.filter((r) => selected.has(r.id)).length;
  const allOnPage = rows.length > 0 && onPage === rows.length;
  // First click ticks the page; a click on a full page — or on one the limit keeps partial — unticks it.
  const togglePage = (): void => accesSelection.setPage(rows.map(targetOf), !(allOnPage || (full && onPage > 0)));

  // ---- actions ----
  const [pending, setPending] = useState<Pending | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const { mutate: retrySync, isPending: retrying } = useRetryLegacySync();

  // What the rows call: stable, so a tick repaints one row and not the table.
  const askOne = useCallback(
    (action: AccesAction, target: AccesTarget) => setPending({ action, targets: [target], fromSelection: false }),
    [],
  );
  const relancer = useCallback(
    (companyId: string) =>
      retrySync(companyId, {
        onSuccess: () => toast.success(translate('accesSyncRelancee')),
        onError: (err) => toast.error(accesErrorMessage(err, translate)),
      }),
    [retrySync],
  );
  const voirSync = useCallback(
    (companyId: string) => navigate(`/entreprises/${encodeURIComponent(companyId)}?cote=prestataire&onglet=sync`),
    [navigate],
  );

  const onDone = (lot: AccesLot, motif: string): void => {
    if (!pending) return;
    setPending(null);
    const only = lot.resultats.length === 1 ? lot.resultats[0] : undefined;
    // One company, done: its sentence is the whole summary.
    if (only && isFait(only)) {
      toast.success(only.detail ?? t(ACTIONS[pending.action].resultKey).replace('{n}', '1').replace('{m}', '1'));
      if (pending.fromSelection) accesSelection.clear();
      return;
    }
    setOutcome({ ...pending, motif, lot });
  };

  /**
   * A send got no answer (timeout, cut connection). The server runs a started
   * lot to its end: look at the list again, now and in a moment, rather than
   * resending. The selection is kept for that second look.
   */
  const onSansReponse = (): void => {
    setPending(null);
    setOutcome(null);
    refreshAcces();
    window.setTimeout(refreshAcces, 5_000);
  };

  const dialogOpen = !!pending || !!outcome;

  return (
    <div className={cn(selected.size > 0 && 'pb-44 lg:pb-24')}>
      {/* ===== header ===== */}
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-[23px] font-extrabold">{t('accesTitre')}</div>
          <div className="mt-[2px] text-[13.5px] text-de9-gray">{t('accesSub')}</div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={fetching}
          className="flex cursor-pointer items-center gap-2 rounded-full border border-de9-line bg-card px-4 py-[11px] text-[12.5px] font-bold text-de9-slate hover:bg-de9-row disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={cn('size-4', fetching && 'animate-spin')} />
          {t('comptaActualiser')}
        </button>
      </div>

      {/* ===== the bridge to the de9de9 app: its state, and the switch itself (guide 24) ===== */}
      <PontCard />

      {/* ===== counters — GET /admin/acces-entreprises/compteurs; each one is a filter ===== */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 2xl:grid-cols-8">
        {CHIPS.map((c) => {
          const n = compteurs?.[c.field];
          const active = b2c === c.b2c && b2b === c.b2b;
          const tone = chipTone(c, n);
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={active}
              onClick={() => patch({ b2c: c.b2c || null, b2b: c.b2b || null, page: null })}
              className={cn(
                'cursor-pointer rounded-md border px-4 py-3 text-start',
                tone.card,
                active && 'ring-2 ring-primary',
              )}
            >
              <div className="truncate text-xs font-semibold text-de9-gray" title={t(c.labelKey)}>
                {t(c.labelKey)}
              </div>
              <div className={cn('mt-1 text-[22px] leading-none font-extrabold', tone.figure)}>
                <span className="num">{n ?? '—'}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ===== search · filters ===== */}
      <div className="mt-4 flex flex-wrap items-center gap-[9px]">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('accesRecherche')}
          aria-label={t('accesRecherche')}
          className="w-full flex-none rounded-xs border border-outline bg-card px-[15px] py-[10px] text-[12.5px] text-de9-ink outline-none sm:w-[320px]"
        />
        <FilterSelect label="B2C" value={b2c} options={B2C_FILTERS} onChange={(v) => patch({ b2c: v || null, page: null })} />
        <FilterSelect label="B2B" value={b2b} options={B2B_FILTERS} onChange={(v) => patch({ b2b: v || null, page: null })} />
        <FilterSelect label="KYC" value={kyc} options={KYC_FILTERS} onChange={(v) => patch({ kyc: v || null, page: null })} />
        <FilterSelect
          label={t('accesFiltreCote')}
          value={cote}
          options={COTE_FILTERS}
          onChange={(v) => patch({ cote: v || null, page: null })}
        />
      </div>

      {/* ===== list ===== */}
      <div className="mt-3.5 overflow-hidden rounded-md border border-de9-line bg-card">
        <div className={cn('overflow-x-auto transition-opacity', listQ.isPlaceholderData && 'opacity-60')}>
          <div className="min-w-[940px]">
            <div
              className={cn(
                'grid items-center gap-3 border-b border-de9-line bg-secondary px-5 py-[13px] text-[10.5px] font-bold tracking-[.04em] text-de9-gray uppercase',
                ACCES_GRID,
              )}
            >
              <div className="flex">
                <Tick
                  state={allOnPage ? true : onPage > 0 ? 'indeterminate' : false}
                  label={t('accesSelectPage')}
                  title={full && onPage === 0 ? t('accesMax200') : undefined}
                  disabled={rows.length === 0 || (full && onPage === 0)}
                  onToggle={togglePage}
                />
              </div>
              <div>{t('accesColEntreprise')}</div>
              <div>KYC</div>
              <div>{t('accesColB2c')}</div>
              <div>{t('accesColB2b')}</div>
              <div />
            </div>

            {listQ.isPending && (
              <div className="px-5 py-3.5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="mb-3 h-12 animate-pulse rounded-sm bg-de9-row last:mb-0" />
                ))}
              </div>
            )}

            {listQ.isError && (
              <div className="px-5 py-4 text-[12.5px] font-semibold text-de9-red">
                {t('accesErreurListe')} — {problemMessage(listQ.error)}
              </div>
            )}

            {rows.map((r) => (
              <AccesRow
                key={r.id}
                row={r}
                selected={selected.has(r.id)}
                full={full}
                retrying={retrying}
                onToggle={accesSelection.toggle}
                onAsk={askOne}
                onRelancer={relancer}
                onVoirSync={voirSync}
              />
            ))}
          </div>
        </div>

        {listQ.isSuccess && rows.length === 0 && (
          <div className="px-5 py-10 text-center text-[13px] text-de9-gray">{t('accesAucune')}</div>
        )}

        {meta && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-de9-line px-5 py-3">
            <div className="text-[12.5px] font-semibold text-de9-gray">
              {plural(meta.total, 'accesCount1', 'accesCountN', t)}
              {meta.total_pages > 1 &&
                ' · ' +
                  t('worklistPageInfo')
                    .replace('{n}', String(meta.current_page))
                    .replace('{m}', String(meta.total_pages))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {meta.total_pages > 1 && (
                <>
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => patch({ page: page > 2 ? String(page - 1) : null })}
                    className={PAGER_BTN}
                  >
                    {t('pagePrecedent')}
                  </button>
                  <button
                    type="button"
                    disabled={!meta.has_more_pages}
                    onClick={() => patch({ page: String(page + 1) })}
                    className={PAGER_BTN}
                  >
                    {t('pageSuivant')}
                  </button>
                </>
              )}
              {/* To act on more than a page at once: up to 200 rows, the limit of one send. */}
              <select
                value={pageSize}
                aria-label={t('accesParPage').replace('{n}', String(pageSize))}
                onChange={(e) =>
                  patch({
                    pageSize: Number(e.target.value) === DEFAULT_PAGE_SIZE ? null : e.target.value,
                    page: null,
                  })
                }
                className="cursor-pointer rounded-xs border border-outline bg-card px-3 py-2 text-[12.5px] font-semibold text-de9-slate outline-none"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {t('accesParPage').replace('{n}', String(n))}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ===== overlays ===== */}
      {!dialogOpen && (
        <AccesSelectionBar
          onAction={(action) => setPending({ action, targets: targetsOf(selected), fromSelection: true })}
        />
      )}
      {pending && (
        <AccesConfirmDialog
          action={pending.action}
          targets={pending.targets}
          onClose={() => setPending(null)}
          onDone={onDone}
          onSansReponse={onSansReponse}
        />
      )}
      {outcome && (
        <AccesResultDialog
          action={outcome.action}
          motif={outcome.motif}
          lot={outcome.lot}
          targets={outcome.targets}
          fromSelection={outcome.fromSelection}
          onClose={() => setOutcome(null)}
          onSansReponse={onSansReponse}
        />
      )}
    </div>
  );
}
