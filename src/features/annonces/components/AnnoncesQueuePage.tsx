// ANNONCES — the review queue of the annonces every company publishes:
//   GET /admin/annonces?onglet=&type=&companyId=&categorie=&q=&page=&pageSize=
// Six tabs whose counters ride on every answer; polled every minute like the
// KYC queue. Tab, filters and page live in the URL (an alert opens
// /annonces?onglet=modifiees&companyId=…), so « Retour » from an annonce lands
// on the queue as it was left. At launch the work is in « Modifiées »: an
// annonce a company submits is published at once and flagged for a read.
import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronDown, Info, RefreshCw, Wrench, X } from 'lucide-react';
import { useL, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Glyph } from '@/components/common/Glyph';
import { fmtAlger } from '@/features/comptabilite/lib/comptabilite';
import { useCtrFiltres } from '@/features/contractuels/api/contractuels';
import { TAXO, slugify } from '@/features/prestataires/lib/taxonomy';
import { useActualiserReferentiel, useAnnoncesQueue, type AnnoncesFilters } from '../api/annonces';
import { PAGE_SIZE, TYPES, annErrorMessage, annProblem, dateOf, ongletOf } from '../lib/annonces';
import type { AnnonceLigne } from '../schemas/annonces';
import type { AnnonceBackState } from './AnnonceDetailPage';
import { ReprendreFichesDialog } from './ReprendreFichesDialog';
import { Cover, Dated, StatutPills } from './shared';

const SEARCH_DEBOUNCE_MS = 300;
const GRID = 'grid grid-cols-[2.2fr_1.25fr_1fr_1.65fr_0.8fr] gap-3 px-5';
const TRIGGER =
  'h-auto w-full cursor-pointer gap-1.5 rounded-xs border border-outline bg-card px-[13px] py-[10px] text-[12.5px] font-semibold text-de9-slate shadow-none sm:w-auto';
const BTN = 'flex cursor-pointer items-center gap-2 rounded-full border border-de9-line bg-card px-4 py-[11px] text-[12.5px] font-bold text-de9-slate hover:bg-de9-row disabled:cursor-not-allowed disabled:opacity-60';

/** Inner clickables must not also open the row's annonce. */
const stop = (ev: MouseEvent): void => ev.stopPropagation();

