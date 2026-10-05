import { useT } from '@/lib/i18n';
import { problemMessage } from '@/api/problem';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useCtrDemande } from '@/features/contractuels/api/contractuels';
import { PlacementsList } from '@/features/contractuels/components/PlacementsList';
import type { CtrDemande } from '@/features/contractuels/schemas/contractuels';

/** « Voir les placements » — GET /admin/contractuels/demandes/{id}: who is placed, « Libérer ». */
export function PlacementsDialog({ demande, onClose }: { demande: CtrDemande; onClose: () => void }) {
  const t = useT();
  const detailQ = useCtrDemande(demande.id);
  const d = detailQ.data?.demande ?? demande;
  const [titleBefore, titleAfter = ''] = t('stPlacementsTitre').split('{nom}');

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="block max-h-[90vh] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-xl bg-card p-6 text-de9-ink sm:max-w-[560px] sm:p-7"
      >
        <DialogTitle className="text-[19px] leading-normal font-extrabold text-de9-ink">
          {titleBefore}
          <bdi>{d.companyName ?? '—'}</bdi>
          {titleAfter}
        </DialogTitle>
        <div className="mt-1 text-[12.5px] text-de9-gray">
          <bdi>{[d.categoryLabel, d.subcategoryLabel, d.wilaya].filter(Boolean).join(' · ')}</bdi>
          {' — '}
          <span className="num">
            {d.fulfilledCount} / {d.requestedCount}
          </span>
        </div>

        <div className="mt-3">
          {detailQ.isPending && <div className="h-[90px] animate-pulse rounded-md bg-secondary" />}
          {detailQ.isError && <div className="py-4 text-[12.5px] font-semibold text-de9-red">{problemMessage(detailQ.error)}</div>}
          {detailQ.data && <PlacementsList placements={detailQ.data.placements} />}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full bg-primary px-5 py-2.5 text-[12.5px] font-bold text-primary-foreground"
          >
            {t('fermer')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
