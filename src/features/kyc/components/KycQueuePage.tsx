// KYC — the review queue:
//   list    GET /kyc?statut=&soumis=&q=&page=&pageSize=   (oldest submission first)
//   cards   GET /kyc/kpis                                  (also the sidebar badge)
// Tab, search and page live in the URL, so « Retour » from a review screen
// lands on the queue exactly as it was left.
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Circle, Dot, Repeat, X, type LucideIcon } from 'lucide-react';
import { Glyph } from '@/components/common/Glyph';
import { cn } from '@/lib/utils';
import { useT, type TKey } from '@/lib/i18n';
import { KYC_TAB_QUERY, useKycKpis, useKycQueue, type KycQueueParams, type KycTab } from '../api/kyc';
import { KYC_KINDS, type KycDossier, type KycKpis } from '../schemas/kyc';
import {
  TONES,
  docStatutLabel,
  docTone,
  dossierStatutLabel,
  dossierToneName,
  fmtDate,
  kindLong,
  kindShort,
  kycErrorMessage,
  waitLabel,
} from '../lib/kyc';
import type { KycBackState } from './KycReviewPage';
import { ProgressBar, StatusPill, Tag } from './shared';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const GRID_COLS = 'grid-cols-[1.8fr_1.25fr_1.1fr_1.6fr_1.15fr_104px]';

const TABS: ReadonlyArray<{ key: KycTab; labelKey: TKey; count: (k: KycKpis) => number }> = [
  { key: 'aExaminer', labelKey: 'kycTabAExaminer', count: (k) => k.aExaminer },
  { key: 'nonSoumis', labelKey: 'kycTabNonSoumis', count: (k) => k.nonSoumis },
  { key: 'verifies', labelKey: 'kycTabVerifies', count: (k) => k.verifies },
  { key: 'aCorriger', labelKey: 'kycTabACorriger', count: (k) => k.rejetes },
  { key: 'tous', labelKey: 'tous', count: (k) => k.total },
];

const DEFAULT_TAB: KycTab = 'tous';

/**
 * `?tab=`, else the API's own filters — an alert's fallback path is
 * `/kyc?statut=pending&soumis=true` (guide 11a §6, adm.kyc), i.e. « À examiner ».
 */
function tabOf(params: URLSearchParams): KycTab {
  const byKey = TABS.find((x) => x.key === params.get('tab'))?.key;
  if (byKey) return byKey;
  const statut = params.get('statut');
  if (!statut) return DEFAULT_TAB;
  const soumis = params.get('soumis');
  const byFilters = TABS.find(({ key }) => {
    const f = KYC_TAB_QUERY[key];
    return f.statut === statut && (f.soumis === undefined || String(f.soumis) === soumis);
  });
  return byFilters?.key ?? DEFAULT_TAB;
}

interface Card {
  key: string;
  tab: KycTab;
  labelKey: TKey;
  color: string;
  value: (k: KycKpis) => number | null | undefined;
  sub: (k: KycKpis, t: (key: TKey) => string) => string;
  /** Red border while there is work waiting. */
  alert?: (k: KycKpis) => boolean;
}

const CARDS: ReadonlyArray<Card> = [
  {
    key: 'aExaminer',
    tab: 'aExaminer',
    labelKey: 'kycKpiAExaminer',
    color: '#E6A53A',
    value: (k) => k.aExaminer,
    sub: (k, t) =>
      t('kycKpiAExaminerSub')
        .replace('{n}', String(k.revueEnCours ?? 0))
        .replace('{m}', String(k.resoumis ?? 0)),
    alert: (k) => k.aExaminer > 0,
  },
  {
    key: 'pieces',
    tab: 'aExaminer',
    labelKey: 'kycKpiPieces',
    color: '#2F7FD0',
    value: (k) => k.piecesAVerifier,
    sub: (_k, t) => t('kycKpiPiecesSub'),
  },
  {
    key: 'aCorriger',
    tab: 'aCorriger',
    labelKey: 'kycKpiACorriger',
    color: '#E7464E',
    value: (k) => k.rejetes,
    sub: (_k, t) => t('kycKpiACorrigerSub'),
  },
  {
    key: 'nonSoumis',
    tab: 'nonSoumis',
    labelKey: 'kycKpiNonSoumis',
    color: '#9AA4B2',
    value: (k) => k.nonSoumis,
    sub: (_k, t) => t('kycKpiNonSoumisSub'),
  },
  {
    key: 'verifies',
    tab: 'verifies',
    labelKey: 'kycKpiVerifies',
    color: '#2FA86A',
    value: (k) => k.verifies,
    sub: (k, t) => t('kycKpiVerifiesSub').replace('{n}', String(k.total)),
  },
];

/** A glyph next to each chip colour, so the state reads without colour too. */
const DOC_GLYPH: Record<string, LucideIcon | undefined> = { valide: Check, refuse: X, a_verifier: Dot, manquant: Circle };

