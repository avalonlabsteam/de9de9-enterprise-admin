// Tab « Demandes » — what the prestataires asked de9de9 for
// (GET /admin/contractuels/demandes), newest first, with the five counters
// that are also its status filter. The status and the page live in the URL
// (?statut=, ?page=); an alert's ?demande=<id> tints that row.
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Ellipsis } from 'lucide-react';
import { useT, type TKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { problemMessage } from '@/api/problem';
import { FOCUS_ROW_CLASS, useFocusScroll } from '@/lib/useFocusScroll';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Glyph } from '@/components/common/Glyph';
import { fmtAlger } from '@/features/comptabilite/lib/comptabilite';
import { refreshCtr, useCtrCompteurs, useCtrDemandes, useTakeDemande } from '@/features/contractuels/api/contractuels';
import { CloturerDialog } from '@/features/contractuels/components/CloturerDialog';
import { DEMANDES_PAGE_SIZE, ctrProblem, isOuverte, statutPill } from '@/features/contractuels/lib/contractuels';
import type { CtrCompteurs, CtrDemande } from '@/features/contractuels/schemas/contractuels';
import { PlacementsDialog } from './PlacementsDialog';

const GRID = 'grid grid-cols-[1.35fr_1.55fr_0.9fr_0.85fr_0.9fr_0.85fr_260px] gap-3 px-5';
const PILL = 'inline-flex items-center rounded-full px-2.5 py-[5px] text-[11px] font-bold';
const MENU_ITEM = 'cursor-pointer text-[12.5px] font-semibold';

type StatusChip = 'a_traiter' | 'submitted' | 'in_progress' | 'fulfilled' | 'closed';

/** The five chips of guide 23 §5; « À traiter » (sent + being searched) is the default. */
const CHIPS: ReadonlyArray<{ key: StatusChip; field: keyof CtrCompteurs; labelKey: TKey }> = [
  { key: 'a_traiter', field: 'aTraiter', labelKey: 'stChipATraiter' },
  { key: 'submitted', field: 'submitted', labelKey: 'stChipEnvoyees' },
  { key: 'in_progress', field: 'inProgress', labelKey: 'stChipEnCours' },
  { key: 'fulfilled', field: 'fulfilled', labelKey: 'stChipPourvues' },
  { key: 'closed', field: 'closed', labelKey: 'stChipCloturees' },
];

const chipOf = (v: string | null): StatusChip => CHIPS.find((c) => c.key === v)?.key ?? 'a_traiter';

