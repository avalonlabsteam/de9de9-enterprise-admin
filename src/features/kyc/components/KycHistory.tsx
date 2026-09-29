// « Historique du dossier » — GET /audit/Company/{companyId}, newest first.
// Rendered per the guide's table (« NIF refusé » + « Motif envoyé » box + the
// internal note…); other company steps keep the audit's own wording.
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { useKycAudit } from '../api/kyc';
import { TONES, auditEvents, fmtDateTime } from '../lib/kyc';
import { SectionLabel } from './shared';

export function KycHistory({ companyId }: { companyId: string }) {
  const t = useT();
  const auditQ = useKycAudit(companyId);
  const events = useMemo(() => (auditQ.data ? auditEvents(auditQ.data, t) : []), [auditQ.data, t]);

  return (
    <div className="rounded-[20px] border border-de9-line bg-card px-5 py-[18px] shadow-[0_10px_30px_rgba(38,50,69,.06)]">
      <SectionLabel>{t('kycJournalTitre')}</SectionLabel>

      {auditQ.isPending && (
        <div className="mt-3 flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-[10px] bg-secondary" />
          ))}
        </div>
      )}

      {/* The screen stays usable without it — say so, quietly. */}
      {auditQ.isError && <div className="mt-3 text-[12px] text-de9-gray">{t('kycJournalIndispo')}</div>}

      {auditQ.isSuccess && events.length === 0 && (
        <div className="mt-3 text-[12px] text-de9-gray">{t('kycJournalVide')}</div>
      )}

      {events.length > 0 && (
        <ol className="mt-3.5 flex flex-col">
          {events.map((ev, i) => (
            <li key={ev.key} className="relative flex gap-3 pb-4 last:pb-0">
              {/* rail */}
              {i < events.length - 1 && (
                <span aria-hidden className="absolute start-[5px] top-4 bottom-0 w-px bg-de9-line" />
              )}
              <span className={cn('mt-[5px] h-[11px] w-[11px] flex-none rounded-full ring-4 ring-card', TONES[ev.tone].dot)} />
              <div className="min-w-0 flex-1">
                <div dir="auto" className="text-[12.5px] font-bold leading-[1.4] text-de9-ink">
                  {ev.title}
                </div>
                {ev.code && <div className="font-mono text-[10.5px] text-de9-gray">{ev.code}</div>}
                <div className="mt-0.5 text-[11px] text-de9-gray">
                  {[ev.at ? fmtDateTime(ev.at, t) : null, ev.actor].filter(Boolean).join(' · ')}
                </div>
                {ev.motif && (
                  <div className="mt-1.5 rounded-[10px] border border-[#F3C9CB] bg-[#FDECEC] px-3 py-2 dark:border-[#E7464E]/40 dark:bg-[#E7464E]/15">
                    <div className="text-[10px] font-extrabold uppercase tracking-[.04em] text-de9-red">
                      {t('kycEvtMotifEnvoye')}
                    </div>
                    <div dir="auto" className="mt-0.5 text-[12px] leading-[1.45] text-de9-ink">
                      {ev.motif}
                    </div>
                  </div>
                )}
                {ev.note && (
                  <div className="mt-1.5 text-[11.5px] leading-[1.45] text-de9-slate">
                    🔒 <bdi>{ev.note}</bdi>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
