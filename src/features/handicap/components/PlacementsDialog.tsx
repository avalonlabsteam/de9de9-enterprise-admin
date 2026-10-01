// The state of one demande — GET /handicap/{id}/placements: who is placed
// there, « Terminer… » / « Annuler » on each, and « Placer » for the positions
// still open. Every placement route answers the demande's new state, which the
// api hooks store, so the dialog repaints from the answer.
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { problemMessage } from '@/api/problem';
import { Checkbox } from '@/components/ui/checkbox';
import { Glyph } from '@/components/common/Glyph';
import {
  reloadHandicap,
  useAnnulerPlacement,
  useCandidats,
  useDemandeEtat,
  usePlacer,
  useTerminerPlacement,
} from '../api/handicap';
import {
  HC_TEXT_MAX,
  PLACER_MAX,
  type Candidat,
  type CandidatParams,
  type HandicapItem,
  type Placement,
} from '../schemas/handicap';
import {
  BTN_OUTLINE,
  CHIP_BLUE,
  CHIP_GREY,
  INPUT_CLS,
  PILL,
  PILL_OFF,
  PILL_ON,
  hcErrorMessage,
  hcProblem,
  isStale,
  shortDate,
  statutMeta,
  statutOf,
} from '../lib/handicap';
import { ConfirmDialog, DialogActions, DialogFrame, FormField, Pill } from './shared';

const SEARCH_DEBOUNCE_MS = 300;
const SECTION = 'text-[10.5px] font-extrabold uppercase tracking-[.04em] text-de9-gray';

