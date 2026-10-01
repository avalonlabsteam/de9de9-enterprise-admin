// ANALYTICS — credits analytics (GET /analytics) + platform overview
// (GET /admin/dashboard). Chart bars arrive as raw credit amounts; CreditsChart
// scales them to one shared axis.
import { useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, Star } from 'lucide-react';
import { Glyph } from '@/components/common/Glyph';
import { useT, useL, type TKey } from '@/lib/i18n';
import { useAdminDashboard, useAnalytics, type AnalyticsParams } from '../api/analytics';
import type { AnalyticsKpiKey, TopEntry } from '../schemas/analytics';
import { CreditsChart } from './CreditsChart';

/* ---- ported from logic.ts buildAnalytics(): period defs + KPI label/color maps ---- */

const PERIODS: { key: string; labelKey: TKey }[] = [
  { key: 'mois', labelKey: 'analyticsCeMois' },
  { key: 'annee', labelKey: 'analyticsCetteAnnee' },
  { key: 'perso', labelKey: 'analyticsPersonnalise' },
];

const KPI_LABEL_KEYS: Record<AnalyticsKpiKey, TKey> = {
  vendus: 'creditsVendus',
  depenses: 'creditsDepenses',
  verses: 'analyticsVersesAuxPros',
  marge: 'analyticsMarge',
  circulation: 'analyticsEnCirculation',
};

const KPI_COLORS: Record<AnalyticsKpiKey, string> = {
  vendus: 'text-[#2FA86A] dark:text-[#6FCF97]',
  depenses: 'text-[#E7464E] dark:text-[#F2848A]',
  verses: 'text-[#2F7FD0] dark:text-[#7EB5EC]',
  marge: 'text-de9-ink',
  circulation: 'text-[#7C57C7] dark:text-[#A98BE8]',
};

const fmt = (n: number): string => n.toLocaleString('fr-FR');

function TopList({ title, entries, empty }: { title: string; entries: TopEntry[]; empty: string }) {
  return (
    <div className="rounded-md border border-de9-line bg-card px-5 py-[18px]">
      <div className="text-[14px] font-extrabold">{title}</div>
      <div className="mt-3 flex flex-col gap-[10px]">
        {entries.map((e, i) => (
          <div key={i} className="flex items-center gap-[11px]">
            <div
              className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-sm text-[12px] font-extrabold text-white"
              style={{ background: e.color }}
            >
              {e.init}
            </div>
            <div className="flex-1 text-[13px] font-semibold">{e.name}</div>
            <div className="num text-[13px] font-extrabold">{e.value}</div>
          </div>
        ))}
        {entries.length === 0 && <div className="text-[12px] text-de9-gray">{empty}</div>}
      </div>
    </div>
  );
}

