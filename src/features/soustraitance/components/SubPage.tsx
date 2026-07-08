import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useT, useL } from '@/lib/i18n';
import { useLangStore, type Lang } from '@/stores/langStore';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SubPro } from '../schemas/sub';
import { useSubDemandes, useSubPros } from '../api/sub';
import { SalarieModal } from './SalarieModal';

/* ---------- withDay (ported from logic.ts dayName/withDay) ---------- */
const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function withDay(s: string, lang: Lang): string {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return s;
  const dt = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (Number.isNaN(dt.getTime())) return s;
  const day = (lang === 'ar' ? DAYS_AR : DAYS_FR)[dt.getDay()];
  return s.replace(m[0], `${day} ${m[0]}`);
}

/* ---------- filter / sort state (ported from logic.ts subF + buildSoustraitance) ---------- */
const SORT_KEYS = ['realises', 'abandon', 'recues', 'envoyees'] as const;
type SubSortKey = (typeof SORT_KEYS)[number];
const isSortKey = (v: string): v is SubSortKey => (SORT_KEYS as readonly string[]).includes(v);

type FilterField = 'loc' | 'cat' | 'abandon' | 'minReal' | 'minRecues' | 'minEnv';

interface SubFilters {
  q: string;
  loc: string;
  cat: string;
  abandon: string;
  minReal: number;
  minRecues: number;
  minEnv: number;
  sort: SubSortKey;
}

const INITIAL_FILTERS: SubFilters = {
  q: '',
  loc: 'all',
  cat: 'all',
  abandon: 'all',
  minReal: 0,
  minRecues: 0,
  minEnv: 0,
  sort: 'realises',
};

interface SubContext {
  entreprise: string;
  cat: string;
  sub: string;
}

function filterAndSortPros(pros: SubPro[], f: SubFilters, ctx: SubContext | null): SubPro[] {
  let out = pros.slice();
  if (ctx && ctx.cat) out = out.filter((p) => p.cat === ctx.cat);
  const q = f.q.trim().toLowerCase();
  if (q) {
    out = out.filter(
      (p) => p.name.toLowerCase().includes(q) || p.services.toLowerCase().includes(q),
    );
  }
  if (f.loc !== 'all') out = out.filter((p) => p.wilaya === f.loc);
  if (f.cat !== 'all') out = out.filter((p) => p.cat === f.cat);
  if (f.abandon !== 'all') out = out.filter((p) => p.abandon <= Number(f.abandon));
  if (f.minReal) out = out.filter((p) => p.realises >= f.minReal);
  if (f.minRecues) out = out.filter((p) => p.recues >= f.minRecues);
  if (f.minEnv) out = out.filter((p) => p.envoyees >= f.minEnv);
  out.sort((a, b) => {
    if (f.sort === 'abandon') return a.abandon - b.abandon;
    if (f.sort === 'recues') return b.recues - a.recues;
    if (f.sort === 'envoyees') return b.envoyees - a.envoyees;
    return b.realises - a.realises;
  });
  return out;
}

interface SelectOpt {
  v: string;
  l: string;
}

interface FilterSelectDef {
  field: FilterField;
  value: string;
  options: SelectOpt[];
}

/* ---------- shared bits ---------- */
const CARD =
  'mt-3.5 rounded-[18px] border border-de9-line bg-card shadow-[0_10px_30px_rgba(38,50,69,.06)]';

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <div className="animate-pulse">
      {[0, 1, 2, 3].map((r) => (
        <div
          key={r}
          className="flex items-center gap-3 border-b border-de9-line px-[22px] py-4"
        >
          {Array.from({ length: cols }, (_, c) => (
            <div key={c} className="h-3 flex-1 rounded bg-secondary" />
          ))}
        </div>
      ))}
    </div>
  );
}

function InlineError({ text }: { text: string }) {
  return (
    <div className="m-4 rounded-[10px] border border-[#F2C9CB] bg-[#FDF0F0] px-[13px] py-2 text-[12px] font-semibold text-de9-red dark:border-[#E7464E]/40 dark:bg-[#E7464E]/15">
      {text}
    </div>
  );
}

const abandonClass = (a: number) =>
  a <= 5
    ? 'text-[#2FA86A] dark:text-[#6FCF97]'
    : a <= 12
      ? 'text-[#C98A1E] dark:text-[#D9B36A]'
      : 'text-de9-red';

