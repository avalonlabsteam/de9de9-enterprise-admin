// PRESTATAIRES — search page, driven by GET /prestataires/recherche. The
// server filters, sorts and paginates; this page maps UI state to query params
// and renders the result cards. Visual ground truth: src/admin (logic.ts
// buildPrestataires). The mock twin lives in src/api/mock/prestatairesRecherche.ts.
//
// Dropped vs the mock-era page (no API param exists): the € tarif-level and
// langue filters, and the reviews-store rating overlay (`note`/`nombreAvis`
// are server-authoritative now).
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useL, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCommunes, useWilayas } from '@/features/geo/api/geo';
import { useContextCommande, useRecherchePrestataires, type CtxCommande } from '../api/prestataires';
import type { PrestataireSearchItem, RechercheParams } from '../schemas/recherche';
import {
  FAM_COLOR,
  FAM_KEYS,
  FAM_LABEL,
  SERVICE_CAT,
  TAXO,
  catObj,
  slugify,
  type FamKey,
} from '../lib/taxonomy';
import { selectionActions, useSelectionStore } from '../stores/selectionStore';
import { SelectionBar } from './SelectionBar';
import { BriefModal } from './BriefModal';
import { ReviewModal } from './ReviewModal';

/* ===================== filters ===================== */

type SortKey = 'rating' | 'proximite' | 'tarif' | 'missions' | 'dispo';

interface Filters {
  q: string;
  families: FamKey[];
  cat: string;
  sub: string;
  wilaya: string;
  commune: string;
  minRating: number;
  minEffectif: number;
  dispoNow: boolean;
  kycOnly: boolean;
  certifOnly: boolean;
}

const DEFAULT_FILTERS: Filters = {
  q: '',
  families: [],
  cat: 'all',
  sub: 'all',
  wilaya: 'all',
  commune: 'all',
  minRating: 0,
  minEffectif: 0,
  dispoNow: false,
  kycOnly: false,
  certifOnly: false,
};

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 300;

/* ===================== display helpers ===================== */

const fmtDa = (n: number): string => n.toLocaleString('fr-FR');

function delaiLabel(heures: number | null | undefined): string {
  if (heures == null) return '—';
  return heures >= 24 ? `${Math.round(heures / 24)} j` : `${heures} h`;
}

function tarifLabel(p: PrestataireSearchItem): string {
  if (p.tarifMinDzd != null && p.tarifMaxDzd != null) return `${fmtDa(p.tarifMinDzd)}–${fmtDa(p.tarifMaxDzd)} DA`;
  if (p.tarifMinDzd != null) return `≥ ${fmtDa(p.tarifMinDzd)} DA`;
  return '—';
}

