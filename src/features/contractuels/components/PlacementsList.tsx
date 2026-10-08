// The pros placed on one demande — still working there first — with
// « Libérer », whose reason is required. Shared by the demande screen and the
// placements dialog of « Sous-traitance ».
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { problemMessage } from '@/api/problem';
import { PhoneNumber } from '@/components/common/PhoneNumber';
import { fmtAlger } from '@/features/comptabilite/lib/comptabilite';
import { refreshCtr, useReleasePlacement } from '../api/contractuels';
import { CHIP_GREEN, CHIP_GREY, REASON_MAX, ctrProblem } from '../lib/contractuels';
import type { CtrPlacement } from '../schemas/contractuels';

const PILL = 'inline-flex items-center rounded-full px-2.5 py-[4px] text-[11px] font-bold';

export function PlacementsList({ placements }: { placements: CtrPlacement[] }) {
  const t = useT();
  const release = useReleasePlacement();
  // The placement whose « Libérer » form is open, and what was typed in it.
  const [releasing, setReleasing] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sorted = [...placements].sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active'));
  const text = reason.trim();

  const open = (id: string): void => {
    setReleasing(id);
    setReason('');
    setError(null);
  };

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (!releasing || !text || release.isPending) return;
    release.mutate(
      { placementId: releasing, reason: text },
      {
        onSuccess: () => {
          toast.success(t('stLibereToast'));
          setReleasing(null);
        },
        onError: (err) => {
          const p = ctrProblem(err);
          if (p.status === 400) {
            setError(problemMessage(err));
            return;
          }
          toast.error(problemMessage(err));
          // Gone or already released by a colleague: what is on screen is stale.
          if (p.status === 404 || p.status === 409) {
            refreshCtr();
            setReleasing(null);
          }
        },
      },
    );
  };

  if (sorted.length === 0) return <div className="py-6 text-center text-[13px] text-de9-gray">{t('stAucunPlacement')}</div>;

  return (
    <div className="flex flex-col">
      {sorted.map((pl) => {
        const actif = pl.status === 'active';
        return (
          <div key={pl.id} className="border-b border-de9-line py-3 last:border-b-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <div className="min-w-[150px] flex-1">
                <bdi className="text-[13px] font-bold text-de9-ink">{pl.displayName ?? '—'}</bdi>
                <div className="mt-0.5 text-[11.5px] text-de9-gray">
                  {pl.placedAt && t('stPlaceLe').replace('{n}', fmtAlger(pl.placedAt, false) ?? '—')}
                  {!actif && pl.releasedAt && <> · {t('stLibereLe').replace('{n}', fmtAlger(pl.releasedAt, false) ?? '—')}</>}
                </div>
              </div>
              {pl.phone && <PhoneNumber value={pl.phone} className="text-[12px] font-semibold text-de9-slate" />}
              <span className={cn(PILL, actif ? CHIP_GREEN : CHIP_GREY)}>{t(actif ? 'stEnPoste' : 'stLibere')}</span>
              {actif && releasing !== pl.id && (
                <button
                  type="button"
                  onClick={() => open(pl.id)}
                  className="cursor-pointer rounded-full border border-de9-red bg-card px-3 py-1.5 text-[11.5px] font-bold text-de9-red"
                >
                  {t('stLiberer')}
                </button>
              )}
            </div>
            {!actif && pl.releaseReason && (
              <div dir="auto" className="mt-1 text-[11.5px] text-de9-gray ltr:text-left rtl:text-right">
                {pl.releaseReason}
              </div>
            )}

            {releasing === pl.id && (
              <form onSubmit={submit} noValidate className="mt-2.5 rounded-md bg-secondary p-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-de9-slate">{t('stLibererMotif')}</span>
                  <textarea
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      if (error) setError(null);
                    }}
                    maxLength={REASON_MAX}
                    rows={2}
                    autoFocus
                    disabled={release.isPending}
                    aria-invalid={!!error}
                    className={cn(
                      'w-full resize-y rounded-xs border bg-card px-3 py-2 text-[13px] text-de9-ink outline-none disabled:opacity-60',
                      error ? 'border-de9-red' : 'border-outline focus:border-de9-teal',
                    )}
                  />
                </label>
                <div className="mt-1 flex justify-between gap-3 text-[11.5px]">
                  <span role={error ? 'alert' : undefined} className="font-semibold text-de9-red">
                    {error}
                  </span>
                  <span className="num flex-none text-de9-gray">
                    {text.length} / {REASON_MAX}
                  </span>
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setReleasing(null)}
                    disabled={release.isPending}
                    className="cursor-pointer rounded-full border border-de9-line bg-card px-3.5 py-2 text-[12px] font-bold text-de9-slate disabled:opacity-50"
                  >
                    {t('annuler')}
                  </button>
                  <button
                    type="submit"
                    disabled={release.isPending || !text}
                    className="cursor-pointer rounded-full bg-de9-red px-3.5 py-2 text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {release.isPending ? t('accesTraitement') : t('stLibererConfirm')}
                  </button>
                </div>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}
