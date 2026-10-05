import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import { problemMessage } from '@/api/problem';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { refreshCtr, useCloseDemande } from '../api/contractuels';
import { REASON_MAX, ctrProblem } from '../lib/contractuels';
import type { CtrDemande } from '../schemas/contractuels';

/** « Clôturer » a demande — the reason is optional. */
export function CloturerDialog({ demande, onClose }: { demande: CtrDemande; onClose: () => void }) {
  const t = useT();
  const close = useCloseDemande();
  const [reason, setReason] = useState('');
  const text = reason.trim();
  const [titleBefore, titleAfter = ''] = t('stCloturerTitre').split('{nom}');

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (close.isPending) return;
    close.mutate(
      { id: demande.id, reason: text },
      {
        onSuccess: () => {
          toast.success(t('stClotureeToast'));
          onClose();
        },
        onError: (err) => {
          toast.error(problemMessage(err));
          const { status } = ctrProblem(err);
          if (status === 404 || status === 409) {
            refreshCtr();
            onClose();
          }
        },
      },
    );
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !close.isPending) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="block max-w-[calc(100%-2rem)] gap-0 rounded-xl bg-card p-6 text-de9-ink sm:max-w-[480px] sm:p-7"
      >
        <form onSubmit={submit} noValidate>
          <DialogTitle className="text-[19px] leading-normal font-extrabold text-de9-ink">
            {titleBefore}
            <bdi>{demande.companyName ?? '—'}</bdi>
            {titleAfter}
          </DialogTitle>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-semibold text-de9-slate">{t('stMotifFacultatif')}</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={REASON_MAX}
              rows={3}
              autoFocus
              disabled={close.isPending}
              className="w-full resize-y rounded-xs border border-outline bg-card px-3.5 py-2.5 text-[13px] text-de9-ink outline-none focus:border-de9-teal disabled:opacity-60"
            />
          </label>
          <div className="mt-1 text-end text-[11.5px] text-de9-gray">
            <span className="num">
              {text.length} / {REASON_MAX}
            </span>
          </div>
          <div className="mt-5 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={close.isPending}
              className="flex-1 cursor-pointer rounded-full border border-de9-line bg-card p-3 text-sm font-bold text-de9-slate disabled:opacity-50"
            >
              {t('annuler')}
            </button>
            <button
              type="submit"
              disabled={close.isPending}
              className="flex-1 cursor-pointer rounded-full bg-de9-red p-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {close.isPending ? t('accesTraitement') : t('stCloturer')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
