// Tab « Demandes » — what the entreprises asked for (GET /handicap) and how far
// each one is: placed / positions, status, « Contacté ». The server filters
// (search / wilaya / jobType / contacted); rows accumulate via « Charger plus ».
// An alert's ?inscription=<id> marks its row.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useL, useT } from '@/lib/i18n';
import { useLangStore } from '@/stores/langStore';
import { cn } from '@/lib/utils';
import { FOCUS_ROW_CLASS, useFocusScroll } from '@/lib/useFocusScroll';
import { problemMessage } from '@/api/problem';
import { Glyph } from '@/components/common/Glyph';
import { useWilayas } from '@/features/geo/api/geo';
import { reloadHandicap, useDeleteDemande, useHandicapList, useSetContacted } from '../api/handicap';
import { HC_TEXT_MAX, type HandicapItem, type HandicapParams } from '../schemas/handicap';
import {
  BODY_ROW,
  BTN_OUTLINE,
  BTN_TONAL,
  HEAD_ROW,
  INPUT_CLS,
  LINK_CLS,
  PILL,
  PILL_OFF,
  PILL_ON,
  SEARCH_CLS,
  dayLabel,
  hcErrorMessage,
  hcProblem,
  isStale,
  statutMeta,
  statutOf,
} from '../lib/handicap';
import {
  ConfirmDialog,
  ContactLinks,
  DialogActions,
  DialogFrame,
  FilterSelect,
  FormField,
  IconButton,
  LoadMore,
  Pill,
  RowsSkeleton,
} from './shared';
import { DemandeFormDialog } from './DemandeFormDialog';
import { PlacementsDialog } from './PlacementsDialog';

const SEARCH_DEBOUNCE_MS = 300;
const GRID = 'grid [grid-template-columns:1.45fr_1.3fr_1.5fr_0.9fr_0.6fr_0.95fr_0.6fr_244px]';

type ContactedFilter = 'all' | 'yes' | 'no';

interface DemandesTabProps {
  /** « Ajouter une demande » was pressed in the page header. */
  adding: boolean;
  onAddingDone: () => void;
}

