import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { TriangleAlert } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Glyph } from '@/components/common/Glyph';
import { useAccesLot } from '../api/acces';
import { ACTIONS, MOTIF_MAX, accesErrorMessage, accesProblem, plural, seraIgnoree, type AccesAction } from '../lib/acces';
import type { AccesLot } from '../schemas/acces';
import type { AccesTarget } from '../stores/selectionStore';

/** Past ten, the names fold into « … et 12 autres ». */
const NAMES_SHOWN = 10;

interface AccesConfirmDialogProps {
  action: AccesAction;
  /** The selection, or the one company of a row's switch or menu. */
  targets: AccesTarget[];
  onClose: () => void;
  /** The 200 — one result per company, to be read line by line. */
  onDone: (lot: AccesLot, motif: string) => void;
  /** No answer came back: the lot may be running, the caller reloads instead of resending. */
  onSansReponse: () => void;
}

/**
 * The question before one of the four actions: what it does, for whom, and the
 * motif — mandatory to revoke or suspend, since the company reads it word for
 * word in its alert.
 */
export function AccesConfirmDialog({ action, targets, onClose, onDone, onSansReponse }: AccesConfirmDialogProps) {
  const t = useT();
  const meta = ACTIONS[action];
  const lot = useAccesLot();
  const [motif, setMotif] = useState('');
  const [errors, setErrors] = useState<{ motif?: string; companyIds?: string }>({});

  const single = targets.length === 1 ? targets[0] : undefined;
  const [titleBefore, titleAfter = ''] = t(meta.titre1).split('{nom}');
  const rest = targets.length - NAMES_SHOWN;
  // Only a hint, from what the rows said when they were ticked: the server decides.
  const ignorees = action === 'b2c_accorder' ? targets.filter(seraIgnoree).length : 0;
  const text = motif.trim();
  const blocked = meta.motifRequis && !text;

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    if (blocked || lot.isPending) return;
    setErrors({});
    lot.mutate(
      { action, companyIds: targets.map((x) => x.id), motif: text },
      {
        onSuccess: (res) => onDone(res, text),
        onError: (err) => {
          const p = accesProblem(err);
          if (p.sansReponse) {
            toast.warning(t('accesSansReponse'));
            onSansReponse();
            return;
          }
          // A 400 changed nothing: the reason goes under the field it names.
          const field = p.status === 400 ? p.field?.toLowerCase() : undefined;
          if (field === 'motif') setErrors({ motif: accesErrorMessage(err, t) });
          else if (field === 'companyids') setErrors({ companyIds: accesErrorMessage(err, t) });
          else toast.error(accesErrorMessage(err, t));
        },
      },
    );
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !lot.isPending) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="block max-h-[90vh] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-xl bg-card p-6 text-de9-ink sm:max-w-[520px] sm:p-7"
      >
        <form onSubmit={onSubmit} noValidate>
          <DialogTitle className="text-[19px] leading-normal font-extrabold text-de9-ink">
            {single ? (
              <>
                {titleBefore}
                <bdi>{single.nom}</bdi>
                {titleAfter}
              </>
            ) : (
              t(meta.titreN).replace('{n}', String(targets.length))
            )}
          </DialogTitle>
          <DialogDescription className="mt-2.5 text-[13.5px] leading-relaxed text-de9-slate">
            {t(single ? meta.texte1 : meta.texteN)}
          </DialogDescription>

          {!single && (
            <div className="mt-3.5 flex flex-wrap gap-1.5">
              {targets.slice(0, NAMES_SHOWN).map((x) => (
                <bdi
                  key={x.id}
                  className="max-w-full truncate rounded-full bg-secondary px-2.5 py-[5px] text-[11.5px] font-bold text-de9-slate"
                >
                  {x.nom}
                </bdi>
              ))}
              {rest > 0 && (
                <span className="px-1 py-[5px] text-[11.5px] font-semibold text-de9-gray">
                  {plural(rest, 'accesEtAutres1', 'accesEtAutresN', t)}
                </span>
              )}
            </div>
          )}
          {errors.companyIds && (
            <div role="alert" className="mt-2 text-[11.5px] font-semibold text-de9-red">
              {errors.companyIds}
            </div>
          )}

          {ignorees > 0 && (
            <div className="mt-3.5 flex items-start gap-2 rounded-md bg-[#FBF4E4] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#92702A] dark:bg-[#B68A2E]/15 dark:text-[#D9B36A]">
              <span className="mt-px">
                <Glyph icon={TriangleAlert} />
              </span>
              <span>{plural(ignorees, 'accesIgnoree1', 'accesIgnoreeN', t)}</span>
            </div>
          )}

          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-semibold text-de9-slate">
              {t(meta.motifRequis ? 'accesMotifObligatoire' : 'accesMotif')}
            </span>
            <textarea
              value={motif}
              onChange={(e) => {
                setMotif(e.target.value);
                if (errors.motif) setErrors((prev) => ({ ...prev, motif: undefined }));
              }}
              maxLength={MOTIF_MAX}
              rows={4}
              autoFocus
              disabled={lot.isPending}
              aria-invalid={!!errors.motif}
              className={cn(
                'w-full resize-y rounded-xs border bg-card px-3.5 py-2.5 text-[13px] text-de9-ink outline-none disabled:opacity-60',
                errors.motif ? 'border-de9-red' : 'border-outline focus:border-de9-teal',
              )}
            />
          </label>
          <div className="mt-1 flex justify-between gap-3 text-[11.5px]">
            {errors.motif ? (
              <span role="alert" className="font-semibold text-de9-red">
                {errors.motif}
              </span>
            ) : (
              // The company reads this text as it is: said before it is written, not after.
              <span className="text-de9-gray">{meta.motifRequis ? t('accesMotifEnvoye') : ''}</span>
            )}
            <span className="num flex-none text-de9-gray">
              {text.length} / {MOTIF_MAX}
            </span>
          </div>

          <div className="mt-5 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={lot.isPending}
              className="flex-1 cursor-pointer rounded-full border border-de9-line bg-card px-2 py-3 text-[13px] font-bold whitespace-nowrap text-de9-slate disabled:opacity-50 sm:text-sm"
            >
              {t('annuler')}
            </button>
            <button
              type="submit"
              disabled={blocked || lot.isPending}
              className={cn(
                'flex-1 cursor-pointer rounded-full px-2 py-3 text-[13px] font-bold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm',
                meta.danger ? 'bg-de9-red text-white' : 'bg-primary text-primary-foreground',
              )}
            >
              {lot.isPending ? t('accesTraitement') : t(meta.confirmKey)}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
