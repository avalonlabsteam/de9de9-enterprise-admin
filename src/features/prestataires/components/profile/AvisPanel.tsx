// Avis tab — ported from src/admin/views/PresProfile.tsx (tAvis) and
// logic.ts profileReviews / setReviewFilter / openReviewPres. Rows and the
// rating roll-up come from GET /prestataires/{companyId} (see fromFiche).
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { starsOf } from './lib';
import type { AvisView } from './fromFiche';

type ReviewFilter = 'all' | 'client' | 'de9de9';

const SRC_META: Record<'client' | 'de9de9', { key: 'sourceClient' | null; bg: string; fg: string }> = {
  client: { key: 'sourceClient', bg: '#EAF2FD', fg: '#2F7FD0' },
  de9de9: { key: null, bg: '#FDECEC', fg: '#E7464E' },
};

interface AvisPanelProps {
  avis: AvisView;
  onAddReview: () => void;
}

export function AvisPanel({ avis, onAddReview }: AvisPanelProps) {
  const t = useT();
  const [filter, setFilter] = useState<ReviewFilter>('all');

  const list = filter === 'all' ? avis.rows : avis.rows.filter((r) => r.source === filter);
  const avgRating = avis.count ? avis.avg.toFixed(1) : '—';
  const avgStars = starsOf(Math.round(avis.avg));

  const filters: { key: ReviewFilter; label: string; n: number }[] = [
    { key: 'all', label: t('tous'), n: avis.count },
    { key: 'client', label: t('reviewClients'), n: avis.nClient },
    { key: 'de9de9', label: 'de9de9', n: avis.nDe9 },
  ];

  return (
    <div className="border-t border-de9-line pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="text-[13px] font-extrabold">{t('avisSection')}</div>
        <button
          type="button"
          onClick={onAddReview}
          className="cursor-pointer rounded-[10px] bg-[#F4EFFB] px-[13px] py-2 text-[11.5px] font-bold text-[#7C57C7] dark:bg-[#7C57C7]/15 dark:text-[#A98BE8]"
        >
          ＋ {t('ajouterAvis')}
        </button>
      </div>

      <div className="mt-2.5 flex items-center gap-4">
        <div className="flex-none text-center">
          <div className="text-[30px] leading-none font-extrabold text-de9-ink">{avgRating}</div>
          <div className="mt-[3px] text-[11px] text-de9-gray">
            {avis.count} {t('surNAvis')}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] tracking-[1px] text-[#F2A93B]">{avgStars}</div>
          <div className="mt-2 flex flex-wrap gap-[7px]">
            {filters.map((rf) => {
              const active = filter === rf.key;
              return (
                <button
                  key={rf.key}
                  type="button"
                  onClick={() => setFilter(rf.key)}
                  className={cn(
                    'cursor-pointer rounded-full border-[1.5px] px-[11px] py-1.5 text-[11px] font-bold',
                    active
                      ? 'border-de9-ink bg-de9-ink text-white dark:text-[#151923]'
                      : 'border-de9-line bg-card text-de9-slate',
                  )}
                >
                  {rf.label} ({rf.n})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-2.5 inline-block rounded-lg border border-[#F0E2C0] bg-[#FBF4E4] px-[11px] py-1.5 text-[10.5px] font-bold text-[#92702A] dark:border-[#92702A]/40 dark:bg-[#92702A]/15 dark:text-[#D9B36A]">
        🔒 {t('avisVisib')}
      </div>

      <div className="mt-[11px] flex flex-col gap-2.5">
        {list.map((rv) => {
          const sm = SRC_META[rv.source];
          return (
            <div key={rv.id} className="rounded-xl border border-de9-line px-3.5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-[9px] py-[3px] text-[10px] font-extrabold"
                    style={{ background: sm.bg, color: sm.fg }}
                  >
                    {sm.key ? t(sm.key) : 'de9de9'}
                  </span>
                  <span className="text-[12.5px] font-bold">{rv.auteur}</span>
                </div>
                <div className="text-[13px] tracking-[1px] text-[#F2A93B]">{starsOf(rv.note)}</div>
              </div>
              <div className="mt-[7px] text-[12.5px] leading-normal text-de9-slate">{rv.comment}</div>
              <div className="mt-1.5 text-[10.5px] text-de9-gray">{rv.sub}</div>
            </div>
          );
        })}
        {list.length === 0 && (
          <div className="p-3.5 text-center text-xs text-de9-gray">{t('aucunAvis')}</div>
        )}
      </div>
    </div>
  );
}
