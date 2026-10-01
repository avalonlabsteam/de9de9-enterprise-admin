import { useState } from 'react';
import { toast } from 'sonner';
import { Check, Minus } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useAccesLot } from '../api/acces';
import { ACTIONS, accesErrorMessage, accesProblem, fileLabel, isFait, isRetryable, type AccesAction } from '../lib/acces';
import type { AccesLot, AccesResultat } from '../schemas/acces';
import { accesSelection, type AccesTarget } from '../stores/selectionStore';

interface AccesResultDialogProps {
  action: AccesAction;
  /** Resent as it was by « Réessayer ». */
  motif: string;
  lot: AccesLot;
  /** The companies the lot was sent for: their snapshots feed « Resélectionner ». */
  targets: AccesTarget[];
  /** Sent from the selection bar — closing then settles the selection — or from one row. */
  fromSelection: boolean;
  onClose: () => void;
  onSansReponse: () => void;
}

/**
 * What the server did, company by company. A bulk action always answers 200:
 * this summary is where « done » and « skipped » are told apart. Each line
 * prints the server's `detail` as it is.
 */
export function AccesResultDialog({
  action,
  motif,
  lot,
  targets,
  fromSelection,
  onClose,
  onSansReponse,
}: AccesResultDialogProps) {
  const t = useT();
  const retry = useAccesLot();
  // A retry answers for the resent companies only: their lines are replaced in place.
  const [resultats, setResultats] = useState<AccesResultat[]>(lot.resultats);
  const [retried, setRetried] = useState(false);

  const faites = retried ? resultats.filter(isFait).length : lot.faites;
  const demandees = retried ? resultats.length : lot.demandees;
  const ignorees = retried ? demandees - faites : lot.ignorees;
  const aReessayer = resultats.filter(isRetryable);
  // An id that names no company cannot be acted on again.
  const aReselectionner = resultats.filter((r) => !isFait(r) && r.raison !== 'introuvable');

  const onRetry = (): void => {
    retry.mutate(
      { action, companyIds: aReessayer.map((r) => r.companyId), motif },
      {
        onSuccess: (res) => {
          const fresh = new Map(res.resultats.map((r) => [r.companyId, r]));
          setResultats((prev) => prev.map((r) => fresh.get(r.companyId) ?? r));
          setRetried(true);
        },
        onError: (err) => {
          if (accesProblem(err).sansReponse) {
            toast.warning(t('accesSansReponse'));
            onSansReponse();
          } else toast.error(accesErrorMessage(err, t));
        },
      },
    );
  };

  const close = (): void => {
    if (fromSelection) accesSelection.clear();
    onClose();
  };

  const reselect = (): void => {
    const byId = new Map(targets.map((x) => [x.id, x]));
    accesSelection.replace(
      aReselectionner.map(
        (r) =>
          byId.get(r.companyId) ?? {
            id: r.companyId,
            nom: r.nom ?? r.companyId,
            active: true,
            roles: [],
            b2cAcces: false,
            b2bAcces: true,
          },
      ),
    );
    onClose();
  };

  const figures: ReadonlyArray<{ label: string; value: number; cls: string }> = [
    { label: t('accesDemandees'), value: demandees, cls: 'text-de9-ink' },
    { label: t('accesFaites'), value: faites, cls: 'text-[#2FA86A] dark:text-[#6FCF97]' },
    { label: t('accesIgnorees'), value: ignorees, cls: 'text-de9-ink' },
  ];

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !retry.isPending) close();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="flex max-h-[90vh] max-w-[calc(100%-2rem)] flex-col gap-0 rounded-xl bg-card p-6 text-de9-ink sm:max-w-[580px] sm:p-7"
      >
        <DialogTitle className="flex-none text-[19px] leading-normal font-extrabold text-de9-ink">
          {t(ACTIONS[action].resultKey).replace('{n}', String(faites)).replace('{m}', String(demandees))}
        </DialogTitle>

        <div className="mt-4 grid flex-none grid-cols-3 gap-2.5">
          {figures.map((f) => (
            <div key={f.label} className="rounded-md bg-secondary px-3 py-2.5 text-center">
              <div className={cn('text-[20px] leading-tight font-extrabold', f.cls)}>
                <span className="num">{f.value}</span>
              </div>
              <div className="text-[11px] font-semibold text-de9-gray">{f.label}</div>
            </div>
          ))}
        </div>

        <ul className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-md border border-de9-line">
          {resultats.map((r) => {
            const fait = isFait(r);
            return (
              <li key={r.companyId} className="flex items-start gap-2.5 border-b border-de9-line px-3.5 py-2.5 last:border-b-0">
                <span
                  role="img"
                  aria-label={t(fait ? 'accesFait' : 'accesIgnore')}
                  className={cn(
                    'mt-0.5 flex size-5 flex-none items-center justify-center rounded-full',
                    fait
                      ? 'bg-[#E7F6EE] text-[#2FA86A] dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]'
                      : 'bg-[#ECEFF2] text-[#5A6270] dark:bg-[#9AA4B2]/15 dark:text-[#A6AEBD]',
                  )}
                >
                  {fait ? <Check className="size-3.5" strokeWidth={3} /> : <Minus className="size-3.5" strokeWidth={3} />}
                </span>
                <div className="min-w-0 flex-1">
                  {r.nom ? (
                    <div className="truncate text-[13px] font-bold text-de9-ink">
                      <bdi>{r.nom}</bdi>
                    </div>
                  ) : (
                    <div dir="ltr" className="truncate font-mono text-[12px] text-de9-slate rtl:text-right">
                      {r.companyId}
                    </div>
                  )}
                  {r.detail && (
                    <div dir="auto" className="mt-0.5 text-[12px] leading-snug text-de9-slate ltr:text-left rtl:text-right">
                      {r.detail}
                    </div>
                  )}
                  {!!r.enFile?.length && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {r.enFile.map((code) => (
                        <span
                          key={code}
                          className="rounded-full bg-[#EAF2FD] px-2 py-[2px] text-[10.5px] font-bold text-[#2F7FD0] dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]"
                        >
                          {fileLabel(code, t)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex flex-none flex-wrap justify-end gap-2.5">
          {aReessayer.length > 0 && (
            <button
              type="button"
              onClick={onRetry}
              disabled={retry.isPending}
              className="cursor-pointer rounded-full bg-secondary-container px-4 py-2.5 text-[12.5px] font-bold text-on-secondary-container disabled:cursor-not-allowed disabled:opacity-60"
            >
              {retry.isPending ? t('accesTraitement') : t('accesReessayer').replace('{n}', String(aReessayer.length))}
            </button>
          )}
          {fromSelection && aReselectionner.length > 0 && (
            <button
              type="button"
              onClick={reselect}
              disabled={retry.isPending}
              className="cursor-pointer rounded-full border border-de9-line bg-card px-4 py-2.5 text-[12.5px] font-bold text-de9-slate disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('accesReselectionner').replace('{n}', String(aReselectionner.length))}
            </button>
          )}
          <button
            type="button"
            onClick={close}
            disabled={retry.isPending}
            className="cursor-pointer rounded-full bg-primary px-5 py-2.5 text-[12.5px] font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('fermer')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