export function PlacementsDialog({ demande, onClose }: { demande: HandicapItem; onClose: () => void }) {
  const t = useT();
  const etatQ = useDemandeEtat(demande.id);
  const etat = etatQ.data;
  const [ending, setEnding] = useState<Placement | null>(null);
  const [cancelling, setCancelling] = useState<Placement | null>(null);
  const annuler = useAnnulerPlacement();

  // The fresh state once it is there; the row's own figures while it loads.
  const positions = etat?.positionsCount ?? demande.positionsCount ?? 0;
  const placed = etat?.placedCount ?? demande.placedCount ?? 0;
  const restant = etat?.restant ?? Math.max(positions - placed, 0);
  const statut = statutMeta(etat?.statut ?? statutOf(demande), t);
  const linked = !!(etat?.companyId ?? demande.companyId);
  const gone = etatQ.isError && hcProblem(etatQ.error).status === 404;

  const confirmAnnuler = (): void => {
    if (!cancelling) return;
    annuler.mutate(cancelling.id, {
      onSuccess: () => {
        toast.success(t('hcToastAnnule'));
        setCancelling(null);
      },
      onError: (err) => {
        toast.error(hcErrorMessage(err, t));
        if (isStale(hcProblem(err))) {
          reloadHandicap();
          setCancelling(null);
        }
      },
    });
  };

  return (
    <DialogFrame title={t('hcPlacementsTitre')} onClose={onClose} size="lg">
      {/* ===== the demande ===== */}
      <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <span className="text-[15px] font-extrabold text-de9-ink">
          <bdi>{etat?.companyName ?? demande.companyName}</bdi>
        </span>
        <Pill className={statut.chip}>{statut.label}</Pill>
      </div>
      <div className="mt-0.5 text-[12.5px] text-de9-slate">
        <bdi>{etat?.jobType ?? demande.jobType ?? '—'}</bdi>
        {demande.wilaya && (
          <>
            {' · '}
            <bdi>{demande.wilaya}</bdi>
          </>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary" aria-hidden>
          <div
            className="h-full rounded-full bg-[#2FA86A]"
            style={{ width: `${positions > 0 ? Math.min((placed / positions) * 100, 100) : 0}%` }}
          />
        </div>
        <span className="flex-none text-[12.5px] font-bold text-de9-ink">
          {t('hcPlacesRestants')
            .replace('{n}', String(placed))
            .replace('{m}', String(positions))
            .replace('{r}', String(restant))}
        </span>
      </div>

      {etatQ.isPending && <div className="mt-5 h-40 animate-pulse rounded-md bg-secondary" />}

      {etatQ.isError && (
        <div className="mt-5 rounded-md border border-[#F3C9CB] bg-[#FDECEC] px-4 py-3 text-[12.5px] font-semibold text-de9-red dark:border-[#E7464E]/40 dark:bg-[#E7464E]/15">
          {gone ? t('hcErrDemandeIntrouvable') : problemMessage(etatQ.error)}
        </div>
      )}

      {etat && (
        <>
          {/* ===== who is placed ===== */}
          <div className={cn(SECTION, 'mt-6')}>{t('hcPersonnesPlacees')}</div>
          {etat.placements.length === 0 ? (
            <div className="mt-2 text-[12.5px] text-de9-gray">{t('hcAucunPlacement')}</div>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {etat.placements.map((p) => (
                <PlacementRow
                  key={p.id}
                  placement={p}
                  onTerminer={() => setEnding(p)}
                  onAnnuler={() => setCancelling(p)}
                />
              ))}
            </ul>
          )}

          {/* ===== place more ===== */}
          <div className={cn(SECTION, 'mt-6')}>{t('hcPlacerTitre')}</div>
          {restant > 0 ? (
            <Picker demande={demande} restant={restant} onGone={onClose} />
          ) : (
            <div className="mt-2 text-[12.5px] leading-relaxed text-de9-gray">{t('hcPourvueInfo')}</div>
          )}
        </>
      )}

      <button
        type="button"
        onClick={onClose}
        className="mt-6 w-full cursor-pointer rounded-full border border-de9-line bg-card p-3 text-center text-sm font-bold text-de9-slate"
      >
        {t('btnClose')}
      </button>

      {ending && <TerminerDialog placement={ending} linked={linked} onClose={() => setEnding(null)} />}
      {cancelling && (
        <ConfirmDialog
          title={t('hcAnnulerTitre')}
          confirmLabel={t('hcAnnulerConfirmer')}
          // The action is itself called « Annuler »: the way out must read differently.
          cancelLabel={t('hcRetour')}
          pending={annuler.isPending}
          onConfirm={confirmAnnuler}
          onClose={() => setCancelling(null)}
        >
          {t('hcAnnulerTexte').replace('{n}', cancelling.candidatName ?? '—')}
        </ConfirmDialog>
      )}
    </DialogFrame>
  );
}

function PlacementRow({
  placement: p,
  onTerminer,
  onAnnuler,
}: {
  placement: Placement;
  onTerminer: () => void;
  onAnnuler: () => void;
}) {
  const t = useT();
  return (
    <li className={cn('rounded-md border border-de9-line px-3.5 py-3', !p.actif && 'bg-secondary/50')}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('text-[13.5px] font-bold', p.actif ? 'text-de9-ink' : 'text-de9-slate')}>
              <bdi>{p.candidatName ?? '—'}</bdi>
            </span>
            <Pill className={p.actif ? CHIP_BLUE : CHIP_GREY}>{t(p.actif ? 'hcEnPoste' : 'hcTermine')}</Pill>
          </div>
          <div className="mt-0.5 text-[11.5px] text-de9-gray">
            {[p.candidatJobType, p.candidatPhone].filter(Boolean).map((part, i) => (
              <span key={i}>
                {i > 0 && ' · '}
                <bdi>{part}</bdi>
              </span>
            ))}
          </div>
        </div>
        {p.actif && (
          <div className="flex flex-none gap-2">
            <button type="button" onClick={onTerminer} className={BTN_OUTLINE}>
              {t('hcTerminer')}
            </button>
            <button type="button" onClick={onAnnuler} className={cn(BTN_OUTLINE, 'text-de9-red')}>
              {t('hcAnnulerPlacement')}
            </button>
          </div>
        )}
      </div>
      <div className="mt-1.5 text-[11.5px] text-de9-slate">
        {t('hcPlaceLe').replace('{n}', shortDate(p.placedAt))}
        {!p.actif && p.endedAt && ' — ' + t('hcTermineLe').replace('{n}', shortDate(p.endedAt))}
      </div>
      {p.note && (
        <div dir="auto" className="mt-1 text-[12px] leading-snug text-de9-slate ltr:text-left rtl:text-right">
          {p.note}
        </div>
      )}
      {!p.actif && p.endReason && (
        <div dir="auto" className="mt-1 text-[12px] leading-snug text-de9-gray ltr:text-left rtl:text-right">
          {p.endReason}
        </div>
      )}
    </li>
  );
}

/** « Terminer… » — the placement stays as history; the motif is optional. */
function TerminerDialog({ placement, linked, onClose }: { placement: Placement; linked: boolean; onClose: () => void }) {
  const t = useT();
  const terminer = useTerminerPlacement();
  const [motif, setMotif] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (): void => {
    terminer.mutate(
      { placementId: placement.id, motif: motif.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(t('hcToastTermine'));
          onClose();
        },
        onError: (err) => {
          const p = hcProblem(err);
          if (p.status === 400) {
            setError(hcErrorMessage(err, t));
            return;
          }
          toast.error(hcErrorMessage(err, t));
          if (isStale(p)) {
            reloadHandicap();
            onClose();
          }
        },
      },
    );
  };

  return (
    <DialogFrame
      title={t('hcTerminerTitre')}
      lead={
        t('hcTerminerTexte').replace('{n}', placement.candidatName ?? '—') +
        (linked ? ' ' + t('hcEntreprisePrevenue') : '')
      }
      onClose={onClose}
      locked={terminer.isPending}
      size="sm"
    >
      <FormField label={t('hcMotif')} error={error ?? undefined} className="mt-4">
        <textarea
          value={motif}
          onChange={(e) => {
            setMotif(e.target.value);
            setError(null);
          }}
          rows={3}
          dir="auto"
          maxLength={HC_TEXT_MAX}
          placeholder={t('hcMotifPh')}
          className={cn(INPUT_CLS, 'resize-y')}
        />
      </FormField>
      <DialogActions
        onCancel={onClose}
        submitLabel={t('hcTerminerConfirmer')}
        pending={terminer.isPending}
        onSubmit={submit}
      />
    </DialogFrame>
  );
}