export function KycQueuePage() {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabOf(searchParams);
  const q = searchParams.get('q') ?? '';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const [searchInput, setSearchInput] = useState(q);

  /** Replace, not push: « Retour » from a review goes back to the queue, not through every tab. */
  const patchParams = (patch: Record<string, string | null>): void => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(patch)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    const next = searchInput.trim();
    if (next === q) return;
    const id = setTimeout(() => {
      setSearchParams(
        (prev) => {
          const sp = new URLSearchParams(prev);
          if (next) sp.set('q', next);
          else sp.delete('q');
          sp.delete('page');
          return sp;
        },
        { replace: true },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput, q, setSearchParams]);

  const params = useMemo<KycQueueParams>(
    () => ({ tab, q: q || undefined, page, pageSize: PAGE_SIZE }),
    [tab, q, page],
  );
  const listQ = useKycQueue(params);
  const kpisQ = useKycKpis();
  const kpis = kpisQ.data;
  const rows = listQ.data?.data ?? [];
  const meta = listQ.data?.meta;

  // Picking a tab drops an alert's `statut`/`soumis`, which would otherwise win over « Tous ».
  const setTab = (key: KycTab): void =>
    patchParams({ tab: key === DEFAULT_TAB ? null : key, page: null, statut: null, soumis: null });
  const setPage = (n: number): void => patchParams({ page: n > 1 ? String(n) : null });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-[23px] font-extrabold">{t('kycTitre')}</div>
          <div className="mt-[2px] text-[13.5px] text-de9-gray">{t('kycSub')}</div>
        </div>
      </div>

      {/* ===== cards — GET /kyc/kpis ===== */}
      <div className="mt-[18px] grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-5">
        {CARDS.map((c) => {
          const value = kpis ? c.value(kpis) : undefined;
          const active = c.key === tab;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setTab(c.tab)}
              className={cn(
                'cursor-pointer rounded-md border bg-card px-[17px] py-[15px] text-start',
                kpis && c.alert?.(kpis) ? 'border-[#F6D2D4] dark:border-[#E7464E]/40' : 'border-de9-line',
              )}
              style={active ? { borderColor: c.color } : undefined}
            >
              <div className="flex items-center gap-2">
                <div className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: c.color }} />
                <div className="text-[12.5px] font-semibold text-de9-gray">{t(c.labelKey)}</div>
              </div>
              <div className="mt-2 text-[28px] leading-none font-extrabold" style={{ color: c.color }}>
                {value ?? '—'}
              </div>
              <div className="mt-1.5 text-[11px] leading-[1.35] text-de9-gray">{kpis ? c.sub(kpis, t) : '\u00a0'}</div>
            </button>
          );
        })}
      </div>

      {/* ===== search + tabs ===== */}
      <div className="mt-4 flex flex-wrap items-center gap-[9px]">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('kycRecherche')}
          aria-label={t('kycRecherche')}
          className="w-full flex-none rounded-xs border border-outline bg-card px-[15px] py-2.5 text-[12.5px] text-de9-ink outline-none sm:w-[320px]"
        />
        {TABS.map((tb) => {
          const active = tab === tb.key;
          return (
            <button
              key={tb.key}
              type="button"
              onClick={() => setTab(tb.key)}
              aria-pressed={active}
              className={cn(
                'cursor-pointer rounded-full border px-[15px] py-[9px] text-[12.5px] font-bold',
                active ? 'border-secondary-container bg-secondary-container text-on-secondary-container' : 'border-de9-line bg-card text-de9-slate',
              )}
            >
              {t(tb.labelKey)} · {kpis ? tb.count(kpis) : '—'}
            </button>
          );
        })}
      </div>

      {/* ===== table ===== */}
      <div className="mt-3.5 overflow-hidden rounded-md border border-de9-line bg-card">
        <div className={cn('overflow-x-auto transition-opacity', listQ.isPlaceholderData && 'opacity-60')}>
          <div className="min-w-[940px]">
            <div
              className={`grid ${GRID_COLS} gap-3 border-b border-de9-line bg-secondary px-[22px] py-[13px] text-[10.5px] font-bold tracking-[.04em] text-de9-gray uppercase`}
            >
              <div>{t('kycColEntreprise')}</div>
              <div>{t('kycColPieces')}</div>
              <div>{t('kycColProgression')}</div>
              <div>{t('kycColStatut')}</div>
              <div>{t('kycColSoumis')}</div>
              <div />
            </div>

            {listQ.isPending && (
              <div className="px-[22px] py-3.5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="mb-3 h-10 animate-pulse rounded-sm bg-de9-row last:mb-0" />
                ))}
              </div>
            )}

            {listQ.isError && (
              <div className="px-[22px] py-4 text-[12.5px] font-semibold text-de9-red">
                {t('kycErreurListe')} — {kycErrorMessage(listQ.error, t)}
              </div>
            )}

            {rows.map((d) => (
              <QueueRow key={d.companyId} dossier={d} />
            ))}
          </div>
        </div>

        {listQ.isSuccess && rows.length === 0 && (
          <div className="p-11 text-center text-sm text-de9-gray">
            {!q && tab === 'aExaminer' ? t('kycAucunAExaminer') : t('kycAucun')}
          </div>
        )}

        {meta && meta.total_pages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-de9-line px-[22px] py-3">
            <div className="text-[12.5px] font-semibold text-de9-gray">
              {t('worklistPageInfo').replace('{n}', String(meta.current_page)).replace('{m}', String(meta.total_pages))}
              {' · '}
              {meta.total} {t('kycCount')}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="cursor-pointer rounded-full border border-de9-line bg-card px-[13px] py-2 text-[12.5px] font-bold text-de9-slate disabled:cursor-default disabled:opacity-40"
              >
                {t('pagePrecedent')}
              </button>
              <button
                type="button"
                disabled={!meta.has_more_pages}
                onClick={() => setPage(page + 1)}
                className="cursor-pointer rounded-full border border-de9-line bg-card px-[13px] py-2 text-[12.5px] font-bold text-de9-slate disabled:cursor-default disabled:opacity-40"
              >
                {t('pageSuivant')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** One dossier — the whole row opens its review screen. */
function QueueRow({ dossier: d }: { dossier: KycDossier }) {
  const t = useT();
  const enRevue = !!d.enRevue;
  const roles = (d.roles ?? []).map((role) =>
    role === 'Client' ? t('roleClient') : role === 'Prestataire' ? t('rolePrestataire') : role,
  );
  const sub = [roles.join(' · '), d.email].filter(Boolean).join(' · ') || (d.rc ? `RC ${d.rc}` : '');
  const wait = enRevue ? waitLabel(d.soumisLe, t) : null;

  return (
    <Link
      to={`/kyc/${encodeURIComponent(d.companyId)}`}
      state={{ fromQueue: true } satisfies KycBackState}
      className={`grid ${GRID_COLS} items-center gap-3 border-b border-de9-line px-[22px] py-3.5 text-de9-ink no-underline last:border-b-0 hover:bg-de9-row`}
    >
      <div className="min-w-0">
        <div dir="auto" className="truncate text-[13px] font-extrabold ltr:text-left rtl:text-right">
          {d.nom}
        </div>
        {sub && <div className="truncate text-[11px] text-de9-gray">{sub}</div>}
      </div>

      {/* RC / NIF / NIS — grey manquant, blue à vérifier, green validé, red refusé */}
      <div className="flex flex-wrap gap-1.5">
        {KYC_KINDS.map((kind) => {
          const doc = d.documents?.find((x) => x.kind === kind);
          const statut = doc?.statut ?? 'manquant';
          const StatutIcon = DOC_GLYPH[statut];
          return (
            <span
              key={kind}
              title={`${kindLong(kind, doc?.kindLabel, t)} · ${docStatutLabel(statut, doc?.statutLabel, t)}`}
              className={cn(
                'inline-flex items-center gap-1 rounded-sm px-1.5 py-[3px] text-[10.5px] font-extrabold',
                docTone(statut).chip,
              )}
            >
              {kindShort(kind)}
              {StatutIcon && <Glyph icon={StatutIcon} />}
            </span>
          );
        })}
      </div>

      <div className="min-w-0">
        {d.progression ? (
          <>
            <div className="text-[12px] font-bold">
              <bdi>{d.progression.libelle ?? `${d.progression.valides} / ${d.progression.total}`}</bdi>
            </div>
            <ProgressBar progression={d.progression} className="mt-1.5 max-w-[130px]" />
          </>
        ) : (
          <span className="text-[12px] text-de9-gray">—</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusPill
          tone={TONES[dossierToneName(d.statut, d.enRevue)]}
          label={dossierStatutLabel(d.statut, d.statutLabel, t)}
        />
        {d.statut === 'pending' && !enRevue && <Tag tone="grey">{t('kycTagNonSoumis')}</Tag>}
        {d.revueCommencee && <Tag>{t('kycTagRevueEnCours')}</Tag>}
        {d.resoumission && (
          <Tag tone="amber">
            <Glyph icon={Repeat} className="me-1" />
            {t('kycTagRenvoye')}
          </Tag>
        )}
      </div>

      <div className="text-[12px] text-de9-slate">
        {d.soumisLe ? fmtDate(d.soumisLe, t) : '—'}
        {wait && <div className="text-[10.5px] text-de9-gray">{t('kycDepuis').replace('{n}', wait)}</div>}
      </div>

      <div className="text-end">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-4 py-2 text-[11.5px] font-bold',
            enRevue
              ? 'bg-secondary-container text-on-secondary-container'
              : 'border border-de9-line bg-secondary text-de9-slate',
          )}
        >
          {enRevue ? t('kycExaminer') : t('kycOuvrir')}
        </span>
      </div>
    </Link>
  );
}
