// Tab « Pros disponibles » — the real pros of the de9de9 app
// (GET /admin/contractuels/pros), filtered and sorted on the server. Opened
// from a demande (?demande=<id>) it starts from the demande's category,
// service and wilaya, and each row says how the pro stands against that
// company. Opened alone it is a plain directory.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, MessageCircle, Phone, Plus, Star, X } from 'lucide-react';
import { useL, useT, type TKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { problemMessage } from '@/api/problem';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Glyph } from '@/components/common/Glyph';
import { telHref, waHref } from '@/features/handicap/lib/handicap';
import { useCtrDemande, useCtrFiltres, useCtrPros, type CtrProsFilters } from '@/features/contractuels/api/contractuels';
import {
  CHIP_AMBER,
  CHIP_BLUE,
  CHIP_GREEN,
  CHIP_GREY,
  PROS_PAGE_SIZE,
  abandonClass,
  ctrProblem,
  initialsOf,
  isLegacyUnavailable,
  isOuverte,
  photoSrc,
  placeChezText,
  restantOf,
} from '@/features/contractuels/lib/contractuels';
import type { CtrDemande, CtrPro, OptionCategorie } from '@/features/contractuels/schemas/contractuels';
import { PlacerDialog } from './PlacerDialog';

const SEARCH_DEBOUNCE_MS = 300;
const GRID = 'grid grid-cols-[1.5fr_0.95fr_1.45fr_0.6fr_0.6fr_0.6fr_0.6fr_0.9fr_224px] gap-2.5 px-5';
const PILL = 'inline-flex max-w-full items-center rounded-full px-2.5 py-[5px] text-[11px] font-bold';
const TRIGGER =
  'h-auto w-full cursor-pointer gap-1.5 rounded-xs border border-outline bg-card px-[13px] py-[10px] text-[12.5px] font-semibold text-de9-slate shadow-none sm:w-auto';
const TOGGLE = 'cursor-pointer rounded-full border px-[13px] py-[8px] text-[12px] font-bold';
const TOGGLE_ON = 'border-secondary-container bg-secondary-container text-on-secondary-container';
const TOGGLE_OFF = 'border-de9-line bg-card text-de9-slate';

const TRIS: ReadonlyArray<{ v: string; labelKey: TKey }> = [
  { v: 'services', labelKey: 'stColRealises' },
  { v: 'abandon', labelKey: 'stColAbandon' },
  { v: 'offres_recues', labelKey: 'stColRecues' },
  { v: 'offres_envoyees', labelKey: 'stColEnvoyees' },
  { v: 'note', labelKey: 'stTriNote' },
  { v: 'nom', labelKey: 'stTriNom' },
];

const ABANDONS = [10, 20, 30];
const FLOORS = [10, 50, 100];

interface ProsUi {
  /** 'all' or an id of the de9de9 app's lists, as text (the selects' values). */
  categoryId: string;
  serviceId: string;
  wilayaId: string;
  abandonMax: string;
  servicesMin: string;
  offresRecuesMin: string;
  offresEnvoyeesMin: string;
  kyc: boolean;
  dispo: boolean;
  inactifs: boolean;
  tri: string;
  page: number;
}

const num = (v: string): number | undefined => (v === 'all' ? undefined : Number(v));
const idText = (v: number | null | undefined): string => (v == null ? 'all' : String(v));