/* ==================== SOUS-TRAITANCE PAGE ==================== */
export function SubPage() {
  const t = useT();
  const l = useL();
  const lang = useLangStore((s) => s.lang);
  const [, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState<'demandes' | 'pros'>('demandes');
  const [ctx, setCtx] = useState<SubContext | null>(null);
  const [f, setF] = useState<SubFilters>(INITIAL_FILTERS);
  const [salarieTarget, setSalarieTarget] = useState<{ id: string; name: string } | null>(null);

  const demandesQ = useSubDemandes();
  const prosQ = useSubPros();
  const allPros = useMemo(() => prosQ.data ?? [], [prosQ.data]);

  const pros = useMemo(() => filterAndSortPros(allPros, f, ctx), [allPros, f, ctx]);

  const setField = (field: FilterField, v: string) => {
    setF((prev) => {
      if (field === 'minReal' || field === 'minRecues' || field === 'minEnv') {
        return { ...prev, [field]: parseInt(v, 10) || 0 };
      }
      return { ...prev, [field]: v };
    });
  };

  const filterSelects: FilterSelectDef[] = useMemo(() => {
    const uniq = (arr: string[]) => [...new Set(arr)];
    const mkSel = (field: FilterField, label: string, value: string, opts: SelectOpt[]): FilterSelectDef => ({
      field,
      value,
      options: [{ v: 'all', l: label }, ...opts],
    });
    const numSel = (field: FilterField, label: string, value: number, vals: number[]): FilterSelectDef => ({
      field,
      value: String(value),
      options: [{ v: '0', l: label }, ...vals.map((n) => ({ v: String(n), l: `≥ ${n}` }))],
    });
    return [
      mkSel('loc', t('stFiltreLoc'), f.loc, uniq(allPros.map((p) => p.wilaya)).sort().map((w) => ({ v: w, l: w }))),
      mkSel('cat', t('stFiltreCat'), f.cat, uniq(allPros.map((p) => p.cat)).sort().map((c) => ({ v: c, l: c }))),
      mkSel('abandon', t('stFiltreAbandon'), f.abandon, [
        { v: '5', l: '≤ 5%' },
        { v: '10', l: '≤ 10%' },
        { v: '20', l: '≤ 20%' },
      ]),
      numSel('minReal', t('stFiltreReal'), f.minReal, [50, 100, 150]),
      numSel('minRecues', t('stFiltreRecues'), f.minRecues, [20, 30, 40]),
      numSel('minEnv', t('stFiltreEnv'), f.minEnv, [20, 30, 40]),
    ];
  }, [allPros, f, t]);

  const sortOpts: SelectOpt[] = [
    { v: 'realises', l: t('stColRealises') },
    { v: 'abandon', l: t('stColAbandon') },
    { v: 'recues', l: t('stColRecues') },
    { v: 'envoyees', l: t('stColEnvoyees') },
  ];

  const openDemandePros = (d: SubContext) => {
    setCtx(d);
    setF((prev) => ({ ...prev, cat: 'all' }));
    setTab('pros');
  };

  const openPresByName = (name: string) => {
    setSearchParams((prev) => {
      prev.set('pres', name);
      return prev;
    });
  };

  const loadError = l('Erreur de chargement des données', 'خطأ في تحميل البيانات');

  const demandesGrid = 'grid grid-cols-[1.6fr_1.4fr_1.8fr_1fr_1.2fr] gap-3 px-[22px]';
  const prosGrid =
    'grid grid-cols-[1.3fr_1.2fr_1.6fr_0.8fr_0.8fr_0.8fr_0.9fr_0.8fr_1.4fr] gap-2.5 px-5';
  const headRow =
    'border-b border-de9-line bg-secondary py-[13px] font-bold text-de9-gray uppercase';
  const presLink =
    'cursor-pointer underline decoration-dotted decoration-[#C7CFD7] underline-offset-[3px]';

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <div className="text-[23px] font-extrabold">{t('stTitre')}</div>
          <div className="mt-[2px] text-[13.5px] text-de9-gray">{t('stSub')}</div>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v === 'pros' ? 'pros' : 'demandes')}
        className="mt-4 gap-0"
      >
        <TabsList className="inline-flex w-fit max-w-full flex-wrap gap-1.5 rounded-xl border-[1.5px] border-de9-line bg-card p-[5px] group-data-horizontal/tabs:h-auto">
          {(
            [
              ['demandes', t('stDemandes')],
              ['pros', t('stPros')],
            ] as const
          ).map(([key, label]) => (
            <TabsTrigger
              key={key}
              value={key}
              className="h-auto flex-none rounded-lg border-0 px-4 py-[9px] text-[12.5px] font-bold text-de9-slate transition-none after:hidden hover:text-de9-slate data-active:bg-[#232838] data-active:text-white data-active:shadow-none dark:data-active:bg-[#232838] dark:data-active:text-white"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ---------- DEMANDES ---------- */}
        <TabsContent value="demandes">
          <div className="mt-3.5 inline-flex items-center gap-[7px] rounded-[10px] border border-[#F0E2C0] bg-[#FBF4E4] px-[13px] py-2 text-[11.5px] font-bold text-[#B68A2E] dark:border-[#B68A2E]/40 dark:bg-[#B68A2E]/15 dark:text-[#D9B36A]">
            ⓘ {t('stDemandeSansStatut')}
          </div>
          <div className={cn(CARD, 'overflow-x-auto')}>
            <div className="min-w-[720px]">
              <div className={cn(demandesGrid, headRow, 'text-[10.5px] tracking-[.04em]')}>
                <div>{t('stColEntreprise')}</div>
                <div>{t('stColCat')}</div>
                <div>{t('stColSub')}</div>
                <div>{t('stColDate')}</div>
                <div className="text-end">{t('stColAction')}</div>
              </div>
              {demandesQ.isPending && <TableSkeleton cols={5} />}
              {demandesQ.isError && <InlineError text={loadError} />}
              {(demandesQ.data ?? []).map((dm) => (
                <div
                  key={dm.id}
                  className={cn(demandesGrid, 'items-center border-b border-de9-line py-3.5')}
                >
                  <div className="text-[13px] font-bold">
                    <span className={presLink} onClick={() => openPresByName(dm.entreprise)}>
                      {dm.entreprise}
                    </span>
                  </div>
                  <div className="text-[12.5px] text-de9-slate">{dm.cat}</div>
                  <div className="text-[12px] text-de9-gray">{dm.sub}</div>
                  <div className="text-[12px] text-de9-slate">{withDay(dm.date, lang)}</div>
                  <div className="text-end">
                    <span
                      onClick={() =>
                        openDemandePros({ entreprise: dm.entreprise, cat: dm.cat, sub: dm.sub })
                      }
                      className="inline-block cursor-pointer rounded-[10px] bg-[#E5F7F4] px-[13px] py-2 text-[11.5px] font-bold text-de9-teal-dark dark:bg-[#178A82]/20"
                    >
                      {t('stVoirPros')} →
                    </span>
                  </div>
                </div>
              ))}
              {demandesQ.isSuccess && demandesQ.data.length === 0 && (
                <div className="p-11 text-center text-sm text-de9-gray">
                  {t('stAucuneDemande')}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ---------- PROS DISPONIBLES ---------- */}
        <TabsContent value="pros">
          {ctx && (
            <div className="mt-3.5 flex flex-wrap items-center gap-2.5 rounded-xl border-[1.5px] border-[#D7EFEC] bg-[#ECFAF8] px-[15px] py-[11px] dark:border-[#2C9C94]/40 dark:bg-[#2C9C94]/15">
              <span className="text-[13px] font-bold text-[#2C9C94] dark:text-[#5FC9BF]">
                {t('stContexte')} <b>{ctx.entreprise}</b> · {ctx.cat}
              </span>
              <div
                onClick={() => setCtx(null)}
                className="cursor-pointer rounded-[9px] border-[1.5px] border-[#CFE6E3] bg-card px-3 py-1.5 text-[11.5px] font-bold text-de9-slate dark:border-[#2C9C94]/40"
              >
                ✕ {t('stQuitterCtx')}
              </div>
            </div>
          )}

          <div className="mt-3.5 flex flex-wrap items-center gap-[9px]">
            <Input
              value={f.q}
              onChange={(e) => setF((prev) => ({ ...prev, q: e.target.value }))}
              placeholder={t('stRecherche')}
              className="h-auto w-full flex-none rounded-[11px] border-[1.5px] border-de9-line bg-card px-[15px] py-2.5 text-[12.5px] text-de9-ink shadow-none sm:w-[230px]"
            />
            {filterSelects.map((sel) => (
              <Select
                key={sel.field}
                value={sel.value}
                onValueChange={(v) => setField(sel.field, v)}
              >
                <SelectTrigger className="h-auto rounded-[11px] border-[1.5px] border-de9-line bg-card px-[13px] py-2.5 text-[12.5px] font-semibold text-de9-slate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {sel.options.map((op) => (
                    <SelectItem key={op.v} value={op.v}>
                      {op.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
            <div className="flex items-center gap-[7px]">
              <span className="text-[12px] font-semibold text-de9-gray">{t('stTrier')}</span>
              <Select
                value={f.sort}
                onValueChange={(v) => {
                  if (isSortKey(v)) setF((prev) => ({ ...prev, sort: v }));
                }}
              >
                <SelectTrigger className="h-auto rounded-[11px] border-[1.5px] border-de9-line bg-card px-[13px] py-2.5 text-[12.5px] font-semibold text-de9-slate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  {sortOpts.map((so) => (
                    <SelectItem key={so.v} value={so.v}>
                      {so.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-3 text-[12.5px] font-semibold text-de9-gray">
            {pros.length} {t('stResultats')}
          </div>

          <div className={cn(CARD, 'mt-3 overflow-x-auto')}>
            <div className="min-w-[960px]">
              <div className={cn(prosGrid, headRow, 'text-[10px] tracking-[.03em]')}>
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
              {prosQ.isPending && <TableSkeleton cols={9} />}
              {prosQ.isError && <InlineError text={loadError} />}
              {pros.map((pr) => (
                <div
                  key={pr.id}
                  className={cn(prosGrid, 'items-center border-b border-de9-line py-[13px]')}
                >
                  <div className="text-[12.5px] font-bold">
                    <span className={presLink} onClick={() => openPresByName(pr.name)}>
                      {pr.name}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-de9-slate">
                    {pr.wilaya} · {pr.commune}
                  </div>
                  <div className="text-[11.5px] text-de9-slate">{pr.services}</div>
                  <div className="text-end text-[12.5px] font-bold">{pr.realises}</div>
                  <div className="text-end text-[12.5px] text-de9-slate">{pr.recues}</div>
                  <div className="text-end text-[12.5px] text-de9-slate">{pr.envoyees}</div>
                  <div className={cn('text-end text-[12px] font-bold', abandonClass(pr.abandon))}>
                    {pr.abandon}%
                  </div>
                  <div>
                    <span
                      className={cn(
                        'rounded-full px-[9px] py-1 text-[10.5px] font-bold',
                        pr.dispo === 'now'
                          ? 'bg-[#E7F6EE] text-[#2FA86A] dark:bg-[#2FA86A]/15 dark:text-[#6FCF97]'
                          : 'bg-[#FBF1DF] text-[#C77C1F] dark:bg-[#C77C1F]/15 dark:text-[#E5A45C]',
                      )}
                    >
                      {pr.dispo === 'now'
                        ? t('subDispoBadge')
                        : `${t('subDispoLe')} ${pr.dispo}`}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    <a
                      href={`tel:+213${pr.phone.replace(/^0/, '')}`}
                      className="flex size-[30px] items-center justify-center rounded-[9px] border-[1.5px] border-de9-line text-[13px] no-underline"
                    >
                      📞
                    </a>
                    <a
                      href={`https://wa.me/${pr.wa}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex size-[30px] items-center justify-center rounded-[9px] border-[1.5px] border-de9-line text-[13px] no-underline"
                    >
                      💬
                    </a>
                    <div
                      onClick={() => setSalarieTarget({ id: pr.id, name: pr.name })}
                      className="cursor-pointer rounded-[9px] bg-de9-teal-dark px-2.5 py-[7px] text-[11px] font-bold whitespace-nowrap text-white"
                    >
                      ＋ {t('stAjouterSalarie')}
                    </div>
                  </div>
                </div>
              ))}
              {prosQ.isSuccess && pros.length === 0 && (
                <div className="p-11 text-center text-sm text-de9-gray">{t('stAucunPro')}</div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {salarieTarget && (
        <SalarieModal
          key={salarieTarget.id}
          pro={salarieTarget}
          defaultEntreprise={ctx?.entreprise ?? ''}
          onClose={() => setSalarieTarget(null)}
        />
      )}
    </div>
  );
}
