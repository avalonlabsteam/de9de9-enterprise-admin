// CRÉDITS — ledger page, driven by GET /credits. The server filters (Q/Type)
// and paginates; this page maps UI state to query params and renders rows.
// The mock twin lives in src/api/mock/handlers.ts.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useT, useL, type TKey } from '@/lib/i18n';
import { useLangStore, type Lang } from '@/stores/langStore';
import { cn } from '@/lib/utils';
import type { CreditLedgerItem, CreditsLedgerParams, CreditType, PieceFile } from '../schemas/credit';
import { useCreditsLedger } from '../api/credits';
import { RechargeModal, type RechargeDocs, type RechargeModalState } from './RechargeModal';
import { PieceViewer, type PieceView } from './PieceViewer';

/* ---- date helper (logic.ts dayName/withDay, re-derived from occurredAt so
   the day name follows the UI language — the server's `date` string is
   pre-formatted in French) ---- */
const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function dateLabel(iso: string, lang: Lang): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  const day = (lang === 'ar' ? DAYS_AR : DAYS_FR)[dt.getDay()];
  const p = (n: number) => String(n).padStart(2, '0');
  return `${day} ${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()}`;
}

/* ---- static derivations ported from logic.ts buildCredits() ---- */
type CreditFilter = 'all' | CreditType;

const TYPE_BADGE: Record<CreditType, { labelKey: TKey; cls: string }> = {
  rech: { labelKey: 'creditsRecharge', cls: 'bg-[#E7F6EE] text-[#2FA86A]' },
  deb: { labelKey: 'creditsDebitFacture', cls: 'bg-[#FDECEC] text-de9-red' },
  vers: { labelKey: 'creditsVersement', cls: 'bg-[#EAF2FD] text-[#2F7FD0]' },
};

// Placeholder amounts — the API has no credits stats endpoint yet.
const TOTALS: ReadonlyArray<{ labelKey: TKey; value: string; subKey: TKey; colorCls: string }> = [
  { labelKey: 'creditsVendus', value: '250 000', subKey: 'creditsCeMois', colorCls: 'text-[#2FA86A] dark:text-[#6FCF97]' },
  { labelKey: 'creditsDepenses', value: '85 000', subKey: 'creditsCeMois', colorCls: 'text-de9-red' },
  { labelKey: 'creditsVersementsPro', value: '36 550', subKey: 'creditsCeMois', colorCls: 'text-[#2F7FD0] dark:text-[#7EB5EC]' },
  { labelKey: 'creditsMarge', value: '~ 12 750', subKey: 'creditsEstime', colorCls: 'text-de9-ink' },
];

const FILTERS: ReadonlyArray<{ key: CreditFilter; labelKey: TKey }> = [
  { key: 'all', labelKey: 'tous' },
  { key: 'rech', labelKey: 'creditsRecharges' },
  { key: 'deb', labelKey: 'creditsDebits' },
  { key: 'vers', labelKey: 'creditsVersements' },
];

const GRID_COLS = 'grid-cols-[1fr_1.2fr_1.8fr_1.4fr_1fr_1.1fr_1fr]';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

