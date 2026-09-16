// S4 → V1 « Choisir le prestataire » for a live appel d'offres: POST
// /commandes/worklist/{id}/choisir-prestataire takes { devisId, date, time }.
// Retaining a devis also schedules the first visit, so this form picks the
// devis AND when the visit happens — the API rejects the call without a date.
// Only rows the server marks `choosable` are offered; at S4 those are the
// validated ones, and each always carries a devisId. ActionModals' ChooseModal
// stays as it is: the mock console chooses by quote index.
// Visual ground truth: src/admin/views/Console.tsx modals.
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

/** One choosable devis, already formatted for display by the caller. */
export interface ChoosableQuote {
  devisId: string;
  raison: string;
  montantLabel: string;
}

interface ChoosePrestataireModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotes: ChoosableQuote[];
  pending: boolean;
  onConfirm: (quote: ChoosableQuote, when: { date: string; time: string }) => void;
}

const LABEL_CLASS = 'mb-1.5 text-xs font-semibold text-de9-slate';
const INPUT_CLASS =
  'h-auto w-full rounded-xl border-[1.5px] border-de9-line bg-card px-3.5 py-3 text-[14px] text-de9-ink shadow-none outline-none';

/** yyyy-mm-dd for a date n days from today — the format the API demands. */
function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return [
    d.getFullYear().toString().padStart(4, '0'),
    (d.getMonth() + 1).toString().padStart(2, '0'),
    d.getDate().toString().padStart(2, '0'),
  ].join('-');
}

export function ChoosePrestataireModal({
  open,
  onOpenChange,
  quotes,
  pending,
  onConfirm,
}: ChoosePrestataireModalProps) {
  const t = useT();
  const [selected, setSelected] = useState<string | null>(quotes[0]?.devisId ?? null);
  const today = isoDay(0);
  // Default to tomorrow: the API refuses a visit scheduled in the past.
  const [date, setDate] = useState(isoDay(1));
  const [time, setTime] = useState('09:00');
  const chosen = quotes.find((q) => q.devisId === selected) ?? null;
  // A native date input reports a half-typed year as e.g. '0006-12-01', which the
  // API answers with 400 « date : format attendu aaaa-mm-jj ». Catch it here
  // rather than spend a round trip on it.
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today;
  const timeValid = /^\d{2}:\d{2}$/.test(time);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="block max-h-[90vh] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-[22px] bg-card p-[26px] shadow-[0_30px_70px_rgba(20,30,45,.4)] ring-0 sm:max-w-[460px]"
      >
        <div className="flex size-[54px] items-center justify-center rounded-[15px] bg-[#EAF2FD] text-[26px] dark:bg-[#2F7FD0]/15">
          🤝
        </div>
        <DialogTitle className="mt-4 text-[19px] font-extrabold leading-normal text-de9-ink">
          {t('apercuChoisirTitle')}
        </DialogTitle>
        <div className="mt-[9px] text-[13px] leading-[1.55] text-de9-slate">{t('apercuChoisirInfo')}</div>

        <div className="mt-4 flex flex-col gap-[9px]">
          {quotes.map((q) => {
            const active = q.devisId === selected;
            return (
              <button
                key={q.devisId}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSelected(q.devisId)}
                className={cn(
                  'flex cursor-pointer items-center gap-[11px] rounded-xl border-[1.5px] px-[15px] py-[13px] text-start',
                  active ? 'border-[#2F7FD0] bg-[#EAF2FD] dark:bg-[#2F7FD0]/15' : 'border-de9-line bg-card',
                )}
              >
                <span className={cn('text-base', active ? 'text-[#2F7FD0] dark:text-[#7EB5EC]' : 'text-[#B6BEC8]')}>
                  {active ? '◉' : '○'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-de9-ink">{q.raison}</span>
                  <span className="block text-[11.5px] text-de9-gray">{q.montantLabel}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Retaining the devis schedules the first visit in the same call. */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className={LABEL_CLASS}>{t('dateLabel')}</div>
            <Input
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={!dateValid}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <div className={LABEL_CLASS}>{t('heureLabel')}</div>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={INPUT_CLASS} />
          </div>
        </div>
        {!dateValid && <div className="mt-1.5 text-[11.5px] font-semibold text-de9-red">{t('apercuChoisirDateInvalide')}</div>}

        <div className="mt-[22px] flex gap-[11px]">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-auto flex-1 rounded-[13px] bg-secondary p-3.5 text-center text-sm font-bold text-de9-slate hover:bg-secondary"
          >
            {t('annuler')}
          </Button>
          <Button
            type="button"
            disabled={pending || !chosen || !dateValid || !timeValid}
            onClick={() => chosen && onConfirm(chosen, { date, time })}
            className="h-auto flex-1 rounded-[13px] bg-[#2F7FD0] p-3.5 text-center text-sm font-bold text-white shadow-[0_10px_22px_rgba(47,127,208,.38)] hover:bg-[#2A6FB8] disabled:opacity-70"
          >
            {pending ? t('apercuActionEnCours') : t('apercuChoisirConfirmer')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