export function AnnoncesQueuePage() {
  const t = useT();
  const L = useL();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();

  // ---- filters, from the URL ----
  const onglet = ongletOf(sp.get('onglet'));
  const type = TYPES.some((x) => x.v === sp.get('type')) ? (sp.get('type') ?? '') : '';
  const companyId = sp.get('companyId') ?? '';
  const categorie = sp.get('categorie') ?? '';
  const q = sp.get('q') ?? '';
  const page = Math.max(1, Math.floor(Number(sp.get('page'))) || 1);
  /** An alert's fallback tab: used when the asked one turns out empty (guide §12). */
  const sinon = ongletOf(sp.get('sinon'));

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

  // ---- search, debounced into ?q= ----
  const [searchInput, setSearchInput] = useState(q);
  useEffect(() => {
    const id = setTimeout(() => {
      const next = searchInput.trim();
      if (next !== q) patch({ q: next || null, page: null });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
    // `patch` is rebuilt each render; only the typed text drives this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const filters = useMemo<AnnoncesFilters>(
    () => ({
      onglet: onglet ?? undefined,
      type: type || undefined,
      companyId: companyId || undefined,
      categorie: categorie || undefined,
      q: q || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [onglet, type, companyId, categorie, q, page],
  );
  const listQ = useAnnoncesQueue(filters);
  const data = listQ.data;
  const rows = data?.annonces ?? [];
  const actif = onglet ?? data?.onglet ?? 'a_valider';
  const pages = data ? Math.max(1, Math.ceil(data.total / (data.pageSize || PAGE_SIZE))) : 1;
  const countOf = (code: string): number => data?.onglets.find((o) => o.code === code)?.count ?? 0;

  // Landing with no tab: « À valider » when something waits there, else
  // « Modifiées » — at launch, that is where the work is (guide §2).
  const settled = listQ.isSuccess && !listQ.isPlaceholderData;
  useEffect(() => {
    if (!settled || onglet || !data) return;
    if (data.onglet === 'a_valider' && countOf('a_valider') === 0) patch({ onglet: 'modifiees' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, onglet, data]);

  // A tab this server refuses (400 on `onglet`, guide §2): back to « À valider ».
  useEffect(() => {
    const p = annProblem(listQ.error);
    if (p.status === 400 && p.field === 'onglet' && onglet && onglet !== 'a_valider') patch({ onglet: 'a_valider', page: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listQ.error, onglet]);

  // An alert « Annonce publiée à vérifier / à valider »: try « À valider » for
  // that company, and fall back once — never on a later poll.
  useEffect(() => {
    if (!settled || !sinon || !data) return;
    if (data.total === 0 && data.onglet !== sinon) patch({ onglet: sinon, sinon: null, page: null });
    else patch({ sinon: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, sinon, data]);

  // ---- category filter: the catalogue (B2B) and the de9de9 app's (B2C) ----
  const ctrFiltresQ = useCtrFiltres();
  const b2bCats = useMemo(() => TAXO.map((c) => ({ v: slugify(c.fr), l: L(c.fr, c.ar) })), [L]);
  const b2cCats = useMemo(
    () => (ctrFiltresQ.data?.categories ?? []).map((c) => ({ v: String(c.id), l: L(c.name, c.nameAr ?? c.name) })),
    [ctrFiltresQ.data, L],
  );
  const catLabel = [...b2bCats, ...b2cCats].find((c) => c.v === categorie)?.l ?? categorie;

  const setType = (v: string): void => {
    // A category of the other kind would empty the list.
    const keep = v === '' || (v === 'b2b' ? b2bCats : b2cCats).some((c) => c.v === categorie);
    patch({ type: v || null, categorie: keep ? categorie || null : null, page: null });
  };

  // ---- tools ----
  const [reprise, setReprise] = useState(false);
  const referentiel = useActualiserReferentiel();
  const actualiserReferentiel = (): void => {
    const id = toast.loading(t('annRefEnCours'));
    referentiel.mutate(undefined, {
      onSuccess: (r) =>
        toast.success(
          <Dated
            text={t('annRefOk')
              .replace('{g}', String(r.groupes))
              .replace('{c}', String(r.categories))
              .replace('{s}', String(r.services))}
            iso={r.lueLe}
          />,
          { id },
        ),
      onError: (err) =>
        toast.error(annErrorMessage(err, t), {
          id,
          duration: 12_000,
          action: { label: t('reessayer'), onClick: actualiserReferentiel },
        }),
    });
  };

  const companyNom = companyId ? (rows[0]?.entreprise.id === companyId ? rows[0].entreprise.nom : null) : null;

  return (
    <div>
      {/* ===== header ===== */}
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-[23px] font-extrabold">{data?.titre ?? t('annTitre')}</div>
          <div className="mt-[2px] text-[13.5px] text-de9-gray">{t('annSub')}</div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={BTN}>
                <Wrench className="size-4" />
                {t('annOutils')}
                <ChevronDown className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[280px]">
              <DropdownMenuItem onSelect={() => setReprise(true)} className="cursor-pointer text-[12.5px] font-semibold">
                {t('annReprendreFiches')}…
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={referentiel.isPending}
                onSelect={actualiserReferentiel}
                className="cursor-pointer text-[12.5px] font-semibold"
              >
                {t('annActualiserReferentiel')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button type="button" onClick={() => void listQ.refetch()} disabled={listQ.isFetching} className={BTN}>
            <RefreshCw className={cn('size-4', listQ.isFetching && 'animate-spin')} />
            {t('comptaActualiser')}
          </button>
        </div>
      </div>

      {/* ===== the six tabs — label and count as the server sends them ===== */}
      <div className="mt-4 flex flex-wrap gap-2">
        {(data?.onglets ?? []).map((o) => {
          const active = actif === o.code;
          return (
            <button
              key={o.code}
              type="button"
              aria-pressed={active}
              onClick={() => patch({ onglet: o.code, page: null, sinon: null })}
              className={cn(
                'cursor-pointer rounded-full border px-[15px] py-[9px] text-[12.5px] font-bold',
                active ? 'border-secondary-container bg-secondary-container text-on-secondary-container' : 'border-de9-line bg-card text-de9-slate',
              )}
            >
              {o.label} · <span className="num">{o.count}</span>
            </button>
          );
        })}
        {!data && listQ.isPending && <div className="h-[38px] w-[520px] max-w-full animate-pulse rounded-full bg-card" />}
      </div>

      {/* ===== filters ===== */}
      <div className="mt-3.5 flex flex-wrap items-center gap-[9px]">
        <Select value={type || 'all'} onValueChange={(v) => setType(v === 'all' ? '' : v)}>
          <SelectTrigger aria-label={t('annFiltreType')} className={TRIGGER}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[12.5px]">
              {t('annFiltreType')} : {t('tous')}
            </SelectItem>
            {TYPES.map((x) => (
              <SelectItem key={x.v} value={x.v} className="text-[12.5px]">
                {t(x.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categorie || 'all'} onValueChange={(v) => patch({ categorie: v === 'all' ? null : v, page: null })}>
          <SelectTrigger aria-label={t('annFiltreCategorie')} className={TRIGGER}>
            <SelectValue>{categorie ? catLabel : `${t('annFiltreCategorie')} : ${t('tous')}`}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[12.5px]">
              {t('annFiltreCategorie')} : {t('tous')}
            </SelectItem>
            {type !== 'b2c' && (
              <SelectGroup>
                <SelectLabel className="text-[11px] font-extrabold tracking-[.04em] text-de9-gray uppercase">{t('annTypeB2b')}</SelectLabel>
                {b2bCats.map((c) => (
                  <SelectItem key={c.v} value={c.v} className="text-[12.5px]">
                    {c.l}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {type !== 'b2b' && b2cCats.length > 0 && (
              <SelectGroup>
                <SelectLabel className="text-[11px] font-extrabold tracking-[.04em] text-de9-gray uppercase">{t('annTypeB2c')}</SelectLabel>
                {b2cCats.map((c) => (
                  <SelectItem key={c.v} value={c.v} className="text-[12.5px]">
                    {c.l}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('annRecherche')}
          aria-label={t('annRecherche')}
          className="w-full flex-none rounded-xs border border-outline bg-card px-[15px] py-[10px] text-[12.5px] text-de9-ink outline-none sm:w-[300px]"
        />
        {companyId && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-3 py-[7px] text-[12px] font-bold text-on-secondary-container">
            {t('annFiltreEntreprise')} : <bdi>{companyNom ?? t('annEntrepriseFiltree')}</bdi>
            <button type="button" aria-label={t('annRetirerFiltre')} onClick={() => patch({ companyId: null, page: null })} className="cursor-pointer">
              <X className="size-3.5" />
            </button>
          </span>
        )}
      </div>

      {/* ===== the banner of « B2C — publication » ===== */}
      {(data?.bandeaux ?? []).map((b) => (
        <div
          key={b.code}
          role="status"
          className="mt-3.5 flex items-start gap-2.5 rounded-md border border-[#BFD9F2] bg-[#EAF2FD] px-4 py-3 text-[12.5px] leading-relaxed font-semibold text-[#2F7FD0] dark:border-[#2F7FD0]/40 dark:bg-[#2F7FD0]/15 dark:text-[#7EB5EC]"
        >
          <span className="mt-px text-[15px]">
            <Glyph icon={Info} />
          </span>
          {/* French from the server: its own direction, the icon stays at the page's start. */}
          <span dir="auto" className="ltr:text-left rtl:text-right">
            {b.texte}
          </span>
        </div>
      ))}

      {/* ===== list ===== */}
      <div className="mt-3.5 overflow-hidden rounded-md border border-de9-line bg-card">
        <div className={cn('overflow-x-auto transition-opacity', listQ.isPlaceholderData && 'opacity-60')}>
          <div className="min-w-[960px]">
            <div className={cn(GRID, 'border-b border-de9-line bg-secondary py-[13px] text-[10.5px] font-bold tracking-[.04em] text-de9-gray uppercase')}>
              <div>{t('annColAnnonce')}</div>
              <div>{t('annColEntreprise')}</div>
              <div>{t('annColCategorie')}</div>
              <div>{t('annColStatut')}</div>
              <div>{t('annColDate')}</div>
            </div>

            {listQ.isPending && (
              <div className="px-5 py-3.5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="mb-3 h-12 animate-pulse rounded-sm bg-de9-row last:mb-0" />
                ))}
              </div>
            )}
            {listQ.isError && (
              <div className="px-5 py-4 text-[12.5px] font-semibold text-de9-red">
                {t('annErreurListe')} — {annErrorMessage(listQ.error, t)}
              </div>
            )}

            {rows.map((r) => (
              <QueueRow key={r.id} row={r} onglet={actif} onOpen={() => navigate(`/annonces/${encodeURIComponent(r.id)}`, { state: { fromQueue: true } satisfies AnnonceBackState })} />
            ))}
          </div>
        </div>

        {listQ.isSuccess && rows.length === 0 && <div className="p-11 text-center text-sm text-de9-gray">{t('annAucune')}</div>}

        {data && data.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-de9-line px-5 py-3">
            <div className="text-[12.5px] font-semibold text-de9-gray">
              {t('annNAnnonces').replace('{n}', String(data.total))}
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

      {reprise && <ReprendreFichesDialog onClose={() => setReprise(false)} />}
    </div>
  );
}

function QueueRow({ row: r, onglet, onOpen }: { row: AnnonceLigne; onglet: string; onOpen: () => void }) {
  const when = fmtAlger(dateOf(r, onglet), false);
  return (
    <div onClick={onOpen} className={cn(GRID, 'cursor-pointer items-center border-b border-de9-line py-3 hover:bg-de9-row')}>
      <div className="flex min-w-0 items-center gap-3">
        <Cover url={r.couvertureUrl} className="size-11" />
        <div className="min-w-0">
          <Link
            to={`/annonces/${encodeURIComponent(r.id)}`}
            state={{ fromQueue: true } satisfies AnnonceBackState}
            onClick={stop}
            dir="auto"
            className="block truncate text-[13px] font-extrabold text-de9-ink no-underline ltr:text-left rtl:text-right"
          >
            {r.titre}
          </Link>
          <span className="mt-1 inline-flex rounded-full bg-secondary px-2 py-[2px] text-[10.5px] font-bold text-de9-slate">{r.typeChip.label}</span>
        </div>
      </div>
      <div className="min-w-0 text-[12.5px] font-semibold">
        <Link
          to={`/entreprises/${encodeURIComponent(r.entreprise.id)}?cote=prestataire`}
          onClick={stop}
          className="truncate text-de9-ink underline decoration-[#C7CFD7] decoration-dotted underline-offset-[3px]"
        >
          <bdi>{r.entreprise.nom}</bdi>
        </Link>
      </div>
      <div className="min-w-0 truncate text-[12px] text-de9-slate">{r.categorie ?? '—'}</div>
      <div className="min-w-0">
        <StatutPills
          statut={r.statut}
          publication={r.publication}
          raison={r.publication?.raison}
          modifiee={r.modifieeDepuisRevue}
          reprise={r.origine === 'reprise_fiche'}
        />
      </div>
      <div className="text-[12px] text-de9-slate">
        <span className="num">{when ?? '—'}</span>
      </div>
    </div>
  );
}