function initialsOf(nom: string): string {
  return nom
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/* ===================== small UI primitives ===================== */

interface Opt {
  v: string;
  l: string;
}

function FilterSelect({ value, options, onChange }: { value: string; options: Opt[]; onChange: (v: string) => void }) {
  // Radix Select needs the active value to exist as an item, even when the
  // option list no longer contains it (dictionary still loading, ctx value).
  const opts = options.some((o) => o.v === value) ? options : [...options, { v: value, l: value }];
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-auto max-w-full cursor-pointer gap-1.5 rounded-[11px] border-[1.5px] border-de9-line bg-card px-[13px] py-[10px] text-[12.5px] font-semibold text-de9-slate shadow-none">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opts.map((op) => (
          <SelectItem key={op.v} value={op.v} className="text-[12.5px]">
            {op.l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TogglePill({
  active,
  color,
  label,
  dot,
  onClick,
}: {
  active: boolean;
  color: string;
  label: string;
  dot?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-de9-line bg-card px-[15px] py-[9px] text-[12.5px] font-bold text-de9-slate"
      style={{
        borderColor: active || dot ? color : undefined,
        background: active ? color : undefined,
        color: active ? '#fff' : undefined,
      }}
    >
      {dot && <span className="size-[9px] rounded-full" style={{ background: active ? '#fff' : dot }} />}
      {label}
    </button>
  );
}

/* ===================== search page ===================== */

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const ctxId = searchParams.get('ctx');
  const ctxQ = useContextCommande(ctxId);
  const ctxCmd = ctxId ? (ctxQ.data ?? null) : null;

  // Remount the page content per search context so filter/sort state
  // reinitializes from the commande (logic.ts openSearchFor) without effects.
  return <SearchPageContent key={ctxCmd ? ctxCmd.id : 'none'} ctxCmd={ctxCmd} />;
}

function SearchPageContent({ ctxCmd }: { ctxCmd: CtxCommande | null }) {
  const t = useT();
  const l = useL();
  const [searchParams, setSearchParams] = useSearchParams();
  const reviewId = searchParams.get('review');

  const selected = useSelectionStore((s) => s.selected);
  const selNames = useSelectionStore((s) => s.names);

  // logic.ts openSearchFor — ctx commande pre-filters catégorie & wilaya.
  // The taxonomy id doubles as the server's category code (see taxonomy.ts).
  const [filters, setFilters] = useState<Filters>(() => {
    if (!ctxCmd) return DEFAULT_FILTERS;
    // Live context rows carry the taxonomy label as `service`, mock ones a service name.
    const cat = TAXO.find((c) => c.fr === ctxCmd.service)?.id ?? SERVICE_CAT[ctxCmd.service ?? ''];
    return { ...DEFAULT_FILTERS, cat: cat ? String(cat) : 'all', wilaya: ctxCmd.wilaya || 'all' };
  });
  const [sort, setSort] = useState<SortKey>('rating');
  const [page, setPage] = useState(1);
  const [qInput, setQInput] = useState('');
  const [briefOpen, setBriefOpen] = useState(false);

  // Debounce the search box into the filters. Every filter change re-opens the
  // results at page 1.
  useEffect(() => {
    const id = setTimeout(() => {
      setFilters((f) => (f.q === qInput ? f : { ...f, q: qInput }));
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [qInput]);

  const setField = (patch: Partial<Filters>): void => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  // Entering a search context resets the selection (prototype openSearchFor).
  const hasCtx = !!ctxCmd;
  useEffect(() => {
    if (hasCtx) selectionActions.clear();
  }, [hasCtx]);

  const params = useMemo<RechercheParams>(() => {
    const p: RechercheParams = { tri: sort, page, pageSize: PAGE_SIZE };
    if (filters.q.trim()) p.q = filters.q.trim();
    // The API's codes (verified live): familles are lowercase ('noir'),
    // categories/sous-categories are slugs of the French labels.
    if (filters.families.length) p.familles = filters.families.map((k) => k.toLowerCase());
    if (filters.cat !== 'all') {
      const co = catObj(filters.cat);
      p.categories = [co ? slugify(co.fr) : filters.cat];
    }
    if (filters.sub !== 'all') p.sousCategories = [slugify(filters.sub)];
    if (filters.wilaya !== 'all') p.wilaya = filters.wilaya;
    if (filters.commune !== 'all') p.commune = filters.commune;
    if (filters.minRating) p.noteMin = filters.minRating;
    if (filters.minEffectif) p.effectifMin = filters.minEffectif;
    if (filters.dispoNow) p.dispoNow = true;
    if (filters.kycOnly) p.kycOnly = true;
    if (filters.certifOnly) p.certifieOnly = true;
    return p;
  }, [filters, sort, page]);

  const searchQ = useRecherchePrestataires(params);
  const rows = useMemo(() => searchQ.data?.data ?? [], [searchQ.data]);
  const meta = searchQ.data?.meta;

  const selectedPres = useMemo(
    () => selected.map((id) => ({ id, name: selNames[id] ?? id })),
    [selected, selNames],
  );

  /* -------- option lists -------- */
  const { data: wilayasDict } = useWilayas();
  const selectedWilaya = filters.wilaya !== 'all' ? wilayasDict?.find((w) => w.nom === filters.wilaya) : undefined;
  const { data: communesDict } = useCommunes(selectedWilaya?.code ?? null);
  const wilayaOpts: Opt[] = (wilayasDict ?? []).map((w) => ({ v: w.nom, l: l(w.nom, w.nomAr) }));
  const communeOpts: Opt[] = (communesDict ?? []).map((c) => ({ v: c.nom, l: l(c.nom, c.nomAr) }));

  const catOpts: Opt[] = TAXO.filter(
    (c) => !filters.families.length || filters.families.includes(c.c.toUpperCase() as FamKey),
  ).map((c) => ({ v: String(c.id), l: c.icon + ' ' + l(c.fr, c.ar) }));
  const subOpts: Opt[] = (catObj(filters.cat)?.subs ?? []).map((s) => ({ v: s, l: s }));

  const sortOptions: Opt[] = [
    { v: 'rating', l: l('Note', 'التقييم') },
    { v: 'proximite', l: t('presProximite') },
    { v: 'tarif', l: t('presTarifF') },
    { v: 'missions', l: l('Missions', 'المهام') },
    { v: 'dispo', l: l('Dispo', 'التوفر') },
  ];

  const stripParam = (key: string) =>
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      n.delete(key);
      return n;
    });

  /** The profile overlay and the review modal are keyed by COMPANY id. */
  const openProfile = (id: string) =>
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      n.set('pres', id);
      return n;
    });

  // logic.ts addCandidate — add to selection (if absent) + toast
  const addCandidate = (p: PrestataireSearchItem) => {
    const key = p.companyId ?? p.id;
    if (!selected.includes(key)) selectionActions.toggle(key, p.nom);
    toast.success(t('presToastAjouteCandidats'));
  };

  const reviewName =
    rows.find((p) => (p.companyId ?? p.id) === reviewId)?.nom ??
    (reviewId ? (selNames[reviewId] ?? '') : '');

  return (
    <div className="animate-fade-in">
      {/* ---- search context banner (?ctx=) ---- */}
      {ctxCmd && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[13px] border-[1.5px] border-[#F0E2C0] bg-[#FEF3E2] px-[18px] py-3 dark:border-[#92702A]/40 dark:bg-[#92702A]/15">
          <div className="text-[13px] text-[#92702A] dark:text-[#D9B36A]">
            🔎 {t('presContexte')}{' '}
            <b>
              {ctxCmd.reference ?? ctxCmd.id} · {ctxCmd.clientName}
            </b>{' '}
            — {t('presPrefiltre')}
          </div>
          <button
            type="button"
            onClick={() => stripParam('ctx')}
            className="flex-none cursor-pointer text-[12px] font-bold text-[#92702A] dark:text-[#D9B36A]"
          >
            {t('presQuitter')} ✕
          </button>
        </div>
      )}

      {/* ---- header + sort ---- */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[23px] font-extrabold text-de9-ink">{t('presTitle')}</div>
          <div className="mt-0.5 text-[13.5px] text-de9-gray">{t('presSub')}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-de9-gray">{l('Trier', 'ترتيب')}</span>
          <FilterSelect
            value={sort}
            options={sortOptions}
            onChange={(v) => {
              setSort(v as SortKey);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* ---- text search ---- */}
      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <Input
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder={t('presSearchPh')}
          className="h-auto min-w-0 flex-[1_1_320px] rounded-xl border-[1.5px] border-de9-line bg-card px-[15px] py-[11px] text-[13px] text-de9-ink shadow-none outline-none"
        />
      </div>

      {/* ---- families, selects & toggles ---- */}
      <div className="mt-3 flex flex-wrap items-center gap-2.5">
        {FAM_KEYS.map((k) => (
          <TogglePill
            key={k}
            active={filters.families.includes(k)}
            color={FAM_COLOR[k]}
            dot={FAM_COLOR[k]}
            label={FAM_LABEL[k]}
            onClick={() =>
              setField({
                families: filters.families.includes(k)
                  ? filters.families.filter((x) => x !== k)
                  : [...filters.families, k],
              })
            }
          />
        ))}
        <FilterSelect
          value={filters.cat}
          options={[{ v: 'all', l: l('Catégorie', 'الفئة') }, ...catOpts]}
          onChange={(v) => setField({ cat: v, sub: 'all' })}
        />
        <FilterSelect
          value={filters.sub}
          options={[{ v: 'all', l: l('Sous-catégorie', 'الفئة الفرعية') }, ...subOpts]}
          onChange={(v) => setField({ sub: v })}
        />
        <FilterSelect
          value={filters.wilaya}
          options={[{ v: 'all', l: t('fWilaya') }, ...wilayaOpts]}
          onChange={(v) => setField({ wilaya: v, commune: 'all' })}
        />
        <FilterSelect
          value={filters.commune}
          options={[{ v: 'all', l: t('fCommune') }, ...communeOpts]}
          onChange={(v) => setField({ commune: v })}
        />
        <FilterSelect
          value={String(filters.minRating)}
          options={[
            { v: '0', l: l('Note', 'التقييم') },
            { v: '4', l: '4★+' },
            { v: '4.5', l: '4.5★+' },
          ]}
          onChange={(v) => setField({ minRating: parseFloat(v) || 0 })}
        />
        <FilterSelect
          value={String(filters.minEffectif)}
          options={[
            { v: '0', l: t('presEffectifF') },
            { v: '10', l: '10+' },
            { v: '20', l: '20+' },
            { v: '30', l: '30+' },
          ]}
          onChange={(v) => setField({ minEffectif: parseInt(v, 10) || 0 })}
        />
        <TogglePill
          active={filters.dispoNow}
          color="#232838"
          label={t('presDispoNow')}
          onClick={() => setField({ dispoNow: !filters.dispoNow })}
        />
        <TogglePill
          active={filters.kycOnly}
          color="#232838"
          label={t('presKycVerifie')}
          onClick={() => setField({ kycOnly: !filters.kycOnly })}
        />
        <TogglePill
          active={filters.certifOnly}
          color="#232838"
          label={t('presCertifie')}
          onClick={() => setField({ certifOnly: !filters.certifOnly })}
        />
      </div>

      {/* ---- results ---- */}
      {searchQ.isError && (
        <div className="mt-4 rounded-[13px] bg-[#FDEBEC] px-4 py-3 text-[13px] font-semibold text-de9-red dark:bg-[#E7464E]/15">
          {searchQ.error instanceof Error ? searchQ.error.message : 'Erreur'}
        </div>
      )}

      {searchQ.isPending ? (
        <div className="mt-6 grid grid-cols-1 gap-[14px] md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[280px] animate-pulse rounded-[18px] border-[1.5px] border-de9-line bg-card" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-4 text-[12.5px] font-semibold text-de9-gray">
            {meta?.total ?? rows.length} {t('presResultats')}
          </div>
          <div
            className={cn(
              'mt-3 grid grid-cols-1 gap-[14px] transition-opacity md:grid-cols-2 xl:grid-cols-3',
              searchQ.isPlaceholderData && 'opacity-60',
            )}
          >
            {rows.map((p) => {
              const famColor = p.familles[0]?.hex ?? '#232838';
              const catLabel = p.categories[0]?.label ?? '';
              const subsLabel = p.sousCategories.map((s) => s.label).join(' · ') || (p.pitch ?? '');
              const zonesLabel = [
                ...new Set([...(p.wilaya ? [p.wilaya] : []), ...p.zones.map((z) => z.wilaya)]),
              ].join(', ');
              const dn = p.dispoNow;
              const selKey = p.companyId ?? p.id;
              const isSel = selected.includes(selKey);
              const whatsAppHref = p.whatsAppUrl ?? (p.whatsAppPhone ? 'https://wa.me/' + p.whatsAppPhone : null);
              const hasRefs = p.referencesDe9de9 > 0 || p.referencesClient > 0;
              return (
                <div
                  key={p.id}
                  className={
                    'rounded-[18px] border-[1.5px] bg-card p-[18px] ' +
                    (isSel
                      ? 'border-de9-teal shadow-[0_0_0_2px_#65CBC4]'
                      : 'border-de9-line shadow-[0_8px_22px_rgba(38,50,69,.05)]')
                  }
                >
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => selectionActions.toggle(selKey, p.nom)}
                      className={
                        'mt-0.5 flex size-6 flex-none cursor-pointer items-center justify-center rounded-[7px] border-2 text-[14px] font-extrabold text-white ' +
                        (isSel ? 'border-de9-teal bg-de9-teal' : 'border-[#CBD3DB] bg-card')
                      }
                    >
                      {isSel ? '✓' : ''}
                    </button>
                    {p.logoUrl ? (
                      <img src={p.logoUrl} alt="" className="size-[46px] flex-none rounded-[13px] object-cover" />
                    ) : (
                      <div
                        className="flex size-[46px] flex-none items-center justify-center rounded-[13px] text-[15px] font-extrabold text-white"
                        style={{ background: famColor }}
                      >
                        {initialsOf(p.nom)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-[7px]">
                        <button
                          type="button"
                          onClick={() => openProfile(p.companyId ?? p.id)}
                          className="cursor-pointer text-[15.5px] font-extrabold text-de9-ink"
                        >
                          {p.nom}
                        </button>
                        <span className="size-[9px] rounded-full" style={{ background: famColor }} />
                        {p.kycVerifie && (
                          <span className="rounded-full bg-[#E7F6EE] px-2 py-[3px] text-[10px] font-extrabold text-[#2FA86A] dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]">
                            ✓ KYC
                          </span>
                        )}
                      </div>
                      {catLabel && (
                        <div className="mt-[3px] text-[12px] font-bold" style={{ color: famColor }}>
                          {catLabel}
                        </div>
                      )}
                      <div className="mt-0.5 text-[11.5px] text-de9-slate">{subsLabel}</div>
                      {zonesLabel && <div className="mt-px text-[11.5px] text-de9-gray">📍 {zonesLabel}</div>}
                    </div>
                    <div className="flex-none text-end">
                      <div className="text-[15px] font-extrabold text-de9-ink">
                        ★ {p.note == null ? '—' : p.note.toFixed(1)}
                      </div>
                      <div className="text-[10.5px] text-[#B0B8C2]">
                        {p.nombreAvis} {t('surNAvis')}
                      </div>
                      {hasRefs && (
                        <div className="mt-px whitespace-nowrap text-[9px] text-[#C0C8D0]">
                          {p.referencesDe9de9} de9de9 · {p.referencesClient} {l('client', 'عميل')}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-[10px] bg-secondary p-[9px] text-center">
                      <div className="text-[14px] font-extrabold text-de9-ink">{p.missions}</div>
                      <div className="text-[9.5px] text-de9-gray">{t('presMissionsCount')}</div>
                    </div>
                    <div className="rounded-[10px] bg-secondary p-[9px] text-center">
                      <div className="text-[14px] font-extrabold text-[#2FA86A] dark:text-[#6FCF97]">
                        {p.satisfactionPercent != null ? p.satisfactionPercent + '%' : '—'}
                      </div>
                      <div className="text-[9.5px] text-de9-gray">{t('presSatisfaction')}</div>
                    </div>
                    <div className="rounded-[10px] bg-secondary p-[9px] text-center">
                      <div className="text-[14px] font-extrabold text-de9-ink">{delaiLabel(p.delaiReponseHeures)}</div>
                      <div className="text-[9.5px] text-de9-gray">{t('presDelaiMoyen')}</div>
                    </div>
                    <div className="rounded-[10px] bg-secondary p-[9px] text-center">
                      <div className="text-[14px] font-extrabold text-de9-ink">{p.effectif ?? '—'}</div>
                      <div className="text-[9.5px] text-de9-gray">{t('presPers')}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-[7px]">
                    <span
                      className={
                        'inline-flex items-center gap-1.5 rounded-full px-[11px] py-1.5 text-[11.5px] font-bold ' +
                        (dn
                          ? 'bg-[#E7F6EE] text-[#2FA86A] dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]'
                          : 'bg-[#FBF1DF] text-[#C77C1F] dark:bg-[#C77C1F]/15 dark:text-[#D9B36A]')
                      }
                    >
                      {dn
                        ? '● ' + t('presDispoNow')
                        : '⏱ ' + l('Répond sous', 'يرد خلال') + ' ' + delaiLabel(p.delaiReponseHeures)}
                    </span>
                  </div>

                  <div className="mt-2.5 flex min-h-[26px] flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {p.certifications.map((c) => (
                        <span
                          key={c}
                          className="rounded-full bg-secondary px-[9px] py-1 text-[10.5px] font-bold text-de9-slate"
                        >
                          ✓ {c}
                        </span>
                      ))}
                    </div>
                    <span className="text-[12.5px] font-extrabold text-de9-ink">{tarifLabel(p)}</span>
                  </div>

                  <div className="mt-[13px] flex flex-wrap gap-2">
                    {p.contactPhone && (
                      <a
                        href={'tel:' + p.contactPhone}
                        className="flex-[1_1_30%] rounded-[11px] border-[1.5px] border-de9-line bg-card p-2.5 text-center text-[12px] font-bold text-de9-slate no-underline"
                      >
                        📞 {t('tel')}
                      </a>
                    )}
                    {whatsAppHref && (
                      <a
                        href={whatsAppHref}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-[1_1_30%] rounded-[11px] border-[1.5px] border-de9-line bg-card p-2.5 text-center text-[12px] font-bold text-de9-slate no-underline"
                      >
                        💬 WhatsApp
                      </a>
                    )}
                    {p.contactEmail && (
                      <a
                        href={'mailto:' + p.contactEmail}
                        className="flex-[1_1_30%] rounded-[11px] border-[1.5px] border-de9-line bg-card p-2.5 text-center text-[12px] font-bold text-de9-slate no-underline"
                      >
                        ✉️ Email
                      </a>
                    )}
                  </div>

                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => openProfile(p.companyId ?? p.id)}
                      className="flex-1 cursor-pointer rounded-[11px] bg-secondary p-2.5 text-center text-[12px] font-bold text-de9-slate"
                    >
                      {t('presVoirProfil')}
                    </button>
                    <button
                      type="button"
                      onClick={() => addCandidate(p)}
                      className="flex-1 cursor-pointer rounded-[11px] bg-[#232838] p-2.5 text-center text-[12px] font-bold text-white"
                    >
                      {t('presDemanderDevis')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {rows.length === 0 && (
            <div className="p-[50px] text-center text-[14px] text-de9-gray">{t('presAucun')}</div>
          )}

          {/* ---- pagination ---- */}
          {meta && meta.total_pages > 1 && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[12.5px] font-semibold text-de9-gray">
                {t('worklistPageInfo')
                  .replace('{n}', String(meta.current_page))
                  .replace('{m}', String(meta.total_pages))}
                {' · '}
                {meta.total} {t('presResultats')}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((n) => Math.max(1, n - 1))}
                  className="cursor-pointer rounded-[11px] border-[1.5px] border-de9-line bg-card px-[13px] py-2 text-[12.5px] font-bold text-de9-slate disabled:cursor-default disabled:opacity-40"
                >
                  {t('pagePrecedent')}
                </button>
                <button
                  type="button"
                  disabled={!meta.has_more_pages}
                  onClick={() => setPage((n) => n + 1)}
                  className="cursor-pointer rounded-[11px] border-[1.5px] border-de9-line bg-card px-[13px] py-2 text-[12.5px] font-bold text-de9-slate disabled:cursor-default disabled:opacity-40"
                >
                  {t('pageSuivant')}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ---- overlays ---- */}
      <SelectionBar onRequestQuotes={() => setBriefOpen(true)} />
      <BriefModal
        open={briefOpen}
        onOpenChange={setBriefOpen}
        selected={selectedPres}
        ctx={ctxCmd}
        filters={{ cat: filters.cat, sub: filters.sub, wilaya: filters.wilaya, commune: filters.commune }}
      />
      <ReviewModal
        presId={reviewId ?? ''}
        presName={reviewName}
        open={!!reviewId}
        onOpenChange={(o) => {
          if (!o) stripParam('review');
        }}
      />
    </div>
  );
}
