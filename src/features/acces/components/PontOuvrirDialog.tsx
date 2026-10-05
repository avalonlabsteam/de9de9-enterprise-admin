import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { reloadPont, useOuvrirPont } from '../api/pont';
import { MOTIF_MAX, accesErrorMessage, accesProblem, plural } from '../lib/acces';

/** A refused opening, said in the dialog. `owner`: a server setting only the owner can fix. */
interface Refus {
  detail: string;
  owner: boolean;
  /** The de9de9 app may be restarting: worth trying again. */
  retry: boolean;
}

/**
 * « Ouvrir le pont » — the server tests the connection before it answers and
 * leaves the bridge as it was unless the test succeeds. The motif is optional
 * and kept for de9de9 only (the card and the audit log).
 */
export function PontOuvrirDialog({ enFile, onClose }: { enFile: number; onClose: () => void }) {
  const t = useT();
  const ouvrir = useOuvrirPont();
  const [motif, setMotif] = useState('');
  const [motifError, setMotifError] = useState<string | null>(null);
  const [refus, setRefus] = useState<Refus | null>(null);
  const text = motif.trim();
  // Refused for a server setting: sending again would get the same answer.
  const blocked = !!refus && !refus.retry;

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    if (ouvrir.isPending || blocked) return;
    setRefus(null);
    setMotifError(null);
    ouvrir.mutate(
      { motif: text },
      {
        onSuccess: () => {
          toast.success(t('pontOuvertToast'));
          onClose();
        },
        onError: (err) => {
          const p = accesProblem(err);
          const detail = accesErrorMessage(err, t);
          if (p.sansReponse) {
            // The answer was lost, not necessarily the opening: read the state again.
            toast.warning(t('pontSansReponse'));
            reloadPont();
            onClose();
          } else if (p.status === 400 && (!p.field || p.field.toLowerCase() === 'motif')) {
            setMotifError(detail);
          } else if (p.code === 'concurrency_conflict') {
            toast.error(detail);
            reloadPont();
            onClose();
          } else if (p.code === 'pont_injoignable') {
            setRefus({ detail, owner: false, retry: true });
          } else if (p.status === 422 || p.code === 'pont_reponse_inattendue') {
            setRefus({ detail, owner: true, retry: false });
          } else {
            setRefus({ detail, owner: false, retry: p.status !== 403 });
          }
        },
      },
    );
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !ouvrir.isPending) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="block max-h-[90vh] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-xl bg-card p-6 text-de9-ink sm:max-w-[520px] sm:p-7"
      >
        <form onSubmit={onSubmit} noValidate>
          <DialogTitle className="text-[19px] leading-normal font-extrabold text-de9-ink">{t('pontOuvrirTitre')}</DialogTitle>
          <DialogDescription className="mt-2.5 text-[13.5px] leading-relaxed text-de9-slate">
            {t('pontOuvrirTexte')}
            {enFile > 0 && <> {plural(enFile, 'pontOuvrirEnFile1', 'pontOuvrirEnFileN', t)}</>}
          </DialogDescription>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-semibold text-de9-slate">{t('accesMotif')}</span>
            <textarea
              value={motif}
              onChange={(e) => {
                setMotif(e.target.value);
                if (motifError) setMotifError(null);
              }}
              maxLength={MOTIF_MAX}
              rows={3}
              autoFocus
              disabled={ouvrir.isPending}
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
            <div role="alert" className="mt-4 rounded-md bg-[#FDECEC] px-3.5 py-3 text-[12.5px] leading-relaxed font-semibold text-de9-red dark:bg-[#E7464E]/15">
              <div dir="auto" className="ltr:text-left rtl:text-right">
                {refus.detail}
              </div>
              {refus.owner && <div className="mt-1.5 font-bold">{t('pontReglageServeur')}</div>}
            </div>
          )}

          <div className="mt-5 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={ouvrir.isPending}
              className="flex-1 cursor-pointer rounded-full border border-de9-line bg-card px-2 py-3 text-[13px] font-bold whitespace-nowrap text-de9-slate disabled:opacity-50 sm:text-sm"
            >
              {t(blocked ? 'fermer' : 'annuler')}
            </button>
            <button
              type="submit"
              disabled={ouvrir.isPending || blocked}
              className="flex-1 cursor-pointer rounded-full bg-primary px-2 py-3 text-[13px] font-bold whitespace-nowrap text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
            >
              {ouvrir.isPending ? t('pontTestEnCours') : refus?.retry ? t('reessayer') : t('pontOuvrir')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