/**
 * The people with no active placement, in the demande's wilaya first. Several
 * can be ticked at once, never more than the positions left; the call is all
 * or none.
 */
function Picker({ demande, restant, onGone }: { demande: HandicapItem; restant: number; onGone: () => void }) {
  const t = useT();
  const placer = usePlacer();
  const limit = Math.min(restant, PLACER_MAX);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [wilayaOnly, setWilayaOnly] = useState(!!demande.wilaya);
  // Kept with the person, not just the id: a selection must outlive a search
  // that no longer lists them.
  const [selected, setSelected] = useState<ReadonlyMap<string, Candidat>>(new Map());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  const params: CandidatParams = {
    disponible: true,
    ...(wilayaOnly && demande.wilaya ? { wilaya: demande.wilaya } : {}),
    ...(search ? { search } : {}),
  };
  const listQ = useCandidats(params);
  const people = listQ.data?.pages.flatMap((p) => p.data) ?? [];
  const full = selected.size >= limit;

  const toggle = (c: Candidat): void => {
    setError(null);
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(c.id)) next.delete(c.id);
      else if (next.size < limit) next.set(c.id, c);
      return next;
    });
  };

  const submit = (): void => {
    if (selected.size === 0) return;
    const count = selected.size;
    placer.mutate(
      { registrationId: demande.id, candidatIds: [...selected.keys()], note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(t('hcToastPlaces').replace('{n}', String(count)));
          setSelected(new Map());
          setNote('');
          setError(null);
        },
        onError: (err) => {
          const p = hcProblem(err);
          const message = hcErrorMessage(err, t);
          // A refused field is said next to the form.
          if (p.status === 400) {
            setError(message);
            return;
          }
          toast.error(message);
          // The demande was deleted: back to the list.
          if (p.code === 'not_found') {
            reloadHandicap();
            onGone();
            return;
          }
          // Someone was deleted or placed by a colleague, or the positions
          // filled up: nobody was placed. Drop the people named and reload.
          if (p.candidatIds.length) {
            setSelected((prev) => {
              const next = new Map(prev);
              for (const id of p.candidatIds) next.delete(id);
              return next;
            });
          }
          if (isStale(p)) reloadHandicap();
        },
      },
    );
  };

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('hcRecherchePersonne')}
          aria-label={t('hcRecherchePersonne')}
          className="min-w-0 flex-1 rounded-xs border border-outline bg-card px-3.5 py-2 text-[12.5px] text-de9-ink outline-none"
        />
        {demande.wilaya && (
          <button
            type="button"
            aria-pressed={wilayaOnly}
            onClick={() => setWilayaOnly((v) => !v)}
            className={cn(PILL, 'flex-none', wilayaOnly ? PILL_ON : PILL_OFF)}
          >
            {t('hcWilayaSeule').replace('{n}', demande.wilaya)}
          </button>
        )}
      </div>

      <div className={cn('mt-2 max-h-[236px] overflow-y-auto rounded-md border border-de9-line', listQ.isPlaceholderData && 'opacity-60')}>
        {listQ.isPending && <div className="m-3 h-16 animate-pulse rounded-sm bg-de9-row" />}
        {listQ.isError && (
          <div className="px-3.5 py-3 text-[12.5px] font-semibold text-de9-red">{problemMessage(listQ.error)}</div>
        )}
        {listQ.isSuccess && people.length === 0 && (
          <div className="px-3.5 py-4 text-center text-[12.5px] text-de9-gray">{t('hcAucunDisponible')}</div>
        )}
        {people.map((c) => {
          const checked = selected.has(c.id);
          const blocked = !checked && full;
          return (
            <label
              key={c.id}
              className={cn(
                'flex items-start gap-3 border-b border-de9-line px-3.5 py-2.5 last:border-b-0',
                blocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-de9-row',
              )}
            >
              <Checkbox
                checked={checked}
                disabled={blocked || placer.isPending}
                onCheckedChange={() => toggle(c)}
                className="mt-0.5"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold text-de9-ink">
                  <bdi>{c.fullName}</bdi>
                </span>
                <span className="block text-[11.5px] text-de9-gray">
                  {[c.jobType, c.wilaya, c.phone].filter(Boolean).map((part, i) => (
                    <span key={i}>
                      {i > 0 && ' · '}
                      <bdi>{part}</bdi>
                    </span>
                  ))}
                </span>
                {c.competences && (
                  <span dir="auto" className="mt-0.5 line-clamp-1 block text-[11.5px] text-de9-slate ltr:text-left rtl:text-right">
                    {c.competences}
                  </span>
                )}
              </span>
            </label>
          );
        })}
        {listQ.hasNextPage && (
          <button
            type="button"
            disabled={listQ.isFetchingNextPage}
            onClick={() => void listQ.fetchNextPage()}
            className="w-full cursor-pointer px-3.5 py-2.5 text-center text-[12px] font-bold text-de9-slate disabled:opacity-40"
          >
            {listQ.isFetchingNextPage ? '…' : t('chargerPlus')}
          </button>
        )}
      </div>

      {/* the selection, kept in sight whatever the search shows */}
      {selected.size > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {[...selected.values()].map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded-full bg-secondary-container py-1 ps-2.5 pe-1 text-[11.5px] font-bold text-on-secondary-container"
            >
              <bdi>{c.fullName}</bdi>
              <button
                type="button"
                onClick={() => toggle(c)}
                aria-label={t('hcRetirer').replace('{n}', c.fullName)}
                className="flex size-5 cursor-pointer items-center justify-center rounded-full text-[11px]"
              >
                <Glyph icon={X} />
              </button>
            </span>
          ))}
        </div>
      )}

      <FormField label={t('hcNoteFacultative')} error={error ?? undefined} className="mt-3">
        <textarea
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setError(null);
          }}
          rows={2}
          dir="auto"
          maxLength={HC_TEXT_MAX}
          placeholder={t('hcNotePlacementPh')}
          className={cn(INPUT_CLS, 'resize-y')}
        />
      </FormField>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[12px] font-semibold text-de9-gray">
          {t('hcSelection').replace('{n}', String(selected.size)).replace('{m}', String(limit))}
        </span>
        <button
          type="button"
          onClick={submit}
          disabled={selected.size === 0 || placer.isPending}
          className="cursor-pointer rounded-full bg-primary px-5 py-2.5 text-[12.5px] font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {placer.isPending
            ? t('hcEnCours')
            : selected.size > 0
              ? t('hcPlacerN').replace('{n}', String(selected.size))
              : t('hcPlacer')}
        </button>
      </div>
    </div>
  );
}