export function ProsTab({ onQuitter }: { onQuitter: () => void }) {
  const t = useT();
  const [sp] = useSearchParams();
  const demandeId = sp.get('demande');
  const demandeQ = useCtrDemande(demandeId);

  if (demandeId && demandeQ.isPending) {
    return <div className="mt-3.5 h-[180px] animate-pulse rounded-md bg-card" />;
  }
  if (demandeId && demandeQ.isError) {
    const gone = ctrProblem(demandeQ.error).status === 404;
    return (
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-de9-line bg-card px-5 py-4">
        <div className="text-[12.5px] font-semibold text-de9-red">
          {gone ? t('stDemandeIntrouvable') : `${t('stErreurDemandes')} — ${problemMessage(demandeQ.error)}`}
        </div>
        <button type="button" onClick={onQuitter} className="cursor-pointer rounded-full border border-de9-line bg-card px-3.5 py-2 text-[12px] font-bold text-de9-slate">
          <Glyph icon={X} /> {t('stQuitterDemande')}
        </button>
      </div>
    );
  }

  const demande = demandeQ.data?.demande ?? null;
  // A demande (re)starts the filters from its own values.
  return <ProsBrowser key={demande?.id ?? 'annuaire'} demande={demande} onQuitter={onQuitter} />;
}

