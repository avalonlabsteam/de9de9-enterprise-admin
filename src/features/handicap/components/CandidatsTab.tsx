// Tab « Candidats » — de9de9's own list of people looking for a job
// (GET /handicap/candidats), newest first, with the counters above it. The
// three counters are also the availability filter. No field describes a
// disability or a health condition.
import { useEffect, useMemo, useState } from 'react';
import { History, Lock, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useL, useT, type TKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { problemMessage } from '@/api/problem';
import { Glyph } from '@/components/common/Glyph';
import { useWilayas } from '@/features/geo/api/geo';
import { reloadHandicap, useCandidatCompteurs, useCandidats, useDeleteCandidat } from '../api/handicap';
import type { Candidat, CandidatCompteurs, CandidatParams } from '../schemas/handicap';
import {
  BODY_ROW,
  CHIP_BLUE,
  CHIP_GREEN,
  HEAD_ROW,
  SEARCH_CLS,
  hcErrorMessage,
  hcProblem,
  isStale,
  shortDate,
} from '../lib/handicap';
import { ConfirmDialog, ContactLinks, FilterSelect, IconButton, LoadMore, Pill, RowsSkeleton } from './shared';
import { CandidatFormDialog } from './CandidatFormDialog';
import { CandidatHistoryDialog } from './CandidatHistoryDialog';

const SEARCH_DEBOUNCE_MS = 300;
const GRID = 'grid [grid-template-columns:1.35fr_1.25fr_1.15fr_0.9fr_1.6fr_1.5fr_124px]';

type Situation = 'all' | 'disponible' | 'place';

const COUNTERS: ReadonlyArray<{ key: Situation; field: keyof CandidatCompteurs; labelKey: TKey; figure: string }> = [
  { key: 'all', field: 'total', labelKey: 'hcCptTotal', figure: 'text-de9-ink' },
  { key: 'disponible', field: 'disponibles', labelKey: 'hcCptDisponibles', figure: 'text-[#2FA86A] dark:text-[#6FCF97]' },
  { key: 'place', field: 'places', labelKey: 'hcCptPlaces', figure: 'text-[#2F7FD0] dark:text-[#7EB5EC]' },
];

interface CandidatsTabProps {
  /** « Ajouter une personne » was pressed in the page header. */
  adding: boolean;
  onAddingDone: () => void;
}

export function CandidatsTab({ adding, onAddingDone }: CandidatsTabProps) {
  const t = useT();
  const L = useL();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [wilaya, setWilaya] = useState('all');
  const [jobType, setJobType] = useState('all');
  const [situation, setSituation] = useState<Situation>('all');

  const [editing, setEditing] = useState<Candidat | null>(null);
  const [history, setHistory] = useState<Candidat | null>(null);
  const [deleting, setDeleting] = useState<Candidat | null>(null);
  const del = useDeleteCandidat();

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  const params = useMemo<CandidatParams>(() => {
    const p: CandidatParams = {};
    if (search) p.search = search;
    if (wilaya !== 'all') p.wilaya = wilaya;
    if (jobType !== 'all') p.jobType = jobType;
    if (situation !== 'all') p.disponible = situation === 'disponible';
    return p;
  }, [search, wilaya, jobType, situation]);

  const listQ = useCandidats(params);
  const compteursQ = useCandidatCompteurs();
  const rows = useMemo(() => listQ.data?.pages.flatMap((p) => p.data) ?? [], [listQ.data]);
  const total = listQ.data?.pages[0]?.meta.total ?? 0;

  const { data: wilayasDict } = useWilayas();
  const wilayaOpts = (wilayasDict ?? []).map((w) => ({ v: w.nom, l: L(w.nom, w.nomAr) }));
  // No jobType dictionary endpoint — options come from the rows loaded so far.
  const jobTypeOpts = [...new Set(rows.map((r) => r.jobType).filter((x): x is string => !!x))]
    .sort((a, b) => a.localeCompare(b, 'fr'))
    .map((j) => ({ v: j, l: j }));

  const confirmDelete = (): void => {
    if (!deleting) return;
    del.mutate(deleting.id, {
      onSuccess: () => {
        toast.success(t('hcPersonneSupprimee'));
        setDeleting(null);
      },
      onError: (err) => {
        toast.error(hcErrorMessage(err, t));
        // Already deleted by a colleague: the list is stale, the question moot.
        if (isStale(hcProblem(err))) {
          reloadHandicap();
          setDeleting(null);
        }
      },
    });
  };

  return (
    <div>
      {/* counters — GET /handicap/candidats/compteurs; each one filters the list */}
      <div className="mt-[14px] grid grid-cols-3 gap-3 sm:max-w-[560px]">
        {COUNTERS.map((c) => {
          const active = situation === c.key;
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={active}
              onClick={() => setSituation(c.key)}
              className={cn(
                'cursor-pointer rounded-md border border-de9-line bg-card px-4 py-3 text-start',
                active && 'ring-2 ring-primary',
              )}
            >
              <div className="truncate text-xs font-semibold text-de9-gray">{t(c.labelKey)}</div>
              <div className={cn('mt-1 text-[22px] leading-none font-extrabold', c.figure)}>
                <span className="num">{compteursQ.data ? compteursQ.data[c.field] : '—'}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* search + filters + count */}
      <div className="mt-[14px] flex flex-wrap items-center gap-[9px]">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('hcRecherchePersonne')}
          aria-label={t('hcRecherchePersonne')}
          className={SEARCH_CLS}
        />
        <FilterSelect value={wilaya} label={t('fWilaya')} options={wilayaOpts} onChange={setWilaya} />
        <FilterSelect value={jobType} label={t('hcPosteRecherche')} options={jobTypeOpts} onChange={setJobType} />
        <div className="text-[12.5px] font-semibold text-de9-gray">
          <span className="num">{total}</span> {t('hcCountPersonnes')}
        </div>
      </div>

      {/* table card */}
      <div className="mt-3 overflow-x-auto rounded-md border border-de9-line bg-card">
        <div className={cn('min-w-[1020px] transition-opacity', listQ.isPlaceholderData && 'opacity-60')}>
          <div className={cn(GRID, HEAD_ROW)}>
            <div>{t('hcColPersonne')}</div>
            <div>{t('hcColCoordonnees')}</div>
            <div>{t('hcPosteRecherche')}</div>
            <div>{t('hcColZone')}</div>
            <div>{t('hcCompetences')}</div>
            <div>{t('hcColSituation')}</div>
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
            rows.map((c) => {
              const actif = c.placementActif;
              return (
                <div key={c.id} className={cn(GRID, BODY_ROW)}>
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-bold text-de9-ink">{c.fullName}</div>
                    {c.addedAt && (
                      <div className="mt-0.5 text-[10.5px] text-de9-gray">
                        {t('hcAjouteeLe').replace('{n}', shortDate(c.addedAt))}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 text-[12px] text-de9-slate">
                    {c.phone ? <span dir="ltr">{c.phone}</span> : '—'}
                    {c.email && <div className="truncate text-[10.5px] text-de9-gray">{c.email}</div>}
                    <ContactLinks phone={c.phone} email={c.email} />
                  </div>

                  <div className="min-w-0 text-[12px] font-semibold text-de9-ink">{c.jobType ?? '—'}</div>

                  <div className="min-w-0 text-[12px] text-de9-slate">
                    {c.wilaya ?? '—'}
                    {c.commune && <div className="text-[10.5px] text-de9-gray">{c.commune}</div>}
                  </div>

                  <div className="min-w-0">
                    <div
                      dir="auto"
                      title={c.competences ?? undefined}
                      className="line-clamp-2 text-[11.5px] leading-[1.4] text-de9-slate ltr:text-left rtl:text-right"
                    >
                      {c.competences || '—'}
                    </div>
                    {c.note && (
                      <div title={c.note} className="mt-0.5 line-clamp-2 text-[10.5px] leading-[1.4] text-de9-gray">
                        <Glyph icon={Lock} /> <bdi>{c.note}</bdi>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    {c.disponible ? (
                      <Pill className={CHIP_GREEN}>{t('hcDisponible')}</Pill>
                    ) : (
                      <>
                        <Pill className={CHIP_BLUE}>{t('hcEnPoste')}</Pill>
                        {actif && (
                          <div className="mt-1 text-[11px] leading-[1.4] text-de9-slate">
                            <bdi className="font-semibold">{actif.companyName ?? '—'}</bdi>
                            <div className="text-[10.5px] text-de9-gray">
                              {t('hcDepuisLe').replace('{n}', shortDate(actif.placedAt))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-1.5">
                    <IconButton icon={History} label={t('hcHistoriqueTitre')} onClick={() => setHistory(c)} />
                    <IconButton icon={Pencil} label={t('hcModifier')} onClick={() => setEditing(c)} />
                    <IconButton icon={Trash2} label={t('supprimer')} danger onClick={() => setDeleting(c)} />
                  </div>
                </div>
              );
            })}

          {!listQ.isPending && !listQ.isError && rows.length === 0 && (
            <div className="p-[44px] text-center text-[14px] text-de9-gray">{t('hcAucunePersonne')}</div>
          )}
        </div>

        {listQ.hasNextPage && (
          <LoadMore loading={listQ.isFetchingNextPage} onClick={() => void listQ.fetchNextPage()} />
        )}
      </div>

      {adding && <CandidatFormDialog candidat={null} onClose={onAddingDone} />}
      {editing && <CandidatFormDialog candidat={editing} onClose={() => setEditing(null)} />}
      {history && <CandidatHistoryDialog candidat={history} onClose={() => setHistory(null)} />}
      {deleting && (
        <ConfirmDialog
          title={t('hcSupprimerPersonneTitre')}
          confirmLabel={t('supprimer')}
          pending={del.isPending}
          onConfirm={confirmDelete}
          onClose={() => setDeleting(null)}
        >
          {deleting.disponible
            ? t('hcSupprimerPersonne').replace('{n}', deleting.fullName)
            : t('hcSupprimerPersonnePlacee')
                .replace('{n}', deleting.fullName)
                .replace('{m}', deleting.placementActif?.companyName ?? '—')}
        </ConfirmDialog>
      )}
    </div>
  );
}
