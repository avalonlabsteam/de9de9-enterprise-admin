// COMMANDES — worklist page, driven by GET /commandes/worklist. The server
// computes each row (currentStatus, ball, slaOverdueMinutes, traite, …) and
// applies filters + pagination; this page only maps UI state to query params
// and renders rows. Visual ground truth: src/admin/views/Worklist.tsx.
// (The mock twin of the endpoint lives in src/api/mock/worklist.ts.)
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useL, useT } from '@/lib/i18n';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWorklist, useWorklistKpis, useToggleTraite } from '../api/commandes';
import { toast } from 'sonner';
import { problemMessage } from '@/api/problem';
import { useCommunes, useWilayas } from '@/features/geo/api/geo';
import type { WorklistItem, WorklistParams, WorklistStatut } from '../schemas/worklist';
import { BALL_COLOR, ballLabel, formatDuration, statusBadge, visitLabel } from '../lib/worklistDisplay';
import { NotesModal } from './NotesModal';


// ===================== filters =====================

interface WorklistFilter {
  needsDe9de9: boolean;
  /** Client-side refinement of the current page — the API has no `kind` param. */
  kind: 'all' | 'recurrent' | 'ponctuel';
  prestataireId: string;
  wilaya: string;
  commune: string;
  clientId: string;
  balle: string;
  statut: string;
  search: string;
}

const INITIAL_FILTER: WorklistFilter = {
  needsDe9de9: false,
  kind: 'all',
  prestataireId: 'all',
  wilaya: 'all',
  commune: 'all',
  clientId: 'all',
  balle: 'all',
  statut: 'all',
  search: '',
};

type SelectField = 'prestataireId' | 'wilaya' | 'commune' | 'clientId' | 'balle' | 'statut';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

interface Opt {
  v: string;
  l: string;
}

/** Unique options sorted by label; `null` entries are skipped. */
function toOpts(pairs: ([string, string] | null)[]): Opt[] {
  const seen = new Map<string, string>();
  for (const p of pairs) {
    if (p && !seen.has(p[0])) seen.set(p[0], p[1]);
  }
  return [...seen.entries()]
    .map(([v, l]) => ({ v, l }))
    .sort((a, b) => a.l.localeCompare(b.l, 'fr'));
}

// ===================== page =====================

const ROW_GRID = 'grid min-w-[960px] grid-cols-[1.8fr_1.4fr_1.7fr_0.9fr_1.2fr_0.95fr_0.85fr_0.55fr] gap-3.5 px-[22px]';

