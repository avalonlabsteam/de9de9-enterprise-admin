// « Historique » of one person — GET /handicap/candidats/{id}: every placement
// they had, the current one first. Read-only: a placement is ended or cancelled
// from its demande (« Placer » / « Voir les placements »).
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { problemMessage } from '@/api/problem';
import { useCandidatDetail } from '../api/handicap';
import type { Candidat } from '../schemas/handicap';
import { CHIP_BLUE, CHIP_GREY, shortDate } from '../lib/handicap';
import { DialogFrame, Pill } from './shared';

export function CandidatHistoryDialog({ candidat, onClose }: { candidat: Candidat; onClose: () => void }) {
  const t = useT();
  const q = useCandidatDetail(candidat.id);
  // The row is enough for the header; the placements come with the detail.
  const person = q.data?.candidat ?? candidat;
  const placements = q.data?.placements ?? [];

  return (
    <DialogFrame title={t('hcHistoriqueTitre')} onClose={onClose}>
      <div className="mt-3 text-[15px] font-extrabold text-de9-ink">
        <bdi>{person.fullName}</bdi>
      </div>
      <div className="mt-0.5 text-[12.5px] text-de9-slate">
        {[person.jobType, person.wilaya, person.phone].filter(Boolean).map((part, i) => (
          <span key={i}>
            {i > 0 && ' · '}
            <bdi>{part}</bdi>
          </span>
        ))}
      </div>

      {q.isPending && <div className="mt-5 h-28 animate-pulse rounded-md bg-secondary" />}
      {q.isError && (
        <div className="mt-5 rounded-md border border-[#F3C9CB] bg-[#FDECEC] px-4 py-3 text-[12.5px] font-semibold text-de9-red dark:border-[#E7464E]/40 dark:bg-[#E7464E]/15">
          {problemMessage(q.error)}
        </div>
      )}

      {q.isSuccess && placements.length === 0 && (
        <div className="mt-5 text-[12.5px] text-de9-gray">{t('hcHistoriqueVide')}</div>
      )}

      {placements.length > 0 && (
        <ul className="mt-5 flex flex-col gap-2">
          {placements.map((p) => (
            <li key={p.id} className={cn('rounded-md border border-de9-line px-3.5 py-3', !p.actif && 'bg-secondary/50')}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13.5px] font-bold text-de9-ink">
                  <bdi>{p.companyName ?? '—'}</bdi>
                </span>
                <Pill className={p.actif ? CHIP_BLUE : CHIP_GREY}>{t(p.actif ? 'hcEnPoste' : 'hcTermine')}</Pill>
              </div>
              {p.jobType && (
                <div className="mt-0.5 text-[11.5px] text-de9-gray">
                  <bdi>{p.jobType}</bdi>
                </div>
              )}
              <div className="mt-1.5 text-[11.5px] text-de9-slate">
                {t('hcPlaceLe').replace('{n}', shortDate(p.placedAt))}
                {!p.actif && p.endedAt && ' — ' + t('hcTermineLe').replace('{n}', shortDate(p.endedAt))}
              </div>
              {p.note && (
                <div dir="auto" className="mt-1 text-[12px] leading-snug text-de9-slate ltr:text-left rtl:text-right">
                  {p.note}
                </div>
              )}
              {!p.actif && p.endReason && (
                <div dir="auto" className="mt-1 text-[12px] leading-snug text-de9-gray ltr:text-left rtl:text-right">
                  {p.endReason}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onClose}
        className="mt-6 w-full cursor-pointer rounded-full border border-de9-line bg-card p-3 text-center text-sm font-bold text-de9-slate"
      >
        {t('btnClose')}
      </button>
    </DialogFrame>
  );
}
