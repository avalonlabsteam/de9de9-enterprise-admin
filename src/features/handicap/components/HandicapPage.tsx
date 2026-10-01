// HANDICAP — waitlist page, driven by GET /handicap (cursor-paginated).
// The server filters (search/wilaya/jobType/contacted); rows accumulate via
// « Charger plus ». The mock twin lives in src/api/mock/handlers.ts.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, Mail, MessageCircle, Phone } from 'lucide-react';
import { useT, useL } from '@/lib/i18n';
import { useLangStore, type Lang } from '@/stores/langStore';
import { cn } from '@/lib/utils';
import { FOCUS_ROW_CLASS, useFocusScroll } from '@/lib/useFocusScroll';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Glyph } from '@/components/common/Glyph';
import { useWilayas } from '@/features/geo/api/geo';
import { useHandicapList } from '../api/handicap';
import type { HandicapItem, HandicapParams } from '../schemas/handicap';

/* ---- date helper (logic.ts dayName/withDay, adapted to ISO input) ---- */
const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function registeredLabel(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  const day = (lang === 'ar' ? DAYS_AR : DAYS_FR)[d.getDay()];
  return `${day} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const SEARCH_DEBOUNCE_MS = 300;

const GRID_COLS =
  '[grid-template-columns:1.3fr_1.2fr_1.6fr_0.6fr_1fr_1fr_1.4fr_0.9fr_0.8fr]';

type ContactedFilter = 'all' | 'yes' | 'no';

export function HandicapPage() {
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
  // Local overrides of the server `isContacted` flag — no toggle endpoint yet.
  const [contactedOverrides, setContactedOverrides] = useState<Record<string, boolean>>({});

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

  const isContacted = (w: HandicapItem): boolean => contactedOverrides[w.id] ?? w.isContacted;

  const toggleContacted = (w: HandicapItem): void => {
    setContactedOverrides((s) => ({ ...s, [w.id]: !(s[w.id] ?? w.isContacted) }));
  };

  /** The profile overlay is keyed by company id — GET /prestataires/{companyId}. */
  const openPres = (companyId: string): void => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('pres', companyId);
      return next;
    });
  };

  const contactedChips: { key: ContactedFilter; label: string }[] = [
    { key: 'all', label: t('tous') },
    { key: 'yes', label: t('hcContactes') },
    { key: 'no', label: t('hcAContacter') },
  ];

  const mkSelect = (value: string, label: string, opts: { v: string; l: string }[], onChange: (v: string) => void) => {
    const options = [{ v: 'all', l: label + ' : ' + t('tous') }, ...opts];
    if (value !== 'all' && !options.some((o) => o.v === value)) options.push({ v: value, l: value });
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-auto w-full cursor-pointer gap-1.5 rounded-xs border border-outline bg-card px-[13px] py-[10px] text-[12.5px] font-semibold text-de9-slate shadow-none sm:w-auto">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((op) => (
            <SelectItem key={op.v} value={op.v} className="text-[12.5px] font-semibold text-de9-slate">
              {op.l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  return (
    <div>
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-[14px]">
        <div>
          <div className="text-[23px] font-extrabold">{t('hcTitre')}</div>
          <div className="mt-[2px] text-[13.5px] text-de9-gray">{t('hcSub')}</div>
        </div>
      </div>

      {/* search + filters + count */}
      <div className="mt-[14px] flex flex-wrap items-center gap-[9px]">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('hcRecherche')}
          className="w-full flex-none rounded-xs border border-outline bg-card px-[15px] py-[10px] text-[12.5px] text-de9-ink outline-none sm:w-[300px]"
        />
        {mkSelect(wilaya, t('fWilaya'), wilayaOpts, setWilaya)}
        {mkSelect(jobType, t('hcColPoste'), jobTypeOpts, setJobType)}
        {contactedChips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setContacted(c.key)}
            className={cn(
              'cursor-pointer rounded-full border px-[13px] py-[8px] text-[12px] font-bold',
              contacted === c.key
                ? 'border-secondary-container bg-secondary-container text-on-secondary-container'
                : 'border-de9-line bg-card text-de9-slate',
            )}
          >
            {c.label}
          </button>
        ))}
        <div className="text-[12.5px] font-semibold text-de9-gray">
          {total} {t('hcCount')}
        </div>
      </div>

      {/* table card */}
      <div className="mt-3 overflow-x-auto rounded-md border border-de9-line bg-card">
        <div className={cn('min-w-[1040px] transition-opacity', listQ.isPlaceholderData && 'opacity-60')}>
          <div
            className={`grid ${GRID_COLS} gap-[10px] border-b border-de9-line bg-secondary px-5 py-[13px] text-[10px] font-bold uppercase tracking-[.03em] text-de9-gray`}
          >
            <div>{t('hcColEntreprise')}</div>
            <div>{t('hcColContact')}</div>
            <div>{t('hcColPoste')}</div>
            <div className="text-center">{t('hcColNombre')}</div>
            <div>{t('hcColZone')}</div>
            <div>{t('hcColDate')}</div>
            <div>{t('hcColComment')}</div>
            <div className="text-center">{t('hcColContacter')}</div>
            <div className="text-center">{t('hcColContacte')}</div>
          </div>

          {listQ.isPending && (
            <div className="px-5 py-[13px]">
              {[0, 1, 2].map((i) => (
                <div key={i} className="mb-[13px] h-9 animate-pulse rounded-sm bg-de9-row" />
              ))}
            </div>
          )}

          {listQ.isError && !listQ.isPending && (
            <div className="px-5 py-[13px] text-[12.5px] font-semibold text-de9-red">
              {L('Erreur de chargement de la liste', 'خطأ في تحميل القائمة')}
            </div>
          )}

          {!listQ.isPending &&
            !listQ.isError &&
            rows.map((w) => {
              const done = isContacted(w);
              const waHref = w.contactPhone ? 'https://wa.me/213' + w.contactPhone.replace(/^0/, '') : null;
              return (
                <div
                  key={w.id}
                  ref={w.id === focusInscription ? focusRef : undefined}
                  className={cn(
                    `grid ${GRID_COLS} items-center gap-[10px] border-b border-de9-line px-5 py-[13px]`,
                    w.id === focusInscription && FOCUS_ROW_CLASS,
                  )}
                >
                  <div className="text-[12.5px] font-bold">
                    {w.companyId ? (
                      <span
                        onClick={() => openPres(w.companyId!)}
                        className="cursor-pointer underline decoration-[#C7CFD7] decoration-dotted underline-offset-[3px]"
                      >
                        {w.companyName}
                      </span>
                    ) : (
                      w.companyName
                    )}
                  </div>
                  <div className="text-[12px] text-de9-slate">
                    {w.contactName ?? '—'}
                    <div className="text-[10.5px] text-de9-gray">{w.contactPhone ?? '—'}</div>
                  </div>
                  <div className="text-[12px] text-de9-slate">{w.jobType ?? '—'}</div>
                  <div className="text-center text-[12.5px] font-bold">{w.positionsCount || '—'}</div>
                  <div className="text-[12px] text-de9-slate">
                    {w.wilaya ?? '—'}
                    {w.commune && <div className="text-[10.5px] text-de9-gray">{w.commune}</div>}
                  </div>
                  <div className="text-[12px] text-de9-slate">{registeredLabel(w.registeredAt, lang)}</div>
                  <div className="text-[11.5px] leading-[1.4] text-de9-gray">
                    {w.comment || '—'}
                    {w.contactNote && (
                      <div className="mt-0.5 text-[10.5px] font-semibold text-[#2FA86A] dark:text-[#6FCF97]">
                        <Glyph icon={Check} /> {w.contactNote}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-[6px]">
                    {w.contactPhone && (
                      <a
                        href={'tel:+213' + w.contactPhone.replace(/^0/, '')}
                        className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-de9-line text-[13px] no-underline"
                      >
                        <Glyph icon={Phone} />
                      </a>
                    )}
                    {waHref && (
                      <a
                        href={waHref}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-de9-line text-[13px] no-underline"
                      >
                        <Glyph icon={MessageCircle} />
                      </a>
                    )}
                    {w.contactEmail && (
                      <a
                        href={'mailto:' + w.contactEmail}
                        className="flex h-[30px] w-[30px] items-center justify-center rounded-full border border-de9-line text-[13px] no-underline"
                      >
                        <Glyph icon={Mail} />
                      </a>
                    )}
                    {!w.contactPhone && !w.contactEmail && '—'}
                  </div>
                  <div className="flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => toggleContacted(w)}
                      title={w.contactedAt ? registeredLabel(w.contactedAt, lang) : undefined}
                      className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 text-[13px] font-extrabold text-white ${
                        done
                          ? 'border-[#2FA86A] bg-[#2FA86A]'
                          : 'border-[#CBD3DB] bg-card dark:border-de9-line'
                      }`}
                    >
                      {done && <Glyph icon={Check} className="stroke-[3]" />}
                    </button>
                  </div>
                </div>
              );
            })}

          {!listQ.isPending && !listQ.isError && rows.length === 0 && (
            <div className="p-[44px] text-center text-[14px] text-de9-gray">{t('hcAucun')}</div>
          )}
        </div>

        {/* load more */}
        {listQ.hasNextPage && (
          <div className="flex justify-center border-t border-de9-line px-5 py-3">
            <button
              type="button"
              disabled={listQ.isFetchingNextPage}
              onClick={() => void listQ.fetchNextPage()}
              className="cursor-pointer rounded-full border border-de9-line bg-card px-4 py-2 text-[12.5px] font-bold text-de9-slate disabled:cursor-default disabled:opacity-40"
            >
              {listQ.isFetchingNextPage ? '…' : t('chargerPlus')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