export function WorklistPage() {
  const t = useT();
  const l = useL();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const roleView = useUiStore((s) => s.roleView);

  const [filter, setFilter] = useState<WorklistFilter>(INITIAL_FILTER);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  // Server-confirmed overrides of the row's `traite` flag: PATCH answers with
  // the new value, so the cell can flip before the list is refetched.
  const [handled, setHandled] = useState<Record<string, boolean>>({});
  const toggleTraite = useToggleTraite();
  const [notesFor, setNotesFor] = useState<string | null>(null);

  // Debounce the search box into the filter. Every filter change re-opens the
  // list at page 1.
  useEffect(() => {
    const id = setTimeout(() => {
      setFilter((f) => (f.search === searchInput ? f : { ...f, search: searchInput }));
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchInput]);

  const params = useMemo<WorklistParams>(() => {
    const p: WorklistParams = { page, pageSize: PAGE_SIZE };
    if (filter.search.trim()) p.search = filter.search.trim();
    if (filter.clientId !== 'all') p.clientId = filter.clientId;
    if (filter.prestataireId !== 'all') p.prestataireId = filter.prestataireId;
    if (filter.wilaya !== 'all') p.wilaya = filter.wilaya;
    if (filter.commune !== 'all') p.commune = filter.commune;
    if (filter.statut !== 'all') p.statut = filter.statut;
    if (filter.balle !== 'all') p.balle = filter.balle;
    if (filter.needsDe9de9) p.needsDe9de9 = true;
    return p;
  }, [filter, page]);

  const { data, isPending, isError, error, isPlaceholderData } = useWorklist(params);
  const rows = useMemo(() => data?.data ?? [], [data]);
  const meta = data?.meta;

  // The API has no `kind` param, so the recurrent/ponctuel chips refine the
  // fetched page only.
  const list = filter.kind === 'all' ? rows : rows.filter((r) => r.kind === filter.kind);

  // ===== KPIs (all four counts in one server request; clicking toggles the statut filter) =====
  const { data: counts } = useWorklistKpis();
  const kpis: { statut: WorklistStatut; label: string; value: number | undefined; color: string; alert: boolean }[] = [
    { statut: 'arappeler', label: t('fSArappeler'), value: counts?.aRappeler, color: '#E7464E', alert: (counts?.aRappeler ?? 0) > 0 },
    { statut: 'litige', label: t('worklistKpiLitiges'), value: counts?.litigesAResoudre, color: '#E7464E', alert: false },
    { statut: 'regler', label: t('worklistKpiFacturesARegler'), value: counts?.facturesARegler, color: '#2FA86A', alert: false },
    { statut: 'actif', label: t('worklistKpiCommandesActives'), value: counts?.commandesActives, color: '#2F7FD0', alert: false },
  ];

  const toggleStatut = (statut: string): void => {
    setFilter((f) => ({ ...f, statut: f.statut === statut ? 'all' : statut }));
    setPage(1);
  };

  // ===== filter chips =====
  const filterChips: { key: string; val: WorklistFilter['kind'] | ''; label: string; icon: string; active: boolean }[] = [
    { key: 'needsDe9de9', val: '', label: t('worklistNecessiteDe9'), icon: '◆', active: filter.needsDe9de9 },
    { key: 'kind', val: 'all', label: t('tous'), icon: '≡', active: filter.kind === 'all' },
    { key: 'kind', val: 'recurrent', label: t('commonRecurrent'), icon: '↻', active: filter.kind === 'recurrent' },
    { key: 'kind', val: 'ponctuel', label: t('commonPonctuel'), icon: '•', active: filter.kind === 'ponctuel' },
  ];

  const toggleChip = (key: string, val: WorklistFilter['kind'] | ''): void => {
    if (key === 'needsDe9de9') setFilter((f) => ({ ...f, needsDe9de9: !f.needsDe9de9 }));
    else if (val !== '') setFilter((f) => ({ ...f, kind: val }));
    setPage(1);
  };

  // ===== select filters =====
  // Wilayas/communes come from the geo dictionary endpoints (localized labels,
  // French nom as the value — that's what the worklist params and rows carry).
  // The commune list cascades from the selected wilaya's code.
  const { data: wilayas } = useWilayas();
  const selectedWilaya = filter.wilaya !== 'all' ? wilayas?.find((w) => w.nom === filter.wilaya) : undefined;
  const { data: communes } = useCommunes(selectedWilaya?.code ?? null);
  const wilayaOpts = toOpts((wilayas ?? []).map((w) => [w.nom, l(w.nom, w.nomAr)]));
  const communeOpts = toOpts((communes ?? []).map((c) => [c.nom, l(c.nom, c.nomAr)]));

  // Client/prestataire options are still derived from the rows currently
  // loaded — good enough until the API exposes dictionary endpoints for them.
  const presOpts = toOpts(
    rows.map((r) => (r.prestataireCompanyId && r.prestataireName ? [r.prestataireCompanyId, r.prestataireName] : null)),
  );
  const clientOpts = toOpts(rows.map((r) => (r.clientCompanyId ? [r.clientCompanyId, r.clientName] : null)));

  const mkSelect = (
    field: SelectField,
    label: string,
    opts: Opt[],
  ): { field: SelectField; value: string; options: Opt[] } => {
    const value = filter[field];
    const options = [{ v: 'all', l: label + ' : ' + t('tous') }, ...opts];
    // Keep the active selection visible even when the filtered rows no longer
    // contain it (Radix Select needs the value to exist as an item).
    if (value !== 'all' && !options.some((o) => o.v === value)) options.push({ v: value, l: value });
    return { field, value, options };
  };
  const selects = [
    mkSelect('prestataireId', t('fPrestataire'), presOpts),
    mkSelect('wilaya', t('fWilaya'), wilayaOpts),
    mkSelect('commune', t('fCommune'), communeOpts),
    mkSelect('clientId', t('fClient'), clientOpts),
    mkSelect('balle', t('fBalle'), [
      { v: 'de9', l: 'de9de9' },
      { v: 'client', l: t('fClient') },
      { v: 'pro', l: t('fPrestataire') },
    ]),
    mkSelect('statut', t('fStatut'), [
      { v: 'arappeler', l: t('fSArappeler') },
      { v: 'devis', l: t('fSDevis') },
      { v: 'litige', l: t('fSLitige') },
      { v: 'regler', l: t('fSRegler') },
      { v: 'actif', l: t('fSActif') },
    ]),
  ];

  const setFilterField = (field: SelectField, value: string): void => {
    setFilter((f) => {
      const nf = { ...f, [field]: value };
      if (field === 'wilaya') nf.commune = 'all';
      return nf;
    });
    setPage(1);
  };

  // ===== overlay params (prestataire profile / client fiche survive navigation) =====
  const openClientFiche = (name: string): void => {
    if (!name || name === 'de9de9' || name === '—') return;
    const sp = new URLSearchParams(searchParams);
    sp.set('client', name);
    sp.delete('pres');
    setSearchParams(sp);
  };
  /**
   * The profile overlay is keyed by company id — the row carries one, so pass
   * it; the name is only a fallback for the mock, which also resolves by name.
   */
  const openPres = (key: string): void => {
    if (!key || key === '—') return;
    const sp = new URLSearchParams(searchParams);
    sp.set('pres', key);
    sp.delete('client');
    setSearchParams(sp);
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[23px] font-extrabold">{t('fileTravail')}</div>
          <div className="mt-[2px] text-[13.5px] text-de9-gray">{t('fileSub')}</div>
        </div>
      </div>

      {/* KPI banner */}
      <div className="mt-[18px] grid grid-cols-2 gap-3.5 md:grid-cols-4">
        {kpis.map((k) => (
          <div
            key={k.statut}
            onClick={() => toggleStatut(k.statut)}
            className={cn(
              'cursor-pointer rounded-2xl border-[1.5px] bg-card px-[17px] py-[15px] shadow-[0_6px_18px_rgba(38,50,69,.04)]',
              k.alert ? 'border-[#F6D2D4] dark:border-[#E7464E]/40' : 'border-de9-line',
            )}
            style={filter.statut === k.statut ? { borderColor: k.color } : undefined}
          >
            <div className="flex items-center gap-2">
              <div className="h-[9px] w-[9px] rounded-full" style={{ background: k.color }} />
              <div className="text-[12.5px] font-semibold text-de9-gray">{k.label}</div>
            </div>
            <div className="mt-2 text-[28px] font-extrabold" style={{ color: k.color }}>
              {k.value ?? '—'}
            </div>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div className="mt-[18px] flex flex-wrap items-center gap-2.5">
        {filterChips.map((f, i) => (
          <div
            key={i}
            onClick={() => toggleChip(f.key, f.val)}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-[15px] py-[9px] text-[12.5px] font-bold',
              f.active ? 'border-[#232838] bg-[#232838] text-white' : 'border-de9-line bg-card text-de9-slate',
            )}
          >
            <span className="text-[13px]">{f.icon}</span>
            {f.label}
          </div>
        ))}
      </div>

      {/* Select filters + search */}
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('rechercher')}
          className="h-auto w-auto min-w-0 flex-1 rounded-[11px] border-[1.5px] border-de9-line bg-card px-3.5 py-2.5 text-[13px] text-de9-ink shadow-none outline-none sm:flex-[0_0_250px] md:text-[13px]"
        />
        {selects.map((sel) => (
          <Select key={sel.field} value={sel.value} onValueChange={(v) => setFilterField(sel.field, v)}>
            <SelectTrigger className="h-auto w-full cursor-pointer gap-1.5 rounded-[11px] border-[1.5px] border-de9-line bg-card px-[13px] py-2.5 text-[12.5px] font-semibold text-de9-slate shadow-none sm:w-auto">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sel.options.map((op) => (
                <SelectItem key={op.v} value={op.v} className="text-[12.5px] font-semibold text-de9-slate">
                  {op.l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>

      {/* Rows table */}
      <div className="mt-4 overflow-hidden rounded-[18px] border border-de9-line bg-card shadow-[0_10px_30px_rgba(38,50,69,.06)]">
        <div className={cn('overflow-x-auto transition-opacity', isPlaceholderData && 'opacity-60')}>
        <div
          className={cn(
            ROW_GRID,
            'border-b border-de9-line bg-secondary py-3.5 text-[11px] font-bold uppercase tracking-[.05em] text-de9-gray',
          )}
        >
          <div>{t('colCommande')}</div>
          <div>{t('colService')}</div>
          <div>{t('colProchaine')}</div>
          <div>{t('colBalle')}</div>
          <div>{t('colPrestataire')}</div>
          <div>{t('colSla')}</div>
          <div>{t('colTraite')}</div>
          <div>{t('colNote')}</div>
        </div>

        {isPending && (
          <div className="flex flex-col gap-3 p-[22px]">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[46px] animate-pulse rounded-xl bg-secondary" />
            ))}
          </div>
        )}
        {isError && (
          <div className="p-[22px] text-[13px] font-semibold text-de9-red">
            {error instanceof Error ? error.message : 'Erreur de chargement'}
          </div>
        )}

        {!isPending &&
          !isError &&
          list.map((c: WorklistItem) => {
            const badge = statusBadge(c.currentStatus.code);
            const overdue = c.slaOverdueMinutes != null && c.slaOverdueMinutes > 0;
            let slaLabel = '—';
            let slaSub = '';
            let slaClass = 'text-de9-gray';
            if (c.slaOverdueMinutes != null) {
              slaLabel = overdue
                ? t('worklistRetard').replace('{n}', formatDuration(c.slaOverdueMinutes, t))
                : formatDuration(c.slaOverdueMinutes, t);
              slaClass = overdue ? 'text-[#E7464E] dark:text-[#F2848A]' : 'text-[#D9871F] dark:text-[#EBA24E]';
              // The server names the running SLA; the callback SLA was the
              // only one before the contract carried `slaLabel`.
              slaSub = c.slaLabel ?? t('worklistSlaRappel');
            } else if (c.nextVisitAt) {
              slaLabel = visitLabel(c.nextVisitAt, t);
              slaSub = t('worklistProchaineVisite');
              slaClass = 'text-de9-slate';
            }
            const isHandled = handled[c.id] ?? c.traite;
            const ballColor = BALL_COLOR[c.ball];
            const ballRing =
              roleView !== 'de9' &&
              ((roleView === 'client' && c.ball === 'client') ||
                (roleView === 'prestataire' && c.ball === 'pro'))
                ? `0 0 0 4px ${ballColor}66`
                : 'none';
            const presName = c.prestataireName ?? '—';

            return (
              <div
                key={c.id}
                onClick={() => navigate('/commandes/' + c.id)}
                className={cn(
                  ROW_GRID,
                  'cursor-pointer items-center border-b border-de9-line py-4 hover:bg-de9-row',
                  overdue && 'bg-[#FFF7F7] hover:bg-[#FFF7F7] dark:bg-[#E7464E]/10 dark:hover:bg-[#E7464E]/10',
                )}
              >
                <div>
                  <div className="text-[14.5px] font-bold">
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        openClientFiche(c.clientName);
                      }}
                      className="cursor-pointer underline decoration-dotted decoration-[#C7CFD7] underline-offset-[3px]"
                    >
                      {c.clientName}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-de9-gray">
                    {c.reference ?? c.id} · {c.clientContact ?? '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[13.5px] font-semibold">{c.serviceLabel}</div>
                  <div className="flex items-center gap-[5px] text-[11.5px] text-de9-gray">
                    {c.kind === 'recurrent' ? '↻' : '•'}{' '}
                    {c.kind === 'recurrent' ? t('commonRecurrent') : t('commonPonctuel')} · {c.wilaya ?? '—'}
                  </div>
                </div>
                <div>
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-[11px] py-1.5 text-xs font-bold"
                    style={{ background: badge.bg, color: badge.fg }}
                  >
                    <span className="inline-flex min-w-[18px] flex-none items-center justify-center rounded-md bg-[#232838] px-[5px] py-[2px] text-[9.5px] font-extrabold leading-[1.4] tracking-[.02em] text-white">
                      {c.currentStatus.code}
                    </span>
                    {c.currentStatus.label}
                  </span>
                </div>
                <div>
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: ballColor }}>
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: ballColor, boxShadow: ballRing }}
                    />
                    {ballLabel(c.ball, t)}
                  </span>
                </div>
                <div className={cn('text-[13px] font-semibold', c.prestataireName ? 'text-de9-ink' : 'text-[#C0C8D0]')}>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      openPres(c.prestataireCompanyId ?? presName);
                    }}
                    className="cursor-pointer underline decoration-dotted decoration-[#C7CFD7] underline-offset-[3px]"
                  >
                    {presName}
                  </span>
                </div>
                <div>
                  <div className={cn('text-[13px] font-bold', slaClass)}>{slaLabel}</div>
                  <div className="text-[11px] text-[#B0B8C2]">{slaSub}</div>
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (toggleTraite.isPending) return;
                    toggleTraite.mutate(c.id, {
                      // Trust the server's value rather than assuming the flip.
                      onSuccess: (res) => setHandled((h) => ({ ...h, [res.id]: res.traite })),
                      onError: (err) => toast.error(problemMessage(err)),
                    });
                  }}
                  className="flex cursor-pointer items-center gap-[7px] aria-disabled:opacity-60"
                  aria-disabled={toggleTraite.isPending}
                >
                  <div
                    className={cn(
                      'flex h-5 w-5 flex-none items-center justify-center rounded-md border-[1.8px] text-xs text-white',
                      isHandled ? 'border-[#2FA86A] bg-[#2FA86A]' : 'border-[#D7DEE4] bg-card dark:border-[#3A4459]',
                    )}
                  >
                    {isHandled ? '✓' : ''}
                  </div>
                  <span
                    className={cn(
                      'text-[11.5px] font-bold',
                      isHandled ? 'text-[#2FA86A] dark:text-[#6FCF97]' : 'text-de9-gray',
                    )}
                  >
                    {isHandled ? t('worklistTraite') : t('worklistAFaire')}
                  </span>
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setNotesFor(c.id);
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-[5px] text-[13px] font-bold',
                    c.noteCount ? 'text-[#7C57C7] dark:text-[#A98BE8]' : 'text-[#C0C8D0]',
                  )}
                >
                  <span className="text-base">💬</span>
                  {c.noteCount}
                </div>
              </div>
            );
          })}

        {!isPending && !isError && list.length === 0 && (
          <div className="p-[50px] text-center text-sm text-de9-gray">{t('aucuneCommande')}</div>
        )}
        </div>

        {/* Pagination footer */}
        {meta && meta.total_pages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-de9-line px-[22px] py-3">
            <div className="text-[12.5px] font-semibold text-de9-gray">
              {t('worklistPageInfo')
                .replace('{n}', String(meta.current_page))
                .replace('{m}', String(meta.total_pages))}
              {' · '}
              {t('worklistTotalCount').replace('{n}', String(meta.total))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="cursor-pointer rounded-[11px] border-[1.5px] border-de9-line bg-card px-[13px] py-2 text-[12.5px] font-bold text-de9-slate disabled:cursor-default disabled:opacity-40"
              >
                {t('pagePrecedent')}
              </button>
              <button
                type="button"
                disabled={!meta.has_more_pages}
                onClick={() => setPage((p) => p + 1)}
                className="cursor-pointer rounded-[11px] border-[1.5px] border-de9-line bg-card px-[13px] py-2 text-[12.5px] font-bold text-de9-slate disabled:cursor-default disabled:opacity-40"
              >
                {t('pageSuivant')}
              </button>
            </div>
          </div>
        )}
      </div>

      <NotesModal
        commandeId={notesFor}
        open={notesFor !== null}
        onOpenChange={(open) => {
          if (!open) setNotesFor(null);
        }}
      />
    </div>
  );
}
