import type { FormEvent } from 'react';
import { useT, type TKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { MOTIF_MAX } from '../lib/annonces';

/** The front's wording per action — the server sends no text for the dialog. */
const TEXTS: Record<string, { title: TKey; sentence: TKey }> = {
  refuser: { title: 'annRefuserTitre', sentence: 'annRefuserTexte' },
  suspendre: { title: 'annSuspendreTitre', sentence: 'annSuspendreTexte' },
};

interface MotifDialogProps {
  /** refuser · suspendre — another code that asks for a motif gets the generic wording. */
  code: string;
  /** The server's button label, also the confirm button's. */
  label: string;
  /** Held by the page: a 409 closes the dialog, and what was typed must survive it. */
  motif: string;
  onMotifChange: (value: string) => void;
  /** A 400 on `motif`, shown under the field. */
  error: string | null;
  pending: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

/**
 * « Refuser » / « Suspendre » — the motif is required and the company reads it
 * word for word, in its alert and on its annonce page.
 */
export function MotifDialog({ code, label, motif, onMotifChange, error, pending, onSubmit, onClose }: MotifDialogProps) {
  const t = useT();
  const texts = TEXTS[code];
  const text = motif.trim();

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (!text || pending) return;
    onSubmit();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="block max-h-[90vh] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-xl bg-card p-6 text-de9-ink sm:max-w-[500px] sm:p-7"
      >
        <form onSubmit={submit} noValidate>
          <DialogTitle className="text-[19px] leading-normal font-extrabold text-de9-ink">
            {texts ? t(texts.title) : `${label} ?`}
          </DialogTitle>
          <DialogDescription className="mt-2.5 text-[13.5px] leading-relaxed text-de9-slate">
            {texts ? t(texts.sentence) : ''}
          </DialogDescription>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-semibold text-de9-slate">{t('annMotifObligatoire')}</span>
            <textarea
              value={motif}
              onChange={(e) => onMotifChange(e.target.value)}
              maxLength={MOTIF_MAX}
              rows={4}
              autoFocus
              disabled={pending}
              aria-invalid={!!error}
              className={cn(
                'w-full resize-y rounded-xs border bg-card px-3.5 py-2.5 text-[13px] text-de9-ink outline-none disabled:opacity-60',
                error ? 'border-de9-red' : 'border-outline focus:border-de9-teal',
              )}
            />
          </label>
          <div className="mt-1 flex justify-between gap-3 text-[11.5px]">
            {error ? (
              <span role="alert" className="font-semibold text-de9-red">
                {error}
              </span>
            ) : (
              <span className="text-de9-gray">{t('annMotifEnvoye')}</span>
            )}
            <span className="num flex-none text-de9-gray">
              {text.length} / {MOTIF_MAX}
            </span>
          </div>

          <div className="mt-5 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="flex-1 cursor-pointer rounded-full border border-de9-line bg-card p-3 text-sm font-bold text-de9-slate disabled:opacity-50"
            >
              {t('annuler')}
            </button>
            <button
              type="submit"
              disabled={!text || pending}
              className="flex-1 cursor-pointer rounded-full bg-de9-red p-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? t('accesTraitement') : label}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
