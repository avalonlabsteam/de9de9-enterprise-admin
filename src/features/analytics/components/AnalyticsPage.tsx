import { useState } from 'react';
import { useT, useL, type TKey } from '@/lib/i18n';
import { useAnalytics } from '../api/analytics';
import type { AnalyticsKpiKey, TopEntry } from '../schemas/analytics';

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

function TopList({ title, entries }: { title: string; entries: TopEntry[] }) {
  return (
    <div className="rounded-[18px] border border-de9-line bg-card px-5 py-[18px] shadow-[0_10px_30px_rgba(38,50,69,.06)]">
      <div className="text-[14px] font-extrabold">{title}</div>
      <div className="mt-3 flex flex-col gap-[10px]">
        {entries.map((e, i) => (
          <div key={i} className="flex items-center gap-[11px]">
            <div
              className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[9px] text-[12px] font-extrabold text-white"
              style={{ background: e.color }}
            >
              {e.init}
            </div>
            <div className="flex-1 text-[13px] font-semibold">{e.name}</div>
            <div className="text-[13px] font-extrabold">{e.value}</div>
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
  const { data, isPending, isError } = useAnalytics(period);

  return (
    <div>
      {/* header + period pills */}
      <div className="flex flex-wrap items-end justify-between gap-[14px]">
        <div>
          <div className="text-[23px] font-extrabold">{t('analyticsCredits')}</div>
          <div className="mt-[2px] text-[13.5px] text-de9-gray">{t('analyticsSub')}</div>
        </div>
        <div className="inline-flex flex-wrap items-center gap-[3px] rounded-[11px] border-[1.5px] border-de9-line bg-card p-1">
          {PERIODS.map((p) => (
            <div
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`cursor-pointer rounded-lg px-[14px] py-2 text-[12px] font-bold ${
                period === p.key ? 'bg-[#232838] text-white' : 'bg-transparent text-de9-gray'
              }`}
            >
              {t(p.labelKey)}
            </div>
          ))}
        </div>
      </div>

      {/* data-to-come chip */}
      <div className="mt-[14px] inline-flex items-center gap-[7px] rounded-[10px] border border-[#F0E2C0] dark:border-[#B68A2E]/40 bg-[#FBF4E4] dark:bg-[#B68A2E]/15 px-[13px] py-2 text-[11.5px] font-bold text-[#B68A2E] dark:text-[#D9B36A]">
        ⚠ {t('donneesAVenir')}
      </div>

      {isPending && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-[13px]">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-de9-row" />
          ))}
        </div>
      )}

      {isError && !isPending && (
        <div className="mt-4 text-[12.5px] font-semibold text-de9-red">
          {L('Erreur de chargement des analytics', 'خطأ في تحميل التحليلات')}
        </div>
      )}

      {!isPending && !isError && data && (
        <>
          {/* KPIs with delta */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-[13px]">
            {data.kpis.map((ak) => (
              <div
                key={ak.key}
                className="rounded-2xl border border-de9-line bg-card px-[17px] py-4 shadow-[0_6px_18px_rgba(38,50,69,.04)]"
              >
                <div className="text-[11.5px] font-semibold text-de9-gray">
                  {t(KPI_LABEL_KEYS[ak.key])}
                </div>
                <div className={`mt-[7px] text-[22px] font-extrabold ${KPI_COLORS[ak.key]}`}>
                  {ak.value}
                </div>
                <div
                  className={`mt-[3px] text-[11.5px] font-bold ${
                    ak.positive
                      ? 'text-[#2FA86A] dark:text-[#6FCF97]'
                      : 'text-[#E7464E] dark:text-[#F2848A]'
                  }`}
                >
                  {ak.delta} <span className="font-medium text-de9-gray">{t('vsPrec')}</span>
                </div>
              </div>
            ))}
          </div>

          {/* chart + top lists */}
          <div className="mt-4 grid grid-cols-1 lg:[grid-template-columns:1.6fr_1fr] gap-[14px]">
            <div className="rounded-[18px] border border-de9-line bg-card px-4 sm:px-6 py-[22px] shadow-[0_10px_30px_rgba(38,50,69,.06)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[15px] font-extrabold">{t('chartTitle')}</div>
                <div className="flex flex-wrap gap-x-[14px] gap-y-1 text-[11.5px] font-bold">
                  <span className="text-[#2F7FD0] dark:text-[#7EB5EC]">● {t('vendus')}</span>
                  <span className="text-de9-red">● {t('depenses')}</span>
                  <span className="text-[#2FA86A] dark:text-[#6FCF97]">● {t('verses')}</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <div className="mt-5 flex h-[200px] min-w-[480px] items-end gap-4">
                  {data.chartBars.map((cb, i) => (
                    <div
                      key={i}
                      className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                    >
                      <div className="flex h-[170px] w-full items-end justify-center gap-1">
                        <div
                          className="w-[30%] rounded-t-[5px] bg-[#2F7FD0]"
                          style={{ height: `${cb.vendus}%` }}
                        ></div>
                        <div
                          className="w-[30%] rounded-t-[5px] bg-de9-red"
                          style={{ height: `${cb.depenses}%` }}
                        ></div>
                        <div
                          className="w-[30%] rounded-t-[5px] bg-[#2FA86A]"
                          style={{ height: `${cb.verses}%` }}
                        ></div>
                      </div>
                      <div className="text-[11px] font-semibold text-de9-gray">{cb.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-[14px]">
              <TopList title={t('topClients')} entries={data.topClients} />
              <TopList title={t('topPrestataires')} entries={data.topPrestataires} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
