// « + Ajouter comme salarié » — POST /admin/contractuels/demandes/{id}/placements.
// From a demande the question is direct; from the plain directory the admin
// first picks the open demande to place the pro on.
import { useState } from 'react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { problemMessage } from '@/api/problem';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { refreshCtr, useCtrDemandes, usePlacerPro } from '@/features/contractuels/api/contractuels';
import { ctrProblem, restantOf } from '@/features/contractuels/lib/contractuels';
import type { CtrDemande, CtrPro } from '@/features/contractuels/schemas/contractuels';

interface PlacerDialogProps {
  pro: CtrPro;
  /** The demande the tab was opened from; null = choose one here. */
  demande: CtrDemande | null;
  onClose: () => void;
  /** The demande no longer exists: leave its context. */
  onDemandeGone: () => void;
}

export function PlacerDialog({ pro, demande, onClose, onDemandeGone }: PlacerDialogProps) {
  const t = useT();
  const placer = usePlacerPro();
  const [choisie, setChoisie] = useState<CtrDemande | null>(demande);
  const [error, setError] = useState<{ detail: string; retry: boolean } | null>(null);
  // Only the open demandes that still have a seat.
  const openQ = useCtrDemandes({ status: 'a_traiter', page: 1, pageSize: 100 }, !demande);
  const ouvertes = (openQ.data?.items ?? []).filter((d) => restantOf(d) > 0);
  const nom = pro.fullName ?? '—';

  const submit = (): void => {
    if (!choisie || placer.isPending) return;
    setError(null);
    placer.mutate(
      { demandeId: choisie.id, legacyProUserId: pro.legacyProUserId },
      {
        onSuccess: (res) => {
          toast.success(
            t('stPlaceToast')
              .replace('{pro}', res.placement.displayName ?? nom)
              .replace('{entreprise}', res.demande.companyName ?? choisie.companyName ?? '—'),
          );
          onClose();
        },
        onError: (err) => {
          const p = ctrProblem(err);
          const detail = problemMessage(err);
          if (p.code === 'contractuel_demande_not_found') {
            toast.error(detail);
            refreshCtr();
            onClose();
            if (demande) onDemandeGone();
          } else if (p.code === 'pro_not_found' || p.code === 'already_placed' || p.code === 'contractuel_demande_full') {
            // What the row or the banner says is stale: refetch them.
            toast.error(detail);
            refreshCtr();
            onClose();
          } else if (p.code === 'legacy_unavailable' || p.sansReponse) {
            setError({ detail, retry: true });
          } else {
            setError({ detail, retry: false });
            if (p.status === 409) refreshCtr();
          }
        },
      },
    );
  };

  const [titleBefore, titleMiddle = '', titleAfter = ''] = t('stPlacerTitre').split(/\{pro\}|\{entreprise\}/);

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !placer.isPending) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="block max-h-[90vh] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-xl bg-card p-6 text-de9-ink sm:max-w-[520px] sm:p-7"
      >
        {demande ? (
          <>
            <DialogTitle className="text-[19px] leading-normal font-extrabold text-de9-ink">
              {titleBefore}
              <bdi>{nom}</bdi>
              {titleMiddle}
              <bdi>{demande.companyName ?? '—'}</bdi>
              {titleAfter}
            </DialogTitle>
            <DialogDescription className="mt-2.5 text-[13px] leading-relaxed text-de9-slate">
              <bdi>{[demande.categoryLabel, demande.subcategoryLabel, demande.wilaya].filter(Boolean).join(' · ')}</bdi>
              {' — '}
              {t('stRestant').replace('{n}', String(restantOf(demande)))}
            </DialogDescription>
          </>
        ) : (
          <>
            <DialogTitle className="text-[19px] leading-normal font-extrabold text-de9-ink">
              {t('stPlacerSansDemande').replace('{pro}', nom)}
            </DialogTitle>
            <DialogDescription className="mt-2 text-[13px] text-de9-slate">{t('stPlacerChoisir')}</DialogDescription>
            <div role="radiogroup" className="mt-3 flex max-h-[300px] flex-col gap-2 overflow-y-auto">
              {openQ.isPending && <div className="h-[72px] animate-pulse rounded-md bg-secondary" />}
              {openQ.isError && <div className="text-[12.5px] font-semibold text-de9-red">{problemMessage(openQ.error)}</div>}
              {openQ.isSuccess && ouvertes.length === 0 && (
                <div className="py-4 text-center text-[13px] text-de9-gray">{t('stPlacerAucuneDemande')}</div>
              )}
              {ouvertes.map((d) => {
                const on = choisie?.id === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      setChoisie(d);
                      setError(null);
                    }}
                    className={cn(
                      'cursor-pointer rounded-md border px-3.5 py-2.5 text-start',
                      on ? 'border-primary bg-[#ECFAF8] dark:bg-[#2C9C94]/15' : 'border-de9-line bg-card',
                    )}
                  >
                    <bdi className="text-[13px] font-bold text-de9-ink">{d.companyName ?? '—'}</bdi>
                    <div className="mt-0.5 text-[11.5px] text-de9-gray">
                      <bdi>{[d.categoryLabel, d.subcategoryLabel, d.wilaya].filter(Boolean).join(' · ')}</bdi>
                    </div>
                    <div className="mt-0.5 text-[11.5px] font-semibold text-de9-slate">
                      <span className="num">
                        {d.fulfilledCount} / {d.requestedCount}
                      </span>{' '}
                      — {t('stRestant').replace('{n}', String(restantOf(d)))}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {error && (
          <div role="alert" dir="auto" className="mt-4 rounded-md bg-[#FDECEC] px-3.5 py-3 text-[12.5px] leading-relaxed font-semibold text-de9-red ltr:text-left rtl:text-right dark:bg-[#E7464E]/15">
            {error.detail}
          </div>
        )}

        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={placer.isPending}
            className="flex-1 cursor-pointer rounded-full border border-de9-line bg-card p-3 text-sm font-bold text-de9-slate disabled:opacity-50"
          >
            {t('annuler')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!choisie || placer.isPending || (!!error && !error.retry)}
            className="flex-1 cursor-pointer rounded-full bg-primary p-3 text-sm font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {placer.isPending ? t('accesTraitement') : error?.retry ? t('reessayer') : t('stConfirmerSalarie')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
