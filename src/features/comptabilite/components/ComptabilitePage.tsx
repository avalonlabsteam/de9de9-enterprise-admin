// COMPTABILITÉ — « Paiements en ligne » (guide 18): de9de9's accounting view of
// the card payments (CIB / Edahabia via GuiddiniPay) of every client company.
//   list     GET /comptabilite/paiements          cards  GET …/paiements/totaux
//   export   GET …/paiements/export               bilan  GET /comptabilite/bilan
//   detail   GET …/paiements/{id}  (+ re-check, review, receipts — PaiementDialog)
// Every filter lives in the URL (?periode= | ?du=&au=, ?client=<companyId>,
// ?statut=, ?q=, ?tri=, ?page=, ?paiement=<id> for the dialog), so an alert or
// the credits drawer can deep-link here.
import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useT, type TKey } from '@/lib/i18n';
import { cn, isLiveId } from '@/lib/utils';
import { problemMessage } from '@/api/problem';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  BILAN_FALLBACK_NAME,
  bilanUrl,
  downloadBilan,
  exportPaiementsCsv,
  useComptaPaiements,
  useComptaTotaux,
  type ComptaFilters,
} from '../api/comptabilite';
import {
  PERIODS,
  STATUT_PILLS,
  TRIS,
  comptaProblem,
  isOrphanFlag,
  periodOf,
  statutPillOf,
  tonBadge,
  type PeriodKey,
  type StatutPill,
} from '../lib/comptabilite';
import type { Totaux } from '../schemas/paiement';
import { ClientFilter } from './ClientFilter';
import { PaiementDialog } from './PaiementDialog';
import { PdfPreviewDialog, type PdfPreview } from './PdfPreviewDialog';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;
const GRID_COLS = 'grid-cols-[1.05fr_1.7fr_1.5fr_1.05fr_1.35fr]';
const PILL = 'cursor-pointer rounded-full border-[1.5px] px-[13px] py-[7px] text-[12px] font-bold';
const PILL_ON = 'border-[#232838] bg-[#232838] text-white dark:border-de9-ink dark:bg-de9-ink dark:text-[#151923]';
const PILL_OFF = 'border-de9-line bg-card text-de9-slate';
const BTN_SECONDARY =
  'cursor-pointer rounded-[11px] border-[1.5px] border-de9-line bg-card px-4 py-[11px] text-[12.5px] font-bold text-de9-slate hover:bg-de9-row disabled:cursor-not-allowed disabled:opacity-60';
const INPUT_CLS =
  'rounded-[11px] border-[1.5px] border-de9-line bg-card px-3 py-2 text-[12.5px] font-semibold text-de9-slate outline-none';
const LINK_CLS = 'cursor-pointer underline decoration-[#C7CFD7] decoration-dotted underline-offset-[3px]';

type CardKey = Exclude<keyof Totaux, 'mention'>;

const CARDS: ReadonlyArray<{ key: CardKey; labelKey: TKey; pill: StatutPill }> = [
  { key: 'approuves', labelKey: 'comptaCarteEncaisse', pill: 'approuve' },
  { key: 'enAttente', labelKey: 'comptaCarteEnAttente', pill: 'en_attente' },
  { key: 'aVerifier', labelKey: 'comptaCarteAVerifier', pill: 'a_verifier' },
  { key: 'refuses', labelKey: 'comptaCarteRefuses', pill: 'refuse' },
  { key: 'expires', labelKey: 'comptaCarteExpires', pill: 'expire' },
  { key: 'echecs', labelKey: 'comptaCarteEchecs', pill: 'echec_initiation' },
];

/** Inner clickables must not also open the row's dialog. */
const stop =
  (fn: () => void) =>
  (ev: MouseEvent): void => {
    ev.stopPropagation();
    fn();
  };

