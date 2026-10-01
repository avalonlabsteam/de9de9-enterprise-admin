import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { problemMessage } from '@/api/problem';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { reloadPaiement, usePaiementAction } from '../api/comptabilite';
import { comptaProblem } from '../lib/comptabilite';
import type { PaiementAction, PaiementDetail } from '../schemas/paiement';

const MOTIF_MAX = 512;

/**
 * « Créditer après revue » / « Rejeter après revue » (guide 18 §7). The motif
 * is mandatory: it is stored as the review comment with the admin and the time.
 */
export function RevueDialog({
  detail,
  action,
  onClose,
}: {
  detail: PaiementDetail;
  action: PaiementAction;
  onClose: () => void;
}) {
  const t = useT();
  const run = usePaiementAction();
  const [motif, setMotif] = useState('');
  const [error, setError] = useState<string | null>(null);
  const crediter = action.code === 'revue_crediter';

  const confirmText = crediter
    ? t('comptaConfirmCrediter')
        .replace('{credits}', detail.creditsLabel ?? String(detail.credits ?? ''))
        .replace('{entreprise}', detail.entreprise?.raisonSociale ?? '—')
        .replace('{montant}', detail.montantLabel ?? String(detail.montantDzd ?? ''))
    : t('comptaConfirmRejeter');

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    const value = motif.trim();
    if (!value || value.length > MOTIF_MAX) {
      setError(t('comptaMotifRequis'));
      return;
    }
    run.mutate(
      { id: detail.id, action, motif: value },
      {
        onSuccess: () => {
          toast.success(t(crediter ? 'comptaCredite' : 'comptaRejete'));
          onClose();
        },
        onError: (err) => {
          const p = comptaProblem(err);
          if (p.status === 400 && (!p.field || p.field.toLowerCase() === 'motif')) {
            setError(problemMessage(err));
            return;
          }
          toast.error(problemMessage(err));
          // A colleague or the bank moved the payment: what the dialog shows is stale.
          if (p.status === 404 || p.status === 409) {
            reloadPaiement(detail.id);
            onClose();
          }
        },
      },
    );
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !run.isPending) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="block max-w-[calc(100%-2rem)] gap-0 rounded-[22px] bg-card p-7 sm:max-w-[480px]"
      >
        <form onSubmit={onSubmit} noValidate>
          <DialogTitle className="text-[19px] leading-normal font-extrabold text-de9-ink">{action.label}</DialogTitle>
          <DialogDescription
            className={cn(
              'mt-3 rounded-xl px-4 py-3 text-[13px] leading-relaxed font-semibold',
              crediter
                ? 'bg-[#E7F6EE] text-[#1F7A4C] dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]'
                : 'bg-[#FDECEC] text-de9-red dark:bg-[#E7464E]/15',
            )}
          >
            {confirmText}
          </DialogDescription>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-semibold text-de9-slate">{t('comptaMotif')}</span>
            <textarea
              value={motif}
              onChange={(e) => {
                setMotif(e.target.value);
                if (error) setError(null);
              }}
              maxLength={MOTIF_MAX}
              rows={4}
              autoFocus
              placeholder={t('comptaMotifPh')}
              aria-invalid={!!error}
              className={cn(
                'w-full resize-y rounded-[11px] border-[1.5px] bg-card px-3.5 py-2.5 text-[13px] text-de9-ink outline-none',
                error ? 'border-de9-red' : 'border-de9-line focus:border-de9-teal',
              )}
            />
          </label>
          <div className="mt-1 flex justify-between gap-3 text-[11.5px]">
            <span className="font-semibold text-de9-red">{error}</span>
            <span className="flex-none text-de9-gray">
              {motif.trim().length} / {MOTIF_MAX}
            </span>
          </div>

          <div className="mt-5 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={run.isPending}
              className="flex-1 cursor-pointer rounded-[13px] border-[1.5px] border-de9-line bg-card p-3 text-sm font-bold text-de9-slate disabled:opacity-50"
            >
              {t('annuler')}
            </button>
            <button
              type="submit"
              disabled={run.isPending}
              className={cn(
                'flex-1 cursor-pointer rounded-[13px] p-3 text-sm font-bold text-white disabled:opacity-60',
                crediter ? 'bg-de9-teal-dark shadow-[0_8px_18px_rgba(23,138,130,.32)]' : 'bg-de9-red',
              )}
            >
              {run.isPending ? t('comptaEnCours') : action.label}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
