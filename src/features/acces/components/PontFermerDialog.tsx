import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useT, type TKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { reloadPont, useFermerPont } from '../api/pont';
import { MOTIF_MAX, accesErrorMessage, accesProblem } from '../lib/acces';

/** What closing does — the server sends no sentence for it. */
const CONSEQUENCES: readonly TKey[] = [
  'pontConsequence1',
  'pontConsequence2',
  'pontConsequence3',
  'pontConsequence4',
  'pontConsequence5',
];

/**
 * « Fermer le pont » — a short stop for every company at once. The motif is
 * mandatory, kept for de9de9 (card, audit log), and never sent to the companies.
 */
export function PontFermerDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const fermer = useFermerPont();
  const [motif, setMotif] = useState('');
  const [motifError, setMotifError] = useState<string | null>(null);
  const [refus, setRefus] = useState<string | null>(null);
  const text = motif.trim();

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    if (fermer.isPending || !text) return;
    setRefus(null);
    setMotifError(null);
    fermer.mutate(
      { motif: text },
      {
        onSuccess: () => {
          toast.success(t('pontFermeToast'));
          onClose();
        },
        onError: (err) => {
          const p = accesProblem(err);
          const detail = accesErrorMessage(err, t);
          if (p.sansReponse) {
            toast.warning(t('pontSansReponse'));
            reloadPont();
            onClose();
          } else if (p.status === 400 && (!p.field || p.field.toLowerCase() === 'motif')) {
            setMotifError(detail);
          } else if (p.code === 'concurrency_conflict') {
            toast.error(detail);
            reloadPont();
            onClose();
          } else {
            setRefus(detail);
          }
        },
      },
    );
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !fermer.isPending) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="block max-h-[90vh] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-xl bg-card p-6 text-de9-ink sm:max-w-[540px] sm:p-7"
      >
        <form onSubmit={onSubmit} noValidate>
          <DialogTitle className="text-[19px] leading-normal font-extrabold text-de9-ink">{t('pontFermerTitre')}</DialogTitle>
          <DialogDescription className="mt-2.5 text-[13.5px] leading-relaxed text-de9-slate">{t('pontFermerTexte')}</DialogDescription>
          <ul className="mt-3 list-disc space-y-1 ps-5 text-[12.5px] leading-relaxed text-de9-slate">
            {CONSEQUENCES.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-semibold text-de9-slate">{t('pontMotifObligatoire')}</span>
            <textarea
              value={motif}
              onChange={(e) => {
                setMotif(e.target.value);
                if (motifError) setMotifError(null);
              }}
              maxLength={MOTIF_MAX}
              rows={3}
              autoFocus
              disabled={fermer.isPending}
              aria-invalid={!!motifError}
              className={cn(
                'w-full resize-y rounded-xs border bg-card px-3.5 py-2.5 text-[13px] text-de9-ink outline-none disabled:opacity-60',
                motifError ? 'border-de9-red' : 'border-outline focus:border-de9-teal',
              )}
            />
          </label>
          <div className="mt-1 flex justify-between gap-3 text-[11.5px]">
            <span role={motifError ? 'alert' : undefined} className="font-semibold text-de9-red">
              {motifError}
            </span>
            <span className="num flex-none text-de9-gray">
              {text.length} / {MOTIF_MAX}
            </span>
          </div>

          {refus && (
            <div role="alert" dir="auto" className="mt-4 rounded-md bg-[#FDECEC] px-3.5 py-3 text-[12.5px] leading-relaxed font-semibold text-de9-red ltr:text-left rtl:text-right dark:bg-[#E7464E]/15">
              {refus}
            </div>
          )}

          <div className="mt-5 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={fermer.isPending}
              className="flex-1 cursor-pointer rounded-full border border-de9-line bg-card px-2 py-3 text-[13px] font-bold whitespace-nowrap text-de9-slate disabled:opacity-50 sm:text-sm"
            >
              {t('annuler')}
            </button>
            <button
              type="submit"
              disabled={fermer.isPending || !text}
              className="flex-1 cursor-pointer rounded-full bg-de9-red px-2 py-3 text-[13px] font-bold whitespace-nowrap text-white disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
            >
              {fermer.isPending ? t('accesTraitement') : t('pontFermer')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