export function ComptabilitePage() {
  const t = useT();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();

  // ---- filters, from the URL ----
  const period = periodOf(sp);
  const { du, au } = period;
  const statut = statutPillOf(sp.get('statut'));
  const statutWire = STATUT_PILLS.find((p) => p.key === statut)?.wire;
  // `?client=` is a company id here; a name there belongs to the client fiche overlay.
  const clientParam = sp.get('client');
  const clientId = clientParam && isLiveId(clientParam) ? clientParam : '';
  const q = sp.get('q') ?? '';
  const triParam = sp.get('tri');
  const tri = TRIS.some((x) => x.key === triParam) ? (triParam ?? 'date') : 'date';
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const paiementId = sp.get('paiement');

  /** Filters replace (« back » leaves the page, not each filter); the dialog pushes. */
  const patch = (changes: Record<string, string | null>, push = false): void => {
    setSp(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: !push },
    );
  };

  // ---- search, debounced into ?q= ----
  const [searchInput, setSearchInput] = useState(q);
  useEffect(() => {
    const id = setTimeout(() => {
      const next = searchInput.trim().slice(0, 128);
      if (next !== q) patch({ q: next || null, page: null });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
    // `patch` is rebuilt each render; only the typed text drives this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const filters = useMemo<ComptaFilters>(
    () => ({
      du: du || undefined,
      au: au || undefined,
      clientId: clientId || undefined,
      statut: statutWire,
      q: q || undefined,
      tri: tri === 'date' ? undefined : tri,
      page,
      pageSize: PAGE_SIZE,
    }),
    [du, au, clientId, statutWire, q, tri, page],
  );

  const listQ = useComptaPaiements(filters);
  const totauxQ = useComptaTotaux({ du: filters.du, au: filters.au, clientId: filters.clientId });
  const rows = listQ.data?.data ?? [];
  const meta = listQ.data?.meta;
  const totaux = totauxQ.data;

  // ---- period ----
  const setPeriod = (key: PeriodKey): void => {
    setBilanError(null);
    if (key === 'perso') patch({ periode: 'perso', du: du || null, au: au || null, page: null });
    else patch({ periode: key, du: null, au: null, page: null });
  };
  const setBound = (bound: 'du' | 'au', value: string): void => {
    setBilanError(null);
    patch({ periode: 'perso', du: bound === 'du' ? value || null : du || null, au: bound === 'au' ? value || null : au || null, page: null });
  };

  // ---- export, bilan ----
  const [exporting, setExporting] = useState(false);
  const [bilanBusy, setBilanBusy] = useState(false);
  const [bilanError, setBilanError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PdfPreview | null>(null);
  const bilanReady = !!du && !!au;

  const onExport = (): void => {
    setExporting(true);
    exportPaiementsCsv(filters, t('comptaExportErreur'))
      .then((fileName) => {
        if (fileName.includes('tronque')) toast.warning(t('comptaExportTronque'));
      })
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : t('comptaExportErreur')))
      .finally(() => setExporting(false));
  };

  const onBilan = (): void => {
    if (!bilanReady) return;
    setBilanError(null);
    setBilanBusy(true);
    downloadBilan({ du, au, clientId: filters.clientId }, t('comptaBilanErreur'))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : t('comptaBilanErreur');
        // A bad period is said next to the period; anything else is a toast.
        if (comptaProblem(err).status === 400) setBilanError(message);
        else toast.error(message);
      })
      .finally(() => setBilanBusy(false));
  };

  const onBilanPreview = (): void => {
    if (!bilanReady) return;
    setBilanError(null);
    setPreview({
      title: t('comptaBilanTitre').replace('{du}', du).replace('{au}', au),
      url: bilanUrl({ du, au, clientId: filters.clientId }),
      fileName: BILAN_FALLBACK_NAME,
    });
  };

  const refresh = (): void => {
    void listQ.refetch();
    void totauxQ.refetch();
  };

  // ---- cards ----
  const cardFigure = (key: CardKey): string => {
    const b = totaux?.[key];
    if (!b) return '—';
    return key === 'approuves' ? (b.totalDzdLabel ?? String(b.totalDzd ?? 0)) : String(b.nombre);
  };
  const cardSub = (key: CardKey): string | null => {
    const b = totaux?.[key];
    if (!b) return null;
    if (key === 'approuves') {
      return [t('comptaNPaiements').replace('{n}', String(b.nombre)), b.totalCreditsLabel].filter(Boolean).join(' · ');
    }
    if (key === 'enAttente' || key === 'aVerifier') return b.totalDzdLabel ?? null;
    return null;
  };

  return (
    <div>
      {/* ===== header ===== */}
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-[23px] font-extrabold">{t('comptaTitre')}</div>
          <div className="mt-[2px] text-[13.5px] text-de9-gray">{t('comptaSub')}</div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={refresh}
            disabled={listQ.isFetching}
            aria-label={t('comptaActualiser')}
            title={t('comptaActualiser')}
            className={cn(BTN_SECONDARY, 'px-3')}
          >
            <RefreshCw className={cn('size-4', listQ.isFetching && 'animate-spin')} />
          </button>
          <button type="button" onClick={onExport} disabled={exporting} className={BTN_SECONDARY}>
            ⤓ {exporting ? t('docTelechargementEnCours') : t('comptaExportCsv')}
          </button>
          {/* « ⤓ Bilan PDF ▾ » — download by default, preview from the menu */}
          <div className="flex">
            <button
              type="button"
              onClick={onBilan}
              disabled={!bilanReady || bilanBusy}
              title={bilanReady ? undefined : t('comptaBilanPeriodeRequise')}
              className={cn(BTN_SECONDARY, 'rounded-e-none border-e-0')}
            >
              ⤓ {bilanBusy ? t('docTelechargementEnCours') : t('comptaBilanPdf')}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild disabled={!bilanReady}>
                <button
                  type="button"
                  aria-label={t('comptaBilanOptions')}
                  className={cn(BTN_SECONDARY, 'rounded-s-none px-2.5')}
                >
                  <ChevronDown className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[160px]">
                <DropdownMenuItem onSelect={onBilan} className="cursor-pointer text-[12.5px] font-semibold">
                  ⤓ {t('telecharger')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onBilanPreview} className="cursor-pointer text-[12.5px] font-semibold">
                  👁 {t('comptaApercu')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* ===== period · client · search ===== */}
      <div className="mt-4 flex flex-wrap items-center gap-[9px]">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={period.key === p.key}
            onClick={() => setPeriod(p.key)}
            className={cn(PILL, period.key === p.key ? PILL_ON : PILL_OFF)}
          >
            {t(p.labelKey)}
          </button>
        ))}
        {period.key === 'perso' && (
          <>
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-de9-gray">
              {t('fcDu')}
              <input
                type="date"
                value={du}
                max={au || undefined}
                onChange={(e) => setBound('du', e.target.value)}
                className={INPUT_CLS}
              />
            </label>
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-de9-gray">
              {t('fcAu')}
              <input
                type="date"
                value={au}
                min={du || undefined}
                onChange={(e) => setBound('au', e.target.value)}
                className={INPUT_CLS}
              />
            </label>
          </>
        )}
        {bilanError && <span className="text-[12px] font-semibold text-de9-red">{bilanError}</span>}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-[9px]">
        <ClientFilter clientId={clientId} onChange={(id) => patch({ client: id, page: null })} />
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          maxLength={128}
          placeholder={t('comptaRecherche')}
          aria-label={t('comptaRecherche')}
          className="min-w-0 flex-1 rounded-[11px] border-[1.5px] border-de9-line bg-card px-[15px] py-2.5 text-[12.5px] text-de9-ink outline-none sm:max-w-[420px]"
        />
      </div>

      {/* ===== cards — GET /comptabilite/paiements/totaux ===== */}
      <div className="mt-4 grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-6">
        {CARDS.map((c) => {
          const warn = c.key === 'aVerifier' && (totaux?.aVerifier.nombre ?? 0) > 0;
          const active = statut === c.pill;
          const sub = cardSub(c.key);
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => patch({ statut: active ? null : c.pill, page: null })}
              title={c.key === 'approuves' ? t('comptaEncaisseInfo') : undefined}
              className={cn(
                'cursor-pointer rounded-2xl border bg-card px-[18px] py-4 text-start shadow-[0_6px_18px_rgba(38,50,69,.04)]',
                warn ? 'border-[#E6C77E] dark:border-[#B68A2E]/60' : 'border-de9-line',
                active && 'ring-2 ring-[#232838] dark:ring-de9-ink',
              )}
            >
              <div className="text-xs font-semibold text-de9-gray">
                {t(c.labelKey)}
                {c.key === 'approuves' && <span className="ms-1 text-[10.5px]">ⓘ</span>}
              </div>
              <div
                className={cn(
                  'mt-1.5 truncate text-[23px] font-extrabold',
                  c.key === 'approuves' ? 'text-[#2FA86A] dark:text-[#6FCF97]' : warn ? 'text-[#B68A2E] dark:text-[#D9B36A]' : 'text-de9-ink',
                )}
              >
                {cardFigure(c.key)}
                {warn && <span className="ms-1.5 text-[16px]">⚠</span>}
              </div>
              <div className="min-h-[15px] truncate text-[11px] text-de9-gray">{sub ?? ' '}</div>
            </button>
          );
        })}
      </div>
      <div className="mt-2 text-[11.5px] font-semibold text-de9-gray">{totaux?.mention ?? t('comptaMentionBrut')}</div>

      {/* ===== status pills · sort ===== */}
      <div className="mt-4 flex flex-wrap items-center gap-[9px]">
        {STATUT_PILLS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={statut === p.key}
            onClick={() => patch({ statut: p.key === 'tous' ? null : p.key, page: null })}
            className={cn(PILL, 'px-[15px] py-[9px] text-[12.5px]', statut === p.key ? PILL_ON : PILL_OFF)}
          >
            {t(p.labelKey)}
          </button>
        ))}
        <label className="ms-auto flex items-center gap-1.5 text-[12px] font-semibold text-de9-gray">
          {t('fcTri')}
          <select
            value={tri}
            onChange={(e) => patch({ tri: e.target.value === 'date' ? null : e.target.value, page: null })}
            className={INPUT_CLS}
          >
            {TRIS.map((o) => (
              <option key={o.key} value={o.key}>
                {t(o.labelKey)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* ===== list ===== */}
      <div className="mt-3.5 overflow-hidden rounded-[18px] border border-de9-line bg-card shadow-[0_10px_30px_rgba(38,50,69,.06)]">
        <div className={cn('overflow-x-auto transition-opacity', listQ.isPlaceholderData && 'opacity-60')}>
          <div className="min-w-[900px]">
            <div
              className={cn(
                'grid gap-3 border-b border-de9-line bg-secondary px-[22px] py-[13px] text-[10.5px] font-bold tracking-[.04em] text-de9-gray uppercase',
                GRID_COLS,
              )}
            >
              <div>{t('comptaColDate')}</div>
              <div>{t('comptaColEntreprise')}</div>
              <div>{t('comptaPayePar')}</div>
              <div className="text-end">{t('comptaColMontant')}</div>
              <div>{t('comptaColStatut')}</div>
            </div>

            {listQ.isPending && (
              <div className="px-[22px] py-3.5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="mb-3 h-11 animate-pulse rounded-[10px] bg-de9-row last:mb-0" />
                ))}
              </div>
            )}

            {listQ.isError && (
              <div className="px-[22px] py-4 text-[12.5px] font-semibold text-de9-red">
                {t('comptaErreurListe')} — {problemMessage(listQ.error)}
              </div>
            )}

            {rows.map((r) => {
              const e = r.entreprise;
              const proof = [r.approvalCode && `${t('comptaAut')} ${r.approvalCode}`, r.panMasque].filter(Boolean).join(' · ');
              return (
                <div
                  key={r.id}
                  onClick={() => patch({ paiement: r.id }, true)}
                  className={cn(
                    'grid cursor-pointer items-start gap-3 border-b border-de9-line px-[22px] py-3.5 hover:bg-secondary/60',
                    GRID_COLS,
                  )}
                >
                  <div className="min-w-0">
                    <div className="text-[12.5px] text-de9-slate">{r.payeLeLabel ?? r.creeLeLabel ?? '—'}</div>
                    <div className="mt-0.5 font-mono text-[12px] font-bold text-de9-ink">{r.reference}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold" title={e?.rc ? `RC ${e.rc}` : undefined}>
                      {e?.id ? (
                        <span
                          onClick={stop(() => navigate(`/entreprises/${encodeURIComponent(e.id ?? '')}?cote=client`))}
                          className={LINK_CLS}
                        >
                          {e.raisonSociale ?? '—'}
                        </span>
                      ) : (
                        (e?.raisonSociale ?? '—')
                      )}
                    </div>
                    {e?.nif && <div className="mt-0.5 font-mono text-[11.5px] text-de9-gray">NIF {e.nif}</div>}
                  </div>
                  <div className="min-w-0" title={r.payeur?.telephone ?? undefined}>
                    <div className="truncate text-[13px] text-de9-ink">{r.payeur?.nom ?? '—'}</div>
                    {r.payeur?.email && <div className="mt-0.5 truncate text-[11.5px] text-de9-gray">{r.payeur.email}</div>}
                  </div>
                  <div className="text-end">
                    <div className="text-[13.5px] font-extrabold text-de9-ink">{r.montantLabel ?? '—'}</div>
                    {r.creditsLabel && <div className="mt-0.5 text-[11.5px] text-de9-gray">{r.creditsLabel}</div>}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={cn('rounded-full px-[9px] py-1 text-[11px] font-bold', tonBadge(r.ton))}>
                        {r.statutLabel ?? r.statut}
                      </span>
                      {r.drapeau && (
                        <span
                          title={r.drapeauLabel ?? r.drapeau}
                          className={cn(
                            'rounded-full px-[9px] py-1 text-[11px] font-bold',
                            isOrphanFlag(r.drapeau)
                              ? 'bg-[#FDECEC] text-de9-red dark:bg-[#E7464E]/15'
                              : 'bg-[#FBF4E4] text-[#B68A2E] dark:bg-[#B68A2E]/15 dark:text-[#D9B36A]',
                          )}
                        >
                          ⚠ {isOrphanFlag(r.drapeau) ? t('comptaOrpheline') : t('comptaCarteAVerifier')}
                        </span>
                      )}
                    </div>
                    {r.drapeauLabel && <div className="mt-1 line-clamp-2 text-[11px] text-de9-gray">{r.drapeauLabel}</div>}
                    {proof && <div className="mt-1 font-mono text-[11px] text-de9-gray">{proof}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {listQ.isSuccess && rows.length === 0 && (
          <div className="px-[22px] py-10 text-center text-[13px] text-de9-gray">{t('comptaAucun')}</div>
        )}

        {meta && meta.total_pages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-de9-line px-[22px] py-3">
            <div className="text-[12.5px] font-semibold text-de9-gray">
              {t('worklistPageInfo').replace('{n}', String(meta.current_page)).replace('{m}', String(meta.total_pages))}
              {' · '}
              {t('comptaNPaiements').replace('{n}', String(meta.total))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => patch({ page: page > 2 ? String(page - 1) : null })}
                className="cursor-pointer rounded-[11px] border-[1.5px] border-de9-line bg-card px-[13px] py-2 text-[12.5px] font-bold text-de9-slate disabled:cursor-default disabled:opacity-40"
              >
                {t('pagePrecedent')}
              </button>
              <button
                type="button"
                disabled={!meta.has_more_pages}
                onClick={() => patch({ page: String(page + 1) })}
                className="cursor-pointer rounded-[11px] border-[1.5px] border-de9-line bg-card px-[13px] py-2 text-[12.5px] font-bold text-de9-slate disabled:cursor-default disabled:opacity-40"
              >
                {t('pageSuivant')}
              </button>
            </div>
          </div>
        )}
      </div>

      {paiementId && <PaiementDialog id={paiementId} onClose={() => patch({ paiement: null })} />}
      {preview && <PdfPreviewDialog preview={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