/** Ledger page — historique des crédits (recharges, débits facture, versements pro). */
export function CreditsPage() {
  const t = useT();
  const l = useL();
  const lang = useLangStore((s) => s.lang);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filter, setFilter] = useState<CreditFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<RechargeModalState | null>(null);
  const [piece, setPiece] = useState<PieceView | null>(null);
  // client-side pieces edited via the docs mode (prototype state.rechargeDocs)
  const [docsOverride, setDocsOverride] = useState<Record<string, RechargeDocs>>({});

  useEffect(() => {
    const id = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  const params = useMemo<CreditsLedgerParams>(() => {
    const p: CreditsLedgerParams = { page, pageSize: PAGE_SIZE };
    if (q) p.q = q;
    if (filter !== 'all') p.type = filter;
    return p;
  }, [q, filter, page]);

  const ledgerQ = useCreditsLedger(params);
  const rows = ledgerQ.data?.data ?? [];
  const meta = ledgerQ.data?.meta;

  const setFilterKey = (key: CreditFilter): void => {
    setFilter(key);
    setPage(1);
  };

  const docsOf = (e: CreditLedgerItem): RechargeDocs =>
    docsOverride[e.ref] ?? { justif: e.justif ?? null, facture: e.facture ?? null };

  // ---- overlays that survive navigation (client fiche / prestataire profile) ----
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

  const saveDocs = (ref: string, docs: RechargeDocs): void => {
    setDocsOverride((cur) => ({ ...cur, [ref]: docs }));
    setModal(null);
  };

  /* ---- pieces chip (🧾 present / ⚠ manquant) ---- */
  const pieceChip = (
    e: CreditLedgerItem,
    file: PieceFile | null,
    kindLabel: string,
    title: string,
  ): React.ReactElement => {
    const present = !!file;
    return (
      <button
        type="button"
        onClick={() => {
          if (present && file) setPiece({ title, fileName: file.name });
          else {
            const d = docsOf(e);
            setModal({ mode: 'docs', ref: e.ref, client: e.client, justif: d.justif, facture: d.facture });
          }
        }}
        className={cn(
          'inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold',
          present
            ? 'border-[#BFE6D6] bg-[#E7F6EE] text-de9-teal-dark dark:border-[#2FA86A]/40 dark:bg-[#2FA86A]/15'
            : 'border-[#F0E2C0] bg-[#FBF4E4] text-[#B68A2E] dark:border-[#B68A2E]/40 dark:bg-[#B68A2E]/15 dark:text-[#D9B36A]',
        )}
      >
        {present ? '🧾' : '⚠'} {present ? `${kindLabel} ✓` : `${kindLabel} · ${t('manquant')}`}
      </button>
    );
  };

  return (
    <div>
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-[23px] font-extrabold">{t('historiqueCredits')}</div>
          <div className="mt-[2px] text-[13.5px] text-de9-gray">{t('creditsSub')}</div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => setModal({ mode: 'create' })}
            className="cursor-pointer rounded-[11px] bg-de9-teal-dark px-[18px] py-[11px] text-[12.5px] font-bold text-white shadow-[0_8px_18px_rgba(23,138,130,.32)]"
          >
            ＋ {t('nouvelleRecharge')}
          </button>
          <button
            type="button"
            className="cursor-pointer rounded-[11px] border-[1.5px] border-de9-line bg-card px-4 py-[11px] text-[12.5px] font-bold text-de9-slate"
          >
            ⤓ {t('exportCsv')}
          </button>
        </div>
      </div>

      {/* structure notice */}
      <div className="mt-3.5 inline-flex items-center gap-[7px] rounded-[10px] border border-[#F0E2C0] bg-[#FBF4E4] px-[13px] py-2 text-[11.5px] font-bold text-[#B68A2E] dark:border-[#B68A2E]/40 dark:bg-[#B68A2E]/15 dark:text-[#D9B36A]">
        ⚠ {t('donneesAVenir')}
      </div>

      {ledgerQ.isPending ? (
        <div className="mt-4 animate-pulse">
          <div className="grid grid-cols-2 gap-3.5 md:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[104px] rounded-2xl border border-de9-line bg-card" />
            ))}
          </div>
          <div className="mt-3.5 h-64 rounded-[18px] border border-de9-line bg-card" />
        </div>
      ) : ledgerQ.isError ? (
        <div className="mt-4 rounded-xl border border-[#F3C9CB] bg-[#FDECEC] px-4 py-3 text-[12.5px] font-semibold text-de9-red dark:border-[#E7464E]/40 dark:bg-[#E7464E]/15">
          {l('Erreur de chargement des crédits', 'خطأ في تحميل الرصيد')}
        </div>
      ) : (
        <>
          {/* totals */}
          <div className="mt-4 grid grid-cols-2 gap-3.5 md:grid-cols-4">
            {TOTALS.map((tot) => (
              <div
                key={tot.labelKey}
                className="rounded-2xl border border-de9-line bg-card px-[18px] py-4 shadow-[0_6px_18px_rgba(38,50,69,.04)]"
              >
                <div className="text-xs font-semibold text-de9-gray">{t(tot.labelKey)}</div>
                <div className={cn('mt-1.5 text-[23px] font-extrabold', tot.colorCls)}>
                  {tot.value}
                </div>
                <div className="text-[11px] text-de9-gray">{t(tot.subKey)}</div>
              </div>
            ))}
          </div>

          {/* search + filters */}
          <div className="mt-4 flex flex-wrap items-center gap-[9px]">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('facSearch')}
              className="min-w-0 flex-1 rounded-[11px] border-[1.5px] border-de9-line bg-card px-[15px] py-2.5 text-[12.5px] text-de9-ink outline-none sm:flex-[0_0_300px]"
            />
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilterKey(f.key)}
                  className={cn(
                    'cursor-pointer rounded-full border-[1.5px] px-[15px] py-[9px] text-[12.5px] font-bold',
                    active
                      ? 'border-[#232838] bg-[#232838] text-white'
                      : 'border-de9-line bg-card text-de9-slate',
                  )}
                >
                  {t(f.labelKey)}
                </button>
              );
            })}
          </div>

          {/* ledger */}
          <div className="mt-3.5 overflow-hidden rounded-[18px] border border-de9-line bg-card shadow-[0_10px_30px_rgba(38,50,69,.06)]">
            <div className={cn('overflow-x-auto transition-opacity', ledgerQ.isPlaceholderData && 'opacity-60')}>
              <div className="min-w-[840px]">
                <div
                  className={cn(
                    'grid gap-3 border-b border-de9-line bg-secondary px-[22px] py-[13px] text-[10.5px] font-bold tracking-[.04em] text-de9-gray uppercase',
                    GRID_COLS,
                  )}
                >
                  <div>{t('lgDate')}</div>
                  <div>{t('lgType')}</div>
                  <div>{t('lgClient')}</div>
                  <div>{t('lgBenef')}</div>
                  <div>{t('lgRef')}</div>
                  <div className="text-end">{t('lgCredits')}</div>
                  <div className="text-end">{t('lgSolde')}</div>
                </div>
                {rows.map((e) => {
                  const badge = TYPE_BADGE[e.type];
                  const benef = e.benef ?? '—';
                  const cmdRef = e.cmdRef && e.cmdRef !== '—' ? e.cmdRef : '';
                  const isRech = e.type === 'rech';
                  const isVers = e.type === 'vers' && !!cmdRef;
                  const hasFacture = e.type === 'deb' && !!cmdRef;
                  const docs = docsOf(e);
                  const versTitle = `${t('factureServicePresta')} — ${benef}`;
                  const versFile = `facture-service-F-${cmdRef.replace(/[^0-9]/g, '')}-${benef}.pdf`;
                  return (
                    <div
                      key={e.id}
                      className={cn(
                        'grid items-center gap-3 border-b border-de9-line px-[22px] py-3.5',
                        GRID_COLS,
                      )}
                    >
                      <div className="text-[12.5px] text-de9-slate">{dateLabel(e.occurredAt, lang)}</div>
                      <div>
                        <span
                          className={cn(
                            'rounded-full px-[9px] py-1 text-[11px] font-bold',
                            badge.cls,
                          )}
                        >
                          {t(badge.labelKey)}
                        </span>
                      </div>
                      <div className="text-[13px] font-semibold">
                        <span
                          onClick={() => openClientFiche(e.client)}
                          className="cursor-pointer underline decoration-[#C7CFD7] decoration-dotted underline-offset-[3px]"
                        >
                          {e.client}
                        </span>
                      </div>
                      <div className="text-[12.5px] text-de9-slate">
                        <span
                          onClick={() => openPresByName(benef)}
                          className="cursor-pointer underline decoration-[#C7CFD7] decoration-dotted underline-offset-[3px]"
                        >
                          {benef}
                        </span>
                      </div>
                      <div className="text-[11.5px] text-de9-gray">
                        {e.ref}
                        {hasFacture && (
                          <span
                            onClick={() => navigate('/factures?client=' + encodeURIComponent(e.client))}
                            className="mt-[2px] block cursor-pointer text-[10.5px] font-bold text-[#2F7FD0] dark:text-[#7EB5EC]"
                          >
                            🧾 {t('voirFacture')} →
                          </span>
                        )}
                        {isVers && (
                          <span
                            onClick={() => setPiece({ title: versTitle, fileName: versFile })}
                            className="mt-[2px] block cursor-pointer text-[10.5px] font-bold text-[#2F7FD0] dark:text-[#7EB5EC]"
                          >
                            🧾 {t('voirFacturePresta')} →
                          </span>
                        )}
                        {isRech && (
                          <div className="mt-1.5 flex flex-wrap gap-[5px]">
                            {pieceChip(e, docs.justif, t('justifCourt'), t('pieceJustif'))}
                            {pieceChip(e, docs.facture, t('factureCourt'), t('pieceFacture'))}
                          </div>
                        )}
                      </div>
                      <div
                        className={cn(
                          'text-end text-[13.5px] font-extrabold',
                          e.credits > 0 ? 'text-[#2FA86A] dark:text-[#6FCF97]' : 'text-de9-red',
                        )}
                      >
                        {(e.credits > 0 ? '+' : '') + e.credits.toLocaleString('fr-FR')}
                      </div>
                      <div className="text-end text-[12.5px] text-de9-slate">{e.solde ?? '—'}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            {rows.length === 0 && (
              <div className="px-[22px] py-8 text-center text-[12.5px] text-de9-gray">
                {t('aucuneDonnee')}
              </div>
            )}

            {/* pagination footer */}
            {meta && meta.total_pages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-de9-line px-[22px] py-3">
                <div className="text-[12.5px] font-semibold text-de9-gray">
                  {t('worklistPageInfo')
                    .replace('{n}', String(meta.current_page))
                    .replace('{m}', String(meta.total_pages))}
                  {' · '}
                  {meta.total} {t('operationsCount')}
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

      {modal && (
        <RechargeModal
          state={modal}
          onClose={() => setModal(null)}
          onSaveDocs={saveDocs}
          onCreated={() => {
            setModal(null);
            setFilterKey('all');
          }}
        />
      )}
      {piece && <PieceViewer piece={piece} onClose={() => setPiece(null)} />}
    </div>
  );
}