export function DemandesTab({ onVoirPros }: { onVoirPros: (d: CtrDemande) => void }) {
  const t = useT();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const statut = chipOf(sp.get('statut'));
  const page = Math.max(1, Math.floor(Number(sp.get('page'))) || 1);
  const focusId = sp.get('demande');
  const focusRef = useFocusScroll();

  const listQ = useCtrDemandes({ status: statut, page, pageSize: DEMANDES_PAGE_SIZE });
  const compteursQ = useCtrCompteurs();
  const take = useTakeDemande();
  const rows = listQ.data?.items ?? [];
  const total = listQ.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / DEMANDES_PAGE_SIZE));

  const [placements, setPlacements] = useState<CtrDemande | null>(null);
  const [cloturer, setCloturer] = useState<CtrDemande | null>(null);

  const patch = (changes: Record<string, string | null>): void => {
    setSp(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        return next;
      },
      { replace: true },
    );
  };

  const prendre = (d: CtrDemande): void => {
    take.mutate(d.id, {
      onSuccess: () => toast.success(t('stPriseToast')),
      onError: (err) => {
        toast.error(problemMessage(err));
        const { status } = ctrProblem(err);
        if (status === 404 || status === 409) refreshCtr();
      },
    });
  };

  return (
    <div>
      {/* counters — GET /admin/contractuels/demandes/compteurs; each one filters the list */}
      <div className="mt-[14px] grid grid-cols-2 gap-3 sm:grid-cols-5 sm:max-w-[860px]">
        {CHIPS.map((c) => {
          const active = statut === c.key;
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={active}
              onClick={() => patch({ statut: c.key === 'a_traiter' ? null : c.key, page: null, demande: null })}
              className={cn(
                'cursor-pointer rounded-md border border-de9-line bg-card px-4 py-3 text-start',
                active && 'ring-2 ring-primary',
              )}
            >
              <div className="truncate text-xs font-semibold text-de9-gray">{t(c.labelKey)}</div>
              <div className="mt-1 text-[22px] leading-none font-extrabold text-de9-ink">
                <span className="num">{compteursQ.data ? compteursQ.data[c.field] : '—'}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-3.5 overflow-hidden rounded-md border border-de9-line bg-card">
        <div className={cn('overflow-x-auto transition-opacity', listQ.isPlaceholderData && 'opacity-60')}>
          <div className="min-w-[1060px]">
            <div className={cn(GRID, 'border-b border-de9-line bg-secondary py-[13px] text-[10.5px] font-bold tracking-[.04em] text-de9-gray uppercase')}>
              <div>{t('stColEntreprise')}</div>
              <div>{t('stColCatSub')}</div>
              <div>{t('stColZone')}</div>
              <div>{t('stColPros')}</div>
              <div>{t('stColStatut')}</div>
              <div>{t('stColDate')}</div>
              <div className="text-end">{t('stColActions')}</div>
            </div>

            {listQ.isPending && (
              <div className="px-5 py-3.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="mb-3 h-11 animate-pulse rounded-sm bg-de9-row last:mb-0" />
                ))}
              </div>
            )}
            {listQ.isError && (
              <div className="px-5 py-4 text-[12.5px] font-semibold text-de9-red">
                {t('stErreurDemandes')} — {problemMessage(listQ.error)}
              </div>
            )}

            {rows.map((d) => {
              const pill = statutPill(d, t);
              const ratio = d.requestedCount > 0 ? Math.min(1, d.fulfilledCount / d.requestedCount) : 0;
              const busy = take.isPending && take.variables === d.id;
              return (
                <div
                  key={d.id}
                  ref={d.id === focusId ? focusRef : undefined}
                  className={cn('border-b border-de9-line py-3.5', d.id === focusId && FOCUS_ROW_CLASS)}
                >
                  <div className={cn(GRID, 'items-center')}>
                    <div className="min-w-0 text-[13px] font-bold">
                      {d.prestataireCompanyId ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/entreprises/${encodeURIComponent(d.prestataireCompanyId ?? '')}?cote=prestataire`)}
                          className="cursor-pointer text-start underline decoration-[#C7CFD7] decoration-dotted underline-offset-[3px]"
                        >
                          <bdi>{d.companyName ?? '—'}</bdi>
                        </button>
                      ) : (
                        <bdi>{d.companyName ?? '—'}</bdi>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-[12.5px] font-semibold text-de9-ink">{d.categoryLabel ?? '—'}</div>
                      {d.subcategoryLabel && <div className="truncate text-[11.5px] text-de9-gray">{d.subcategoryLabel}</div>}
                    </div>
                    <div className="min-w-0 text-[12px] text-de9-slate">
                      {d.wilaya ?? '—'}
                      {d.commune && <div className="text-[11px] text-de9-gray">{d.commune}</div>}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-bold text-de9-ink">
                        <span className="num">
                          {d.fulfilledCount} / {d.requestedCount}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full max-w-[90px] overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${ratio * 100}%` }} />
                      </div>
                    </div>
                    <div>
                      <span className={cn(PILL, pill.chip)}>{pill.label}</span>
                    </div>
                    <div className="text-[12px] text-de9-slate">
                      <span className="num">{fmtAlger(d.createdAt, false) ?? '—'}</span>
                    </div>
                    <div className="flex items-center justify-end gap-1.5">
                      {d.status === 'submitted' && (
                        <button
                          type="button"
                          onClick={() => prendre(d)}
                          disabled={busy}
                          className="cursor-pointer rounded-full bg-secondary-container px-3 py-1.5 text-[11.5px] font-bold whitespace-nowrap text-on-secondary-container disabled:opacity-60"
                        >
                          {t('stPrendre')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onVoirPros(d)}
                        className="cursor-pointer rounded-full bg-primary px-3 py-1.5 text-[11.5px] font-bold whitespace-nowrap text-primary-foreground"
                      >
                        {t('stVoirPros')} <Glyph icon={ArrowRight} className="rtl:rotate-180" />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={t('stActionsDe').replace('{n}', d.companyName ?? '—')}
                            className="flex size-8 flex-none cursor-pointer items-center justify-center rounded-full text-de9-slate hover:bg-secondary"
                          >
                            <Ellipsis className="size-[18px]" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[220px]">
                          <DropdownMenuItem onSelect={() => setPlacements(d)} className={MENU_ITEM}>
                            {t('stVoirPlacements')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => navigate(`/contractuels/${encodeURIComponent(d.id)}`)} className={MENU_ITEM}>
                            {t('stOuvrirDemande')}
                          </DropdownMenuItem>
                          {isOuverte(d) && (
                            <DropdownMenuItem variant="destructive" onSelect={() => setCloturer(d)} className={MENU_ITEM}>
                              {t('stCloturer')}…
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {d.note && (
                    <div dir="auto" className="mt-1.5 px-5 text-[11.5px] leading-snug text-de9-gray ltr:text-left rtl:text-right">
                      {d.note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {listQ.isSuccess && rows.length === 0 && (
          <div className="p-11 text-center text-sm text-de9-gray">{t('stAucuneDemande')}</div>
        )}

        {listQ.isSuccess && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-de9-line px-5 py-3">
            <div className="text-[12.5px] font-semibold text-de9-gray">
              {t('stNDemandes').replace('{n}', String(total))}
              {pages > 1 && ' · ' + t('worklistPageInfo').replace('{n}', String(page)).replace('{m}', String(pages))}
            </div>
            {pages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => patch({ page: page > 2 ? String(page - 1) : null })}
                  className="cursor-pointer rounded-full border border-de9-line bg-card px-[13px] py-2 text-[12.5px] font-bold text-de9-slate disabled:cursor-default disabled:opacity-40"
                >
                  {t('pagePrecedent')}
                </button>
                <button
                  type="button"
                  disabled={page >= pages}
                  onClick={() => patch({ page: String(page + 1) })}
                  className="cursor-pointer rounded-full border border-de9-line bg-card px-[13px] py-2 text-[12.5px] font-bold text-de9-slate disabled:cursor-default disabled:opacity-40"
                >
                  {t('pageSuivant')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {placements && <PlacementsDialog demande={placements} onClose={() => setPlacements(null)} />}
      {cloturer && <CloturerDialog demande={cloturer} onClose={() => setCloturer(null)} />}
    </div>
  );
}