function ProsBrowser({ demande, onQuitter }: { demande: CtrDemande | null; onQuitter: () => void }) {
  const t = useT();
  const L = useL();
  const filtresQ = useCtrFiltres();
  const [ui, setUi] = useState<ProsUi>(() => ({
    categoryId: idText(demande?.categoryId),
    serviceId: idText(demande?.serviceId),
    wilayaId: idText(demande?.wilayaId),
    abandonMax: 'all',
    servicesMin: 'all',
    offresRecuesMin: 'all',
    offresEnvoyeesMin: 'all',
    kyc: false,
    dispo: false,
    inactifs: false,
    tri: 'services',
    page: 1,
  }));
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [placer, setPlacer] = useState<CtrPro | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      const next = qInput.trim().slice(0, 128);
      setQ(next);
      setUi((u) => (u.page === 1 ? u : { ...u, page: 1 }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [qInput]);

  const set = (patch: Partial<ProsUi>): void => setUi((u) => ({ ...u, ...patch, page: patch.page ?? 1 }));

  const filters = useMemo<CtrProsFilters>(
    () => ({
      q: q || undefined,
      categoryId: num(ui.categoryId),
      serviceId: num(ui.serviceId),
      wilayaId: num(ui.wilayaId),
      abandonMax: num(ui.abandonMax),
      servicesMin: num(ui.servicesMin),
      offresRecuesMin: num(ui.offresRecuesMin),
      offresEnvoyeesMin: num(ui.offresEnvoyeesMin),
      kyc: ui.kyc,
      dispo: ui.dispo,
      inactifs: ui.inactifs,
      tri: ui.tri === 'services' ? undefined : ui.tri,
      demandeId: demande?.id,
      page: ui.page,
      pageSize: PROS_PAGE_SIZE,
    }),
    [q, ui, demande?.id],
  );
  const prosQ = useCtrPros(filters);
  const rows = prosQ.data?.items ?? [];
  const total = prosQ.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PROS_PAGE_SIZE));

  // ---- the de9de9 app's lists ----
  const categories = useMemo(() => filtresQ.data?.categories ?? [], [filtresQ.data]);
  const wilayas = filtresQ.data?.wilayas ?? [];
  const groupes = useMemo(() => {
    const out: { groupe: string; items: OptionCategorie[] }[] = [];
    for (const c of categories) {
      const g = L(c.groupe ?? '', c.groupeAr ?? c.groupe ?? '');
      const last = out[out.length - 1];
      if (last && last.groupe === g) last.items.push(c);
      else out.push({ groupe: g, items: [c] });
    }
    return out;
  }, [categories, L]);
  const services = categories.find((c) => String(c.id) === ui.categoryId)?.services ?? [];

  const restant = demande ? restantOf(demande) : null;
  const legacyDown = isLegacyUnavailable(prosQ.error) || isLegacyUnavailable(filtresQ.error);

  /** Guide 23 §11 — one button per row, by what the server says about the pro. */
  const actionOf = (p: CtrPro): { label: string; enabled: boolean } => {
    if (p.alreadyPlacedHere) return { label: t('stAjoute'), enabled: false };
    if (p.placedElsewhere) return { label: t('stPlaceAilleurs'), enabled: false };
    // Full first: a demande turns « Pourvue » with its last seat.
    if (restant === 0) return { label: t('stDemandePourvue'), enabled: false };
    if (demande && !isOuverte(demande)) return { label: t('stDemandeFermee'), enabled: false };
    return { label: t('stAjouterSalarie'), enabled: true };
  };

  return (
    <div>
      {/* ---- the demande the directory was opened from ---- */}
      {demande && (
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5 rounded-md border border-[#D7EFEC] bg-[#ECFAF8] px-[15px] py-[11px] dark:border-[#2C9C94]/40 dark:bg-[#2C9C94]/15">
          <div className="text-[13px] text-[#1F6F68] dark:text-[#7FD3CA]">
            {/* Each run isolated: French labels and figures inside an Arabic sentence keep their order. */}
            {t('stDemandeDe')} <bdi className="font-extrabold">{demande.companyName ?? '—'}</bdi>
            {' — '}
            <bdi>{[demande.categoryLabel, demande.subcategoryLabel, demande.wilaya].filter(Boolean).join(' · ')}</bdi>
            {' — '}
            <b>
              <Fraction text={t('stPlacesRestant').replace('{r}', String(restant ?? 0))} n={demande.fulfilledCount} m={demande.requestedCount} />
            </b>
          </div>
          <button
            type="button"
            onClick={onQuitter}
            className="cursor-pointer rounded-sm border border-[#CFE6E3] bg-card px-3 py-1.5 text-[11.5px] font-bold text-de9-slate dark:border-[#2C9C94]/40"
          >
            <Glyph icon={X} /> {t('stQuitterDemande')}
          </button>
        </div>
      )}

      {/* ---- filters: every one goes to the server ---- */}
      <div className="mt-3.5 flex flex-wrap items-center gap-[9px]">
        <input
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          maxLength={128}
          placeholder={t('stRecherche')}
          aria-label={t('stRecherche')}
          className="w-full flex-none rounded-xs border border-outline bg-card px-[15px] py-[10px] text-[12.5px] text-de9-ink outline-none sm:w-[230px]"
        />
        <Select value={ui.wilayaId} onValueChange={(v) => set({ wilayaId: v })}>
          <SelectTrigger aria-label={t('stFiltreLoc')} className={TRIGGER}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[12.5px]">
              {t('stFiltreLoc')} : {t('tous')}
            </SelectItem>
            {wilayas.map((w) => (
              <SelectItem key={w.id} value={String(w.id)} className="text-[12.5px]">
                {w.code != null ? `${w.code} · ` : ''}
                {L(w.name, w.nameAr ?? w.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ui.categoryId} onValueChange={(v) => set({ categoryId: v, serviceId: 'all' })}>
          <SelectTrigger aria-label={t('stFiltreCat')} className={TRIGGER}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[12.5px]">
              {t('stFiltreCat')} : {t('tous')}
            </SelectItem>
            {groupes.map((g) => (
              <SelectGroup key={g.groupe}>
                {g.groupe && <SelectLabel className="text-[11px] font-extrabold tracking-[.04em] text-de9-gray uppercase">{g.groupe}</SelectLabel>}
                {g.items.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)} className="text-[12.5px]">
                    {L(c.name, c.nameAr ?? c.name)}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <Select value={ui.serviceId} onValueChange={(v) => set({ serviceId: v })} disabled={ui.categoryId === 'all'}>
          <SelectTrigger aria-label={t('stFiltreService')} className={cn(TRIGGER, 'disabled:opacity-60')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[12.5px]">
              {t('stFiltreService')} : {t('tous')}
            </SelectItem>
            {services.map((s) => (
              <SelectItem key={s.id} value={String(s.id)} className="text-[12.5px]">
                {L(s.name, s.nameAr ?? s.name)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={ui.abandonMax} onValueChange={(v) => set({ abandonMax: v })}>
          <SelectTrigger aria-label={t('stFiltreAbandon')} className={TRIGGER}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-[12.5px]">
              {t('stFiltreAbandon')} : {t('tous')}
            </SelectItem>
            {ABANDONS.map((n) => (
              <SelectItem key={n} value={String(n)} className="text-[12.5px]">
                {t('stFiltreAbandon')} ≤ {n} %
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(
          [
            ['servicesMin', 'stFiltreReal'],
            ['offresRecuesMin', 'stFiltreRecues'],
            ['offresEnvoyeesMin', 'stFiltreEnv'],
          ] as const
        ).map(([field, labelKey]) => (
          <Select key={field} value={ui[field]} onValueChange={(v) => set({ [field]: v })}>
            <SelectTrigger aria-label={t(labelKey)} className={TRIGGER}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-[12.5px]">
                {t(labelKey)} : {t('tous')}
              </SelectItem>
              {FLOORS.map((n) => (
                <SelectItem key={n} value={String(n)} className="text-[12.5px]">
                  {t(labelKey)} ≥ {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {(
          [
            ['kyc', 'stKycSeul'],
            ['dispo', 'stDispoSeul'],
            ['inactifs', 'stInactifs'],
          ] as const
        ).map(([field, labelKey]) => (
          <button
            key={field}
            type="button"
            aria-pressed={ui[field]}
            onClick={() => set({ [field]: !ui[field] })}
            className={cn(TOGGLE, ui[field] ? TOGGLE_ON : TOGGLE_OFF)}
          >
            {t(labelKey)}
          </button>
        ))}
        <label className="flex items-center gap-[7px] text-[12px] font-semibold text-de9-gray">
          {t('stTrier')}
          <Select value={ui.tri} onValueChange={(v) => set({ tri: v })}>
            <SelectTrigger aria-label={t('stTrier')} className={TRIGGER}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRIS.map((o) => (
                <SelectItem key={o.v} value={o.v} className="text-[12.5px]">
                  {t(o.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      {/* The de9de9 app database does not answer: say so, offer a retry, never a stale list. */}
      {legacyDown && (
        <div role="alert" className="mt-3.5 flex flex-wrap items-center justify-between gap-3 rounded-md bg-[#FDECEC] px-4 py-3 dark:bg-[#E7464E]/15">
          <div dir="auto" className="text-[12.5px] font-semibold text-de9-red ltr:text-left rtl:text-right">
            {problemMessage(isLegacyUnavailable(prosQ.error) ? prosQ.error : filtresQ.error)}
          </div>
          <button
            type="button"
            onClick={() => {
              void prosQ.refetch();
              void filtresQ.refetch();
            }}
            className="cursor-pointer rounded-full border border-de9-red bg-card px-3.5 py-1.5 text-[12px] font-bold text-de9-red"
          >
            {t('reessayer')}
          </button>
        </div>
      )}

      {!legacyDown && prosQ.isSuccess && (
        <div className="mt-3 text-[12.5px] font-semibold text-de9-gray">{t('stNPros').replace('{n}', String(total))}</div>
      )}

      <div className="mt-3 overflow-hidden rounded-md border border-de9-line bg-card">
        <div className={cn('overflow-x-auto transition-opacity', prosQ.isPlaceholderData && 'opacity-60')}>
          <div className="min-w-[1100px]">
            <div className={cn(GRID, 'border-b border-de9-line bg-secondary py-[13px] text-[10px] font-bold tracking-[.03em] text-de9-gray uppercase')}>
              <div>{t('stColNom')}</div>
              <div>{t('stColLoc')}</div>
              <div>{t('stColServices')}</div>
              <div className="text-end">{t('stColRealises')}</div>
              <div className="text-end">{t('stColRecues')}</div>
              <div className="text-end">{t('stColEnvoyees')}</div>
              <div className="text-end">{t('stColAbandon')}</div>
              <div>{t('stColDispo')}</div>
              <div className="text-end">{t('stColContact')}</div>
            </div>

            {prosQ.isPending && (
              <div className="px-5 py-3.5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="mb-3 h-12 animate-pulse rounded-sm bg-de9-row last:mb-0" />
                ))}
              </div>
            )}
            {prosQ.isError && !legacyDown && (
              <div className="px-5 py-4 text-[12.5px] font-semibold text-de9-red">
                {t('stErreurPros')} — {problemMessage(prosQ.error)}
              </div>
            )}

            {rows.map((p) => (
              <ProRow key={p.legacyProUserId} pro={p} action={actionOf(p)} onPlacer={() => setPlacer(p)} />
            ))}
          </div>
        </div>

        {prosQ.isSuccess && rows.length === 0 && <div className="p-11 text-center text-sm text-de9-gray">{t('stAucunPro')}</div>}

        {prosQ.isSuccess && pages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-de9-line px-5 py-3">
            <div className="text-[12.5px] font-semibold text-de9-gray">
              {t('worklistPageInfo').replace('{n}', String(ui.page)).replace('{m}', String(pages))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={ui.page <= 1}
                onClick={() => set({ page: ui.page - 1 })}
                className="cursor-pointer rounded-full border border-de9-line bg-card px-[13px] py-2 text-[12.5px] font-bold text-de9-slate disabled:cursor-default disabled:opacity-40"
              >
                {t('pagePrecedent')}
              </button>
              <button
                type="button"
                disabled={ui.page >= pages}
                onClick={() => set({ page: ui.page + 1 })}
                className="cursor-pointer rounded-full border border-de9-line bg-card px-[13px] py-2 text-[12.5px] font-bold text-de9-slate disabled:cursor-default disabled:opacity-40"
              >
                {t('pageSuivant')}
              </button>
            </div>
          </div>
        )}
      </div>

      {placer && <PlacerDialog pro={placer} demande={demande} onClose={() => setPlacer(null)} onDemandeGone={onQuitter} />}
    </div>
  );
}

/** A dictionary line whose `{n}` is « placed / requested », kept left to right in Arabic. */
function Fraction({ text, n, m }: { text: string; n: number; m: number }) {
  const [before, after = ''] = text.split('{n}');
  return (
    <>
      {before}
      <span className="num">
        {n} / {m}
      </span>
      {after}
    </>
  );
}

function ProAvatar({ pro }: { pro: CtrPro }) {
  const [failed, setFailed] = useState(false);
  const src = photoSrc(pro.photoUrl);
  if (src && !failed) {
    return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="size-9 flex-none rounded-full object-cover" />;
  }
  return (
    <div className="flex size-9 flex-none items-center justify-center rounded-full bg-primary-container text-[12px] font-extrabold text-on-primary-container">
      {initialsOf(pro.fullName ?? '?')}
    </div>
  );
}

function DispoPill({ pro }: { pro: CtrPro }) {
  const t = useT();
  if (pro.dispo === 'now') return <span className={cn(PILL, CHIP_GREEN)}>{t('subDispoBadge')}</span>;
  if (pro.dispo === 'date') {
    const [y, m, d] = (pro.dispoDate ?? '').split('-');
    const day = y && m && d ? `${d}/${m}` : (pro.dispoDate ?? '');
    return (
      <span className={cn(PILL, CHIP_AMBER)}>
        {t('subDispoLe')}&nbsp;<span className="num">{day}</span>
      </span>
    );
  }
  if (pro.dispo === 'place') {
    const chez = placeChezText(pro);
    return (
      <span title={chez} className={cn(PILL, CHIP_BLUE, 'truncate')}>
        {t('stPlaceChez').replace('{n}', chez)}
      </span>
    );
  }
  if (pro.dispo === 'indisponible') return <span className={cn(PILL, CHIP_GREY)}>{t('stIndisponible')}</span>;
  return <span className="text-[12px] text-de9-gray">—</span>;
}

function ProRow({ pro: p, action, onPlacer }: { pro: CtrPro; action: { label: string; enabled: boolean }; onPlacer: () => void }) {
  const t = useT();
  const nom = p.fullName ?? '—';
  const lieu = [p.wilaya, p.commune].filter(Boolean).join(' · ');
  const categories = (p.categories ?? []).join(', ');
  const services = (p.services ?? []).join(' · ');
  return (
    <div className={cn(GRID, 'items-center border-b border-de9-line py-[13px]', p.actif === false && 'opacity-70')}>
      <div className="flex min-w-0 items-center gap-2.5">
        <ProAvatar pro={p} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <bdi className="text-[12.5px] font-bold text-de9-ink">{nom}</bdi>
            {p.kycApproved && (
              <span className="rounded-full bg-[#E7F6EE] px-1.5 py-[2px] text-[9.5px] font-extrabold text-[#2FA86A] dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]">
                <Glyph icon={Check} /> KYC
              </span>
            )}
            {p.actif === false && (
              <span className="rounded-full bg-[#EEF1F4] px-1.5 py-[2px] text-[9.5px] font-extrabold text-[#6B7280] dark:bg-[#9AA4B2]/15 dark:text-[#A6AEBD]">
                {t('stCompteInactif')}
              </span>
            )}
          </div>
          {p.rating != null && (
            <div className="mt-0.5 text-[11px] text-de9-gray">
              <Glyph icon={Star} filled className="text-[#E6A53A]" /> <span className="num">{p.rating.toFixed(2)}</span>
              {p.evaluations != null && (
                <>
                  {' '}
                  <span className="num">({p.evaluations})</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="min-w-0 text-[11.5px] text-de9-slate">{lieu || '—'}</div>
      <div className="min-w-0">
        <div className="truncate text-[11.5px] font-semibold text-de9-ink" title={categories}>
          {categories || '—'}
        </div>
        {services && (
          <div className="line-clamp-2 text-[11px] leading-snug text-de9-gray" title={services}>
            {services}
          </div>
        )}
      </div>
      <div className="text-end text-[12.5px] font-bold">
        <span className="num">{p.servicesRealises ?? '—'}</span>
      </div>
      <div className="text-end text-[12.5px] text-de9-slate">
        <span className="num">{p.offresRecues ?? '—'}</span>
      </div>
      <div className="text-end text-[12.5px] text-de9-slate">
        <span className="num">{p.offresEnvoyees ?? '—'}</span>
      </div>
      <div className={cn('text-end text-[12px] font-bold', p.tauxAbandon != null ? abandonClass(p.tauxAbandon) : 'text-de9-gray')}>
        <span className="num">{p.tauxAbandon != null ? `${p.tauxAbandon} %` : '—'}</span>
      </div>
      <div className="min-w-0">
        <DispoPill pro={p} />
      </div>
      <div className="flex items-center justify-end gap-1.5">
        {p.phone && (
          <>
            <a href={telHref(p.phone)} aria-label={t('tel')} title={p.phone} className="flex size-[30px] flex-none items-center justify-center rounded-full border border-de9-line text-[13px] text-de9-slate no-underline">
              <Glyph icon={Phone} />
            </a>
            <a href={waHref(p.phone)} target="_blank" rel="noreferrer" aria-label="WhatsApp" title="WhatsApp" className="flex size-[30px] flex-none items-center justify-center rounded-full border border-de9-line text-[13px] text-de9-slate no-underline">
              <Glyph icon={MessageCircle} />
            </a>
          </>
        )}
        <button
          type="button"
          onClick={onPlacer}
          disabled={!action.enabled}
          className={cn(
            'cursor-pointer rounded-full px-2.5 py-[7px] text-[11px] font-bold whitespace-nowrap disabled:cursor-not-allowed',
            action.enabled ? 'bg-primary text-primary-foreground' : 'border border-de9-line bg-card text-de9-gray',
          )}
        >
          {action.enabled && <Glyph icon={Plus} />}
          {!action.enabled && p.alreadyPlacedHere && <Glyph icon={Check} />} {action.label}
        </button>
      </div>
    </div>
  );
}