export function DemandesTab({ adding, onAddingDone }: DemandesTabProps) {
  const t = useT();
  const L = useL();
  const lang = useLangStore((s) => s.lang);
  const [searchParams, setSearchParams] = useSearchParams();
  // Deep link (guide 11a §6, adm.handicap): ?inscription=<id> marks that row.
  const focusInscription = searchParams.get('inscription');
  const focusRef = useFocusScroll();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [wilaya, setWilaya] = useState('all');
  const [jobType, setJobType] = useState('all');
  const [contacted, setContacted] = useState<ContactedFilter>('all');

  const [editing, setEditing] = useState<HandicapItem | null>(null);
  const [contacting, setContacting] = useState<HandicapItem | null>(null);
  const [deleting, setDeleting] = useState<HandicapItem | null>(null);
  // The row as it was when opened: a refetch may filter it out of the list
  // (placing ticks « Contacté »), and the dialog must not close under the admin.
  const [placing, setPlacing] = useState<HandicapItem | null>(null);

  const toggle = useSetContacted();
  const del = useDeleteDemande();

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  const params = useMemo<HandicapParams>(() => {
    const p: HandicapParams = {};
    if (search) p.search = search;
    if (wilaya !== 'all') p.wilaya = wilaya;
    if (jobType !== 'all') p.jobType = jobType;
    if (contacted !== 'all') p.contacted = contacted === 'yes';
    return p;
  }, [search, wilaya, jobType, contacted]);

  const listQ = useHandicapList(params);
  const rows = useMemo(() => listQ.data?.pages.flatMap((p) => p.data) ?? [], [listQ.data]);
  const total = listQ.data?.pages[0]?.meta.total ?? 0;

  const { data: wilayasDict } = useWilayas();
  const wilayaOpts = (wilayasDict ?? []).map((w) => ({ v: w.nom, l: L(w.nom, w.nomAr) }));
  // No jobType dictionary endpoint — options come from the rows loaded so far.
  const jobTypeOpts = [...new Set(rows.map((r) => r.jobType).filter((x): x is string => !!x))]
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .map((j) => ({ v: j, l: j }));

  /** The profile overlay is keyed by company id — GET /prestataires/{companyId}. */
  const openPres = (companyId: string): void => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('pres', companyId);
      return next;
    });
  };

  const onFail = (err: unknown): void => {
    toast.error(hcErrorMessage(err, t));
    if (isStale(hcProblem(err))) reloadHandicap();
  };

  /** Ticking asks for the optional note; unticking is one call. */
  const onContactedBox = (w: HandicapItem): void => {
    if (!w.isContacted) {
      setContacting(w);
      return;
    }
    toggle.mutate({ id: w.id, contacted: false }, { onSuccess: () => toast.success(t('hcToastRouverte')), onError: onFail });
  };

  const confirmDelete = (): void => {
    if (!deleting) return;
    del.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(t('hcDemandeSupprimee'));
        setDeleting(null);
      },
      onError: (err) => {
        onFail(err);
        if (isStale(hcProblem(err))) setDeleting(null);
      },
    });
  };

  const contactedChips: { key: ContactedFilter; label: string }[] = [
    { key: 'all', label: t('tous') },
    { key: 'yes', label: t('hcContactes') },
    { key: 'no', label: t('hcAContacter') },
  ];

  return (
    <div>
      {/* search + filters + count */}
      <div className="mt-[14px] flex flex-wrap items-center gap-[9px]">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('hcRecherche')}
          aria-label={t('hcRecherche')}
          className={SEARCH_CLS}
        />
        <FilterSelect value={wilaya} label={t('fWilaya')} options={wilayaOpts} onChange={setWilaya} />
        <FilterSelect value={jobType} label={t('hcColPoste')} options={jobTypeOpts} onChange={setJobType} />
        {contactedChips.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={contacted === c.key}
            onClick={() => setContacted(c.key)}
            className={cn(PILL, contacted === c.key ? PILL_ON : PILL_OFF)}
          >
            {c.label}
          </button>
        ))}
        <div className="text-[12.5px] font-semibold text-de9-gray">
          <span className="num">{total}</span> {t('hcCount')}
        </div>
      </div>

      {/* table card */}
      <div className="mt-3 overflow-x-auto rounded-md border border-de9-line bg-card">
        <div className={cn('min-w-[1090px] transition-opacity', listQ.isPlaceholderData && 'opacity-60')}>
          <div className={cn(GRID, HEAD_ROW)}>
            <div>{t('hcColEntreprise')}</div>
            <div>{t('hcColContact')}</div>
            <div>{t('hcColPoste')}</div>
            <div>{t('hcColZone')}</div>
            <div className="text-center">{t('hcColPlaces')}</div>
            <div>{t('hcColStatut')}</div>
            <div className="text-center">{t('hcColContacte')}</div>
            <div className="text-end">{t('hcColActions')}</div>
          </div>

          {listQ.isPending && <RowsSkeleton />}

          {listQ.isError && !listQ.isPending && (
            <div className="px-5 py-[13px] text-[12.5px] font-semibold text-de9-red">
              {t('hcErreurListe')} — {problemMessage(listQ.error)}
            </div>
          )}

          {!listQ.isPending &&
            !listQ.isError &&
            rows.map((w) => {
              const statut = statutOf(w);
              const meta = statutMeta(statut, t);
              const busy = toggle.isPending && toggle.variables?.id === w.id;
              return (
                <div
                  key={w.id}
                  ref={w.id === focusInscription ? focusRef : undefined}
                  className={cn(GRID, BODY_ROW, w.id === focusInscription && FOCUS_ROW_CLASS)}
                >
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-bold">
                      {w.companyId ? (
                        <span onClick={() => openPres(w.companyId ?? '')} className={LINK_CLS}>
                          {w.companyName}
                        </span>
                      ) : (
                        w.companyName
                      )}
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-de9-gray">
                      {t('hcInscriteLe').replace('{n}', dayLabel(w.registeredAt, lang))}
                    </div>
                  </div>

                  <div className="min-w-0 text-[12px] text-de9-slate">
                    <div className="truncate">{w.contactName ?? '—'}</div>
                    {w.contactPhone && (
                      <div className="text-[10.5px] text-de9-gray">
                        <span dir="ltr">{w.contactPhone}</span>
                      </div>
                    )}
                    <ContactLinks phone={w.contactPhone} email={w.contactEmail} />
                  </div>

                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-de9-ink">{w.jobType ?? '—'}</div>
                    {w.comment && (
                      <div
                        dir="auto"
                        title={w.comment}
                        className="mt-0.5 line-clamp-2 text-[11px] leading-[1.4] text-de9-gray ltr:text-left rtl:text-right"
                      >
                        {w.comment}
                      </div>
                    )}
                    {w.contactNote && (
                      <div className="mt-0.5 text-[10.5px] font-semibold text-[#2FA86A] dark:text-[#6FCF97]">
                        <Glyph icon={Check} /> <bdi>{w.contactNote}</bdi>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 text-[12px] text-de9-slate">
                    {w.wilaya ?? '—'}
                    {w.commune && <div className="text-[10.5px] text-de9-gray">{w.commune}</div>}
                  </div>

                  <div className="text-center text-[12.5px] font-bold">
                    <span className="num">
                      {w.placedCount ?? 0} / {w.positionsCount ?? '—'}
                    </span>
                  </div>

                  <div>
                    <Pill className={meta.chip}>{meta.label}</Pill>
                  </div>

                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={w.isContacted}
                      aria-label={t('hcColContacte')}
                      disabled={busy}
                      onClick={() => onContactedBox(w)}
                      title={w.contactedAt ? dayLabel(w.contactedAt, lang) : undefined}
                      className={cn(
                        'flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 text-[13px] font-extrabold text-white disabled:cursor-wait disabled:opacity-50',
                        w.isContacted ? 'border-[#2FA86A] bg-[#2FA86A]' : 'border-[#CBD3DB] bg-card dark:border-de9-line',
                      )}
                    >
                      {w.isContacted && <Glyph icon={Check} className="stroke-[3]" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPlacing(w)}
                      className={cn('whitespace-nowrap', statut === 'pourvue' ? BTN_OUTLINE : BTN_TONAL)}
                    >
                      {t(statut === 'pourvue' ? 'hcVoirPlacements' : 'hcPlacer')}
                    </button>
                    <IconButton icon={Pencil} label={t('hcModifier')} onClick={() => setEditing(w)} />
                    <IconButton icon={Trash2} label={t('supprimer')} danger onClick={() => setDeleting(w)} />
                  </div>
                </div>
              );
            })}

          {!listQ.isPending && !listQ.isError && rows.length === 0 && (
            <div className="p-[44px] text-center text-[14px] text-de9-gray">{t('hcAucun')}</div>
          )}
        </div>

        {listQ.hasNextPage && (
          <LoadMore loading={listQ.isFetchingNextPage} onClick={() => void listQ.fetchNextPage()} />
        )}
      </div>

      {adding && <DemandeFormDialog row={null} onClose={onAddingDone} />}
      {editing && <DemandeFormDialog row={editing} onClose={() => setEditing(null)} />}
      {placing && <PlacementsDialog demande={placing} onClose={() => setPlacing(null)} />}
      {contacting && <ContacterDialog demande={contacting} onClose={() => setContacting(null)} />}
      {deleting && (
        <ConfirmDialog
          title={t('hcSupprimerDemandeTitre')}
          confirmLabel={t('supprimer')}
          pending={del.isPending}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        >
          {(deleting.placedCount ?? 0) > 0
            ? t('hcSupprimerDemandePlaces')
                .replace('{n}', deleting.companyName)
                .replace('{m}', String(deleting.placedCount))
            : t('hcSupprimerDemande').replace('{n}', deleting.companyName)}
        </ConfirmDialog>
      )}
    </div>
  );
}

/** Ticking « Contacté » — POST /handicap/{id}/contacter, with what was said if the admin wants to keep it. */
function ContacterDialog({ demande, onClose }: { demande: HandicapItem; onClose: () => void }) {
  const t = useT();
  const toggle = useSetContacted();
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (): void => {
    toggle.mutate(
      { id: demande.id, contacted: true, note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(t('hcToastContactee'));
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
      title={t('hcContacterTitre')}
      lead={<bdi>{demande.companyName}</bdi>}
      onClose={onClose}
      locked={toggle.isPending}
      size="sm"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <FormField label={t('hcNoteFacultative')} error={error ?? undefined} className="mt-4">
          <textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setError(null);
            }}
            rows={3}
            dir="auto"
            autoFocus
            maxLength={HC_TEXT_MAX}
            className={cn(INPUT_CLS, 'resize-y')}
          />
        </FormField>
        <DialogActions onCancel={onClose} submitLabel={t('hcContacterConfirmer')} pending={toggle.isPending} />
      </form>
    </DialogFrame>
  );
}