/** One platform-overview group card: a title and a few label→value lines. */
function OverviewCard({ title, lines }: { title: string; lines: [string, ReactNode][] }) {
  return (
    <div className="rounded-md border border-de9-line bg-card px-[17px] py-4">
      <div className="text-[12.5px] font-extrabold text-de9-ink">{title}</div>
      <div className="mt-2.5 flex flex-col gap-1.5">
        {lines.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-2">
            <span className="text-[11.5px] text-de9-gray">{label}</span>
            <span className="text-[13px] font-extrabold text-de9-ink">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const t = useT();
  const L = useL();
  const [period, setPeriod] = useState('mois');
  const [du, setDu] = useState('');
  const [au, setAu] = useState('');

  const params = useMemo<AnalyticsParams>(() => {
    const p: AnalyticsParams = { period };
    if (period === 'perso') {
      if (du) p.du = du;
      if (au) p.au = au;
    }
    return p;
  }, [period, du, au]);

  const { data, isPending, isError, isPlaceholderData } = useAnalytics(params);
  const dashQ = useAdminDashboard();
  const dash = dashQ.data;

  const dateInputCls =
    'rounded-xs border border-outline bg-card px-3 py-[7px] text-[12px] font-semibold text-de9-slate outline-none';

  return (
    <div>
      {/* header + period pills */}
      <div className="flex flex-wrap items-end justify-between gap-[14px]">
        <div>
          <div className="text-[23px] font-extrabold">{t('analyticsCredits')}</div>
          <div className="mt-[2px] text-[13.5px] text-de9-gray">{t('analyticsSub')}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {period === 'perso' && (
            <>
              <input type="date" value={du} onChange={(e) => setDu(e.target.value)} className={dateInputCls} />
              <Glyph icon={ArrowRight} className="text-[12px] text-de9-gray rtl:rotate-180" />
              <input type="date" value={au} onChange={(e) => setAu(e.target.value)} className={dateInputCls} />
            </>
          )}
          <div className="inline-flex flex-wrap items-center gap-[3px] rounded-sm border border-de9-line bg-card p-1">
            {PERIODS.map((p) => (
              <div
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`cursor-pointer rounded-md px-[14px] py-2 text-[12px] font-bold ${
                  period === p.key ? 'bg-secondary-container text-on-secondary-container' : 'bg-transparent text-de9-gray'
                }`}
              >
                {t(p.labelKey)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {isPending && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-[13px]">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[104px] animate-pulse rounded-md bg-de9-row" />
          ))}
        </div>
      )}

      {isError && !isPending && (
        <div className="mt-4 text-[12.5px] font-semibold text-de9-red">
          {L('Erreur de chargement des analytics', 'خطأ في تحميل التحليلات')}
        </div>
      )}

      {!isPending && !isError && data && (
        <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {/* KPIs with delta */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-[13px]">
            {data.kpis.map((ak) => (
              <div
                key={ak.key}
                className="rounded-md border border-de9-line bg-card px-[17px] py-4"
              >
                <div className="text-[11.5px] font-semibold text-de9-gray">
                  {t(KPI_LABEL_KEYS[ak.key])}
                </div>
                <div className={`mt-[7px] text-[22px] font-extrabold ${KPI_COLORS[ak.key]}`}>
                  <span className="num">{ak.value}</span>
                </div>
                <div
                  className={`mt-[3px] text-[11.5px] font-bold ${
                    ak.positive
                      ? 'text-[#2FA86A] dark:text-[#6FCF97]'
                      : 'text-[#E7464E] dark:text-[#F2848A]'
                  }`}
                >
                  <span className="num">{ak.delta}</span> <span className="font-medium text-de9-gray">{t('vsPrec')}</span>
                </div>
              </div>
            ))}
          </div>

          {/* chart + top lists */}
          <div className="mt-4 grid grid-cols-1 lg:[grid-template-columns:1.6fr_1fr] gap-[14px]">
            <CreditsChart title={t('chartTitle')} bars={data.chartBars} />

            <div className="flex flex-col gap-[14px]">
              <TopList title={t('topClients')} entries={data.topClients} empty={t('aucuneDonnee')} />
              <TopList title={t('topPrestataires')} entries={data.topPrestataires} empty={t('aucuneDonnee')} />
            </div>
          </div>
        </div>
      )}

      {/* platform overview (GET /admin/dashboard) — hidden when unavailable */}
      {dash && (
        <div className="mt-7">
          <div className="text-[17px] font-extrabold">
            {L("Vue d'ensemble plateforme", 'نظرة عامة على المنصة')}
          </div>
          <div className="mt-3 grid grid-cols-1 gap-[13px] sm:grid-cols-2 xl:grid-cols-4">
            <OverviewCard
              title={L('Entreprises', 'الشركات')}
              lines={[
                [L('Total', 'الإجمالي'), fmt(dash.companies.total)],
                [L('Clients', 'العملاء'), fmt(dash.companies.clients)],
                [L('Prestataires', 'المزودون'), fmt(dash.companies.prestataires)],
                [L('Actives', 'النشطة'), fmt(dash.companies.active)],
              ]}
            />
            <OverviewCard
              title={L('Contrats & visites', 'العقود والزيارات')}
              lines={[
                [L('Contrats ouverts', 'عقود مفتوحة'), `${fmt(dash.execution.contractsOpen)} / ${fmt(dash.execution.contractsTotal)}`],
                [L('Visites', 'الزيارات'), fmt(dash.execution.visitsTotal)],
                [L('En attente de9de9', 'بانتظار de9de9'), fmt(dash.execution.visitsAwaitingAdmin)],
                [L('En attente client / pro', 'بانتظار العميل / المزود'), `${fmt(dash.execution.visitsAwaitingClient)} / ${fmt(dash.execution.visitsAwaitingPrestataire)}`],
              ]}
            />
            <OverviewCard
              title={L('Trésorerie (crédits)', 'الخزينة (رصيد)')}
              lines={[
                [L('Solde portefeuilles', 'رصيد المحافظ'), fmt(dash.money.walletBalanceCredits)],
                [L('Gelés', 'مجمّد'), fmt(dash.money.walletFrozenCredits)],
                [L('Marge plateforme', 'هامش المنصة'), fmt(dash.money.platformMarginCredits)],
                [L('Factures contestées', 'فواتير متنازع عليها'), fmt(dash.money.contestedInvoices)],
              ]}
            />
            <OverviewCard
              title={L('Avis & sous-traitance', 'التقييمات والمناولة')}
              lines={[
                [L('Avis', 'التقييمات'), fmt(dash.reviews.total)],
                [
                  L('Note moyenne', 'المعدل'),
                  dash.reviews.averageRating != null ? (
                    <>
                      <Glyph icon={Star} filled /> {dash.reviews.averageRating.toFixed(1)}
                    </>
                  ) : (
                    '—'
                  ),
                ],
                [L('Demandes sous-traitance', 'طلبات المناولة'), fmt(dash.subcontracting.demandesTotal)],
                [L('Mises en relation', 'عمليات الربط'), fmt(dash.subcontracting.matchesTotal)],
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
